(() => {
  const LOG_PREFIX = "[YT→Gemini]";
  const SETTINGS_KEY = "settings";
  const PENDING_KEY = "pendingPrompt";
  const EDITOR_SELECTOR =
    '.ql-editor.textarea.new-input-ui[contenteditable="true"]';
  const SEND_BUTTON_SELECTOR = "button.send-button.submit";
  const DEFAULT_PROMPT_TEMPLATE = `Bu YouTube videosunu Türkçe özetle.
Başlık: {title}
Kanal: {channel}
URL: {url}

Format:
- 8-12 madde özet
- 3 ana çıkarım
- Eğer öğreticiyse: adım adım yapılacaklar`;
  const DEFAULT_SETTINGS = {
    autoSend: true,
    sendDelayMs: 150,
    promptTemplate: DEFAULT_PROMPT_TEMPLATE,
  };

  let delivering = false;
  let queuedOptions = null;

  const logInfo = (...args) => console.info(LOG_PREFIX, ...args);
  const logWarn = (...args) => console.warn(LOG_PREFIX, ...args);

  const storageGet = (key) =>
    new Promise((resolve) => {
      if (!chrome?.storage?.local) {
        resolve({});
        return;
      }
      try {
        chrome.storage.local.get(key, (result) => {
          const error = chrome.runtime?.lastError;
          if (error) {
            logWarn("Failed to read storage key.", error);
            resolve({});
            return;
          }
          resolve(result || {});
        });
      } catch (error) {
        logWarn("Failed to read storage key.", error);
        resolve({});
      }
    });

  const storageRemove = (key) =>
    new Promise((resolve) => {
      if (!chrome?.storage?.local) {
        resolve();
        return;
      }
      try {
        chrome.storage.local.remove(key, () => resolve());
      } catch (error) {
        logWarn("Failed to remove storage key.", error);
        resolve();
      }
    });

  const getSettings = async () => {
    const result = await storageGet(SETTINGS_KEY);
    const stored = result?.[SETTINGS_KEY];
    if (stored && typeof stored === "object") {
      return { ...DEFAULT_SETTINGS, ...stored };
    }
    return { ...DEFAULT_SETTINGS };
  };

  const getPending = async () => {
    const result = await storageGet(PENDING_KEY);
    return result?.[PENDING_KEY] ?? null;
  };

  const clearPending = async () => {
    await storageRemove(PENDING_KEY);
  };

  const renderTemplate = (template, data) => {
    const safeTemplate =
      typeof template === "string" ? template : DEFAULT_PROMPT_TEMPLATE;
    const safeData = {
      url: data?.url ?? "",
      title: data?.title ?? "",
      channel: data?.channel ?? "",
    };
    return safeTemplate.replace(
      /\{(url|title|channel)\}/g,
      (_, key) => safeData[key] ?? ""
    );
  };

  const buildPromptFragment = (prompt) => {
    const fragment = document.createDocumentFragment();
    const normalized = prompt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    lines.forEach((line) => {
      const paragraph = document.createElement("p");
      if (line.length === 0) {
        paragraph.appendChild(document.createElement("br"));
      } else {
        paragraph.textContent = line;
      }
      fragment.appendChild(paragraph);
    });
    return fragment;
  };

  const waitForEditor = (attempts = 5, intervalMs = 300) =>
    new Promise((resolve) => {
      let remaining = attempts;
      const check = () => {
        const editor = document.querySelector(EDITOR_SELECTOR);
        if (editor) {
          resolve(editor);
          return;
        }
        remaining -= 1;
        if (remaining <= 0) {
          resolve(null);
          return;
        }
        setTimeout(check, intervalMs);
      };
      check();
    });

  const writeToEditor = (editor, prompt) => {
    try {
      const fragment = buildPromptFragment(prompt);
      while (editor.firstChild) {
        editor.removeChild(editor.firstChild);
      }
      editor.appendChild(fragment);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (error) {
      logWarn("Failed to write to Gemini editor.", error);
    }
  };

  const attemptSend = (sendDelayMs, retries) =>
    new Promise((resolve) => {
      const tryClick = (remaining) => {
        try {
          const button = document.querySelector(SEND_BUTTON_SELECTOR);
          if (button && button.getAttribute("aria-disabled") !== "true") {
            button.click();
            resolve(true);
            return;
          }
          if (remaining <= 0) {
            resolve(false);
            return;
          }
          setTimeout(() => tryClick(remaining - 1), 300);
        } catch (error) {
          logWarn("Failed to click Gemini send button.", error);
          resolve(false);
        }
      };

      setTimeout(() => tryClick(retries), sendDelayMs);
    });

  const runDelivery = async ({ expectedId, onlyIfAutoSend }) => {
    const settings = await getSettings();
    if (onlyIfAutoSend && !settings.autoSend) {
      return;
    }

    const pending = await getPending();
    if (!pending) {
      logInfo("No pending prompt found for Gemini.");
      return;
    }

    if (expectedId && pending.id && expectedId !== pending.id) {
      logInfo("Pending prompt ID mismatch; ignoring delivery.");
      return;
    }

    const editor = await waitForEditor();
    if (!editor) {
      logWarn("Gemini editor not found; pending prompt retained.");
      return;
    }

    const prompt = renderTemplate(settings.promptTemplate, pending);
    writeToEditor(editor, prompt);

    if (!settings.autoSend) {
      logInfo("Auto-send disabled; prompt filled only.");
      return;
    }

    const delayMs = Number.isFinite(settings.sendDelayMs)
      ? Math.min(Math.max(settings.sendDelayMs, 0), 2000)
      : 150;
    const sent = await attemptSend(delayMs, 2);
    if (sent) {
      await clearPending();
      return;
    }

    logWarn("Gemini send button not ready; pending prompt retained.");
  };

  const scheduleDelivery = (options) => {
    if (delivering) {
      queuedOptions = options;
      return;
    }
    delivering = true;
    runDelivery(options)
      .catch((error) => {
        logWarn("Failed to deliver Gemini prompt.", error);
      })
      .finally(() => {
        delivering = false;
        if (queuedOptions) {
          const next = queuedOptions;
          queuedOptions = null;
          scheduleDelivery(next);
        }
      });
  };

  chrome.runtime?.onMessage?.addListener((message) => {
    if (message?.type !== "DELIVER_PROMPT") {
      return;
    }
    scheduleDelivery({
      expectedId: message?.payload?.id,
      onlyIfAutoSend: false,
    });
  });

  const init = () => {
    scheduleDelivery({ expectedId: null, onlyIfAutoSend: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
