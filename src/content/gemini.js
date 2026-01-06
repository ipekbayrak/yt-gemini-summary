(() => {
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
            resolve({});
            return;
          }
          resolve(result || {});
        });
      } catch (error) {
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

  const escapeHtml = (value) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const renderTemplate = (template, data) => {
    const safeData = {
      url: data?.url ?? "",
      title: data?.title ?? "",
      channel: data?.channel ?? "",
    };
    return template.replace(
      /\{(url|title|channel)\}/g,
      (_, key) => safeData[key] ?? ""
    );
  };

  const promptToHtml = (prompt) => {
    const normalized = prompt.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    return lines
      .map((line) =>
        line.length === 0 ? "<p><br></p>" : `<p>${escapeHtml(line)}</p>`
      )
      .join("");
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
    editor.innerHTML = promptToHtml(prompt);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const attemptSend = (sendDelayMs, retries) =>
    new Promise((resolve) => {
      const tryClick = (remaining) => {
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
      console.info("No pending prompt found for Gemini.");
      return;
    }

    if (expectedId && pending.id && expectedId !== pending.id) {
      console.info("Pending prompt ID mismatch; ignoring delivery.");
      return;
    }

    const editor = await waitForEditor();
    if (!editor) {
      console.warn("Gemini editor not found; pending prompt retained.");
      return;
    }

    const prompt = renderTemplate(settings.promptTemplate, pending);
    writeToEditor(editor, prompt);

    if (!settings.autoSend) {
      console.info("Auto-send disabled; prompt filled only.");
      return;
    }

    const delayMs =
      typeof settings.sendDelayMs === "number" ? settings.sendDelayMs : 150;
    const sent = await attemptSend(delayMs, 2);
    if (sent) {
      await clearPending();
      return;
    }

    console.warn("Gemini send button not ready; pending prompt retained.");
  };

  const scheduleDelivery = (options) => {
    if (delivering) {
      queuedOptions = options;
      return;
    }
    delivering = true;
    runDelivery(options)
      .catch((error) => {
        console.warn("Failed to deliver Gemini prompt.", error);
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
