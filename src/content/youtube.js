(() => {
  const LOG_PREFIX = "[YT→Gemini]";
  const CARD_SELECTORS = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytm-shorts-lockup-view-model",
    "ytm-shorts-lockup-view-model-v2",
  ].join(",");
  const BUTTON_CLASS = "gemini-summary-btn";
  const CARD_CLASS = "gemini-summary-card";
  const DATASET_FLAG = "geminiSummaryInjected";
  const SETTINGS_KEY = "settings";
  const LABELS = {
    en: "🤖 Summarize with Gemini",
    es: "🤖 Resumir con Gemini",
    hi: "🤖 Gemini से सारांश",
    ar: "🤖 لخص مع Gemini",
    tr: "🤖 Gemini ile özetle",
  };
  const THROTTLE_MS = 200;

  const logWarn = (...args) => console.warn(LOG_PREFIX, ...args);
  const logError = (...args) => console.error(LOG_PREFIX, ...args);

  const getChromeLanguage = () => {
    try {
      const uiLanguage =
        chrome?.i18n?.getUILanguage?.() ||
        navigator?.language ||
        navigator?.languages?.[0] ||
        "";
      return String(uiLanguage).toLowerCase();
    } catch (error) {
      return "";
    }
  };

  const SUPPORTED_LANGUAGES = ["en", "es", "hi", "ar", "tr"];
  const normalizeLanguage = (value) => {
    if (!value) {
      return "en";
    }
    const normalized = String(value).toLowerCase();
    const base = normalized.split("-")[0];
    return SUPPORTED_LANGUAGES.includes(base) ? base : "en";
  };
  const getDefaultLanguage = () => normalizeLanguage(getChromeLanguage());

  let currentLanguage = getDefaultLanguage();
  const DEFAULT_SETTINGS = {
    showButtonOnHoverOnly: true,
    language: currentLanguage,
  };

  const getButtonLabel = (language) => LABELS[language] || LABELS.en;

  const updateButtonLabels = (language) => {
    const label = getButtonLabel(language);
    document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((button) => {
      if (!(button instanceof HTMLElement)) {
        return;
      }
      button.textContent = label;
      button.setAttribute("aria-label", label);
    });
  };

  const updateLanguage = (language) => {
    const normalized = normalizeLanguage(language);
    currentLanguage = normalized;
    updateButtonLabels(normalized);
  };

  const throttle = (fn, wait) => {
    let timeoutId = null;
    let pendingArgs = null;
    return (...args) => {
      pendingArgs = args;
      if (timeoutId) {
        return;
      }
      timeoutId = setTimeout(() => {
        timeoutId = null;
        const argsToRun = pendingArgs;
        pendingArgs = null;
        try {
          fn(...(argsToRun || []));
        } catch (error) {
          logWarn("Throttled task failed.", error);
        }
      }, wait);
    };
  };

  const getSettings = () =>
    new Promise((resolve) => {
      if (!chrome?.storage?.local) {
        resolve({ ...DEFAULT_SETTINGS, language: currentLanguage });
        return;
      }
      try {
        chrome.storage.local.get(SETTINGS_KEY, (result) => {
          const error = chrome.runtime?.lastError;
          if (error) {
            logWarn("Failed to read settings; using defaults.", error);
            resolve({ ...DEFAULT_SETTINGS, language: currentLanguage });
            return;
          }
          const stored = result?.[SETTINGS_KEY];
          if (stored && typeof stored === "object") {
            resolve({ ...DEFAULT_SETTINGS, ...stored });
            return;
          }
          resolve({ ...DEFAULT_SETTINGS, language: currentLanguage });
        });
      } catch (error) {
        logWarn("Failed to read settings; using defaults.", error);
        resolve({ ...DEFAULT_SETTINGS, language: currentLanguage });
      }
    });

  const applyHoverMode = (enabled) => {
    try {
      document.documentElement.classList.toggle(
        "gemini-hover-only",
        Boolean(enabled)
      );
    } catch (error) {
      logWarn("Failed to toggle hover mode.", error);
    }
  };

  const extractUrl = (card) => {
    const anchor = card.querySelector('a[href^="/watch"], a[href^="/shorts"]');
    if (!anchor) {
      return "";
    }
    const href = anchor.getAttribute("href");
    if (!href) {
      return "";
    }
    try {
      return new URL(href, window.location.origin).href;
    } catch (error) {
      return "";
    }
  };

  const extractTitle = (card) => {
    const lockupTitle = card.querySelector(
      "a.yt-lockup-metadata-view-model__title span"
    );
    if (lockupTitle?.textContent) {
      const text = lockupTitle.textContent.trim();
      if (text) {
        return text;
      }
    }

    const ariaAnchor = card.querySelector("a[aria-label]");
    if (ariaAnchor) {
      const label = ariaAnchor.getAttribute("aria-label");
      if (label?.trim()) {
        return label.trim();
      }
    }

    const shortsTitle = card.querySelector('a[href^="/shorts"] span');
    if (shortsTitle?.textContent) {
      const text = shortsTitle.textContent.trim();
      if (text) {
        return text;
      }
    }

    const fallbackAnchor = card.querySelector(
      'a[href^="/watch"], a[href^="/shorts"]'
    );
    if (fallbackAnchor) {
      const titleAttr = fallbackAnchor.getAttribute("title");
      if (titleAttr?.trim()) {
        return titleAttr.trim();
      }
      if (fallbackAnchor.textContent?.trim()) {
        return fallbackAnchor.textContent.trim();
      }
    }

    return "";
  };

  const extractChannel = (card) => {
    const channelAnchor =
      card.querySelector('a[href^="/@"]') ||
      card.querySelector('a[href^="/channel/"]') ||
      card.querySelector('a[href^="/c/"]') ||
      card.querySelector('a[href^="/user/"]');
    if (channelAnchor?.textContent) {
      const text = channelAnchor.textContent.trim();
      if (text) {
        return text;
      }
    }

    const metaAnchor = card.querySelector("#channel-name a, ytd-channel-name a");
    if (metaAnchor?.textContent) {
      const text = metaAnchor.textContent.trim();
      if (text) {
        return text;
      }
    }

    return "";
  };

  const buildPayload = (card) => ({
    url: extractUrl(card),
    title: extractTitle(card),
    channel: extractChannel(card),
  });

  const createButton = (card) => {
    if (card.dataset[DATASET_FLAG] === "true") {
      return;
    }
    if (card.querySelector(`.${BUTTON_CLASS}`)) {
      card.dataset[DATASET_FLAG] = "true";
      return;
    }

    const url = extractUrl(card);
    if (!url) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    const label = getButtonLabel(currentLanguage);
    button.textContent = label;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", (event) => {
      try {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }
        const payload = buildPayload(card);
        if (!payload.url) {
          return;
        }
        chrome.runtime?.sendMessage?.({ type: "OPEN_GEMINI", payload }, () => {
          const error = chrome.runtime?.lastError;
          if (error) {
            logWarn("Failed to send OPEN_GEMINI message.", error);
          }
        });
      } catch (error) {
        logError("Failed to handle summary click.", error);
      }
    });

    card.classList.add(CARD_CLASS);
    card.appendChild(button);
    card.dataset[DATASET_FLAG] = "true";
  };

  const scanCards = () => {
    try {
      document.querySelectorAll(CARD_SELECTORS).forEach((card) => {
        if (!(card instanceof HTMLElement)) {
          return;
        }
        if (card.dataset[DATASET_FLAG] === "true") {
          return;
        }
        if (card.querySelector(`.${BUTTON_CLASS}`)) {
          card.dataset[DATASET_FLAG] = "true";
          return;
        }
        const url = extractUrl(card);
        if (!url) {
          return;
        }
        createButton(card);
      });
    } catch (error) {
      logWarn("Failed to scan YouTube cards.", error);
    }
  };

  const scheduleScan = throttle(scanCards, THROTTLE_MS);
  const observer = new MutationObserver(() => scheduleScan());
  try {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch (error) {
    logWarn("Failed to observe DOM mutations.", error);
  }

  getSettings()
    .then((settings) => {
      applyHoverMode(settings.showButtonOnHoverOnly);
      updateLanguage(settings.language);
    })
    .catch((error) => {
      logWarn("Failed to apply hover mode from settings.", error);
      applyHoverMode(DEFAULT_SETTINGS.showButtonOnHoverOnly);
    });

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      try {
        if (areaName !== "local") {
          return;
        }
        const updated = changes?.[SETTINGS_KEY]?.newValue;
        if (updated && typeof updated === "object") {
          if (
            Object.prototype.hasOwnProperty.call(
              updated,
              "showButtonOnHoverOnly"
            )
          ) {
            applyHoverMode(updated.showButtonOnHoverOnly);
          }
          if (Object.prototype.hasOwnProperty.call(updated, "language")) {
            updateLanguage(updated.language);
          }
        }
      } catch (error) {
        logWarn("Failed to handle settings change.", error);
      }
    });
  }

  scheduleScan();
})();
