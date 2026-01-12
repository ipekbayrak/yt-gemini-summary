(() => {
  const LOG_PREFIX = "[YT→Gemini]";
  const CARD_SELECTORS = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytm-shorts-lockup-view-model-v2",
    "yt-lockup-view-model",
    "ytd-compact-video-renderer",
    "ytd-playlist-panel-video-renderer",
  ].join(",");
  const WATCH_ACTIONS_SELECTORS = [
    "ytd-watch-metadata #actions-inner ytd-menu-renderer #top-level-buttons-computed",
    "ytd-watch-metadata ytd-menu-renderer #top-level-buttons-computed",
    "ytd-watch-metadata #top-level-buttons-computed",
  ];
  const WATCH_ACTIONS_FALLBACK_SELECTOR = "ytd-watch-metadata #actions-inner";
  const BUTTON_CLASS = "gemini-summary-btn";
  const CARD_CLASS = "gemini-summary-card";
  const WATCH_BUTTON_CLASS = "gemini-summary-watch-btn";
  const WATCH_CONTAINER_CLASS = "gemini-summary-watch-container";
  const DATASET_FLAG = "geminiSummaryInjected";
  const SETTINGS_KEY = "settings";
  const INVALIDATION_TITLE = "Reload the page to re-enable the extension.";
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
  let extensionAvailable = true;

  const getErrorMessage = (error) => {
    if (!error) {
      return "";
    }
    if (typeof error === "string") {
      return error;
    }
    if (typeof error.message === "string") {
      return error.message;
    }
    try {
      return String(error);
    } catch (stringifyError) {
      return "";
    }
  };

  const isExtensionContextInvalidated = (error) => {
    const message = getErrorMessage(error).toLowerCase();
    return (
      message.includes("extension context invalidated") ||
      message.includes("context invalidated") ||
      message.includes("message port closed")
    );
  };

  const disableButton = (button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    button.disabled = true;
    if (button.classList.contains(WATCH_BUTTON_CLASS)) {
      button.classList.add(`${WATCH_BUTTON_CLASS}--disabled`);
    } else {
      button.classList.add(`${BUTTON_CLASS}--disabled`);
    }
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("title", INVALIDATION_TITLE);
  };

  const disableAllButtons = () => {
    document
      .querySelectorAll(`.${BUTTON_CLASS}, .${WATCH_BUTTON_CLASS}`)
      .forEach((button) => disableButton(button));
  };

  const markExtensionUnavailable = () => {
    if (!extensionAvailable) {
      return;
    }
    extensionAvailable = false;
    disableAllButtons();
    logWarn("Extension context invalidated; reload the page to re-enable.");
  };

  const canUseRuntime = () => {
    if (!extensionAvailable) {
      return false;
    }
    try {
      return Boolean(chrome?.runtime?.id && chrome.runtime.sendMessage);
    } catch (error) {
      return false;
    }
  };

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
    document
      .querySelectorAll(`.${BUTTON_CLASS}, .${WATCH_BUTTON_CLASS}`)
      .forEach((button) => {
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

  const hasInjectedAncestor = (card) => {
    let ancestor = card.parentElement;
    while (ancestor) {
      if (ancestor.dataset?.[DATASET_FLAG] === "true") {
        return true;
      }
      ancestor = ancestor.parentElement;
    }
    return false;
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

  const isWatchPage = () =>
    window.location.pathname.startsWith("/watch") ||
    Boolean(document.querySelector("ytd-watch-metadata"));

  const extractWatchTitle = () => {
    const selectors = [
      "ytd-watch-metadata h1 yt-formatted-string",
      "ytd-watch-metadata h1",
      "ytd-watch-metadata #title yt-formatted-string",
      "ytd-watch-metadata #title",
    ];
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const text = node?.textContent?.trim();
      if (text) {
        return text;
      }
    }

    const meta =
      document.querySelector('meta[name="title"]') ||
      document.querySelector('meta[property="og:title"]');
    const metaTitle = meta?.getAttribute("content")?.trim();
    if (metaTitle) {
      return metaTitle;
    }

    const fallback = document.title.replace(/\s*-\s*YouTube\s*$/, "").trim();
    return fallback || "";
  };

  const extractWatchChannel = () => {
    const selectors = [
      "ytd-watch-metadata #owner #channel-name a",
      "ytd-watch-metadata ytd-channel-name a",
      "ytd-video-owner-renderer #channel-name a",
      "ytd-video-owner-renderer ytd-channel-name a",
      "ytd-watch-metadata #channel-name",
      "ytd-video-owner-renderer #channel-name",
    ];
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const text = node?.textContent?.trim();
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

  const buildWatchPayload = () => {
    let url = "";
    try {
      const parsed = new URL(window.location.href);
      url = `${parsed.origin}${parsed.pathname}${parsed.search}`;
    } catch (error) {
      url = window.location.href || "";
    }
    return {
      url,
      title: extractWatchTitle(),
      channel: extractWatchChannel(),
    };
  };

  const getWatchActionsContainer = () => {
    for (const selector of WATCH_ACTIONS_SELECTORS) {
      const node = document.querySelector(selector);
      if (node) {
        return node;
      }
    }

    const menu = document.querySelector("ytd-watch-metadata ytd-menu-renderer");
    if (menu) {
      const root = menu.shadowRoot || menu.renderRoot || menu;
      const node = root?.querySelector?.("#top-level-buttons-computed");
      if (node) {
        return node;
      }
    }

    const actionsInner = document.querySelector(WATCH_ACTIONS_FALLBACK_SELECTOR);
    if (!actionsInner) {
      return null;
    }
    let container = actionsInner.querySelector(`.${WATCH_CONTAINER_CLASS}`);
    if (!container) {
      container = document.createElement("div");
      container.className = WATCH_CONTAINER_CLASS;
      const menuContainer = actionsInner.querySelector("#menu");
      if (menuContainer) {
        actionsInner.insertBefore(container, menuContainer);
      } else {
        actionsInner.prepend(container);
      }
    }
    return container;
  };

  const createButton = (card) => {
    if (card.dataset[DATASET_FLAG] === "true") {
      return;
    }
    if (card.querySelector(`.${BUTTON_CLASS}`)) {
      card.dataset[DATASET_FLAG] = "true";
      return;
    }
    if (hasInjectedAncestor(card)) {
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
        if (!canUseRuntime()) {
          markExtensionUnavailable();
          return;
        }
        try {
          chrome.runtime.sendMessage({ type: "OPEN_GEMINI", payload }, () => {
            const error = chrome.runtime?.lastError;
            if (error) {
              if (isExtensionContextInvalidated(error)) {
                markExtensionUnavailable();
                return;
              }
              logWarn("Failed to send OPEN_GEMINI message.", error);
            }
          });
        } catch (error) {
          if (isExtensionContextInvalidated(error)) {
            markExtensionUnavailable();
            return;
          }
          throw error;
        }
      } catch (error) {
        if (isExtensionContextInvalidated(error)) {
          markExtensionUnavailable();
          return;
        }
        logError("Failed to handle summary click.", error);
      }
    });

    card.classList.add(CARD_CLASS);
    card.appendChild(button);
    card.dataset[DATASET_FLAG] = "true";
  };

  const createWatchButton = (actions) => {
    if (!(actions instanceof HTMLElement)) {
      return;
    }
    if (actions.querySelector(`.${WATCH_BUTTON_CLASS}`)) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = WATCH_BUTTON_CLASS;
    const label = getButtonLabel(currentLanguage);
    button.textContent = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.addEventListener("click", (event) => {
      try {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }
        const payload = buildWatchPayload();
        if (!payload.url) {
          return;
        }
        if (!canUseRuntime()) {
          markExtensionUnavailable();
          return;
        }
        try {
          chrome.runtime.sendMessage({ type: "OPEN_GEMINI", payload }, () => {
            const error = chrome.runtime?.lastError;
            if (error) {
              if (isExtensionContextInvalidated(error)) {
                markExtensionUnavailable();
                return;
              }
              logWarn("Failed to send OPEN_GEMINI message.", error);
            }
          });
        } catch (error) {
          if (isExtensionContextInvalidated(error)) {
            markExtensionUnavailable();
            return;
          }
          throw error;
        }
      } catch (error) {
        if (isExtensionContextInvalidated(error)) {
          markExtensionUnavailable();
          return;
        }
        logError("Failed to handle summary click.", error);
      }
    });

    actions.prepend(button);
  };

  const scanCards = () => {
    if (!extensionAvailable) {
      return;
    }
    try {
      const cards = Array.from(document.querySelectorAll(CARD_SELECTORS));
      for (let index = cards.length - 1; index >= 0; index -= 1) {
        const card = cards[index];
        if (!(card instanceof HTMLElement)) {
          continue;
        }
        if (card.dataset[DATASET_FLAG] === "true") {
          continue;
        }
        if (card.querySelector(`.${BUTTON_CLASS}`)) {
          card.dataset[DATASET_FLAG] = "true";
          continue;
        }
        if (hasInjectedAncestor(card)) {
          continue;
        }
        const url = extractUrl(card);
        if (!url) {
          continue;
        }
        createButton(card);
      }
    } catch (error) {
      logWarn("Failed to scan YouTube cards.", error);
    }
  };

  const scanWatchButton = () => {
    if (!extensionAvailable) {
      return;
    }
    if (!isWatchPage()) {
      return;
    }
    const actions = getWatchActionsContainer();
    if (!actions) {
      return;
    }
    createWatchButton(actions);
  };

  const scanAll = () => {
    scanCards();
    scanWatchButton();
  };

  const scheduleScan = throttle(scanAll, THROTTLE_MS);
  const observer = new MutationObserver(() => scheduleScan());
  try {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch (error) {
    logWarn("Failed to observe DOM mutations.", error);
  }
  window.addEventListener("yt-navigate-finish", scheduleScan);
  window.addEventListener("yt-page-data-updated", scheduleScan);

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
