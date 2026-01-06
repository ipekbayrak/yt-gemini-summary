const LOG_PREFIX = "[YT→Gemini]";
const GEMINI_APP_URL = "https://gemini.google.com/app";
const GEMINI_MATCH_PATTERN = "https://gemini.google.com/*";
const PENDING_KEY = "pendingPrompt";
const REQUEST_TIMEOUT_MS = 15000;
const MENU_ID = "yt-gemini-summary-link";

let currentRequestId = null;
let activeDelivery = {
  requestId: null,
  tabId: null,
  timeoutId: null,
  listener: null,
};

const logInfo = (...args) => console.info(LOG_PREFIX, ...args);
const logWarn = (...args) => console.warn(LOG_PREFIX, ...args);

function uuidv4() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isYoutubeUrl(rawUrl) {
  if (!rawUrl) {
    return false;
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname !== "www.youtube.com") {
      return false;
    }
    return (
      parsed.pathname.startsWith("/watch") ||
      parsed.pathname.startsWith("/shorts")
    );
  } catch (error) {
    logWarn("Invalid URL provided.", error);
    return false;
  }
}

function storageSet(values) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(values, () => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function tabsQuery(queryInfo) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.query(queryInfo, (tabs) => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve(tabs || []);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function tabsUpdate(tabId, updateProps) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.update(tabId, updateProps, (tab) => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve(tab);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function tabsCreate(createProps) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.create(createProps, (tab) => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve(tab);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function tabsSendMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function clearActiveDelivery() {
  if (activeDelivery.listener) {
    chrome.tabs.onUpdated.removeListener(activeDelivery.listener);
  }
  if (activeDelivery.timeoutId) {
    clearTimeout(activeDelivery.timeoutId);
  }
  activeDelivery = {
    requestId: null,
    tabId: null,
    timeoutId: null,
    listener: null,
  };
}

async function setPendingPrompt(pending) {
  try {
    await storageSet({ [PENDING_KEY]: pending });
  } catch (error) {
    logWarn("Failed to persist pending prompt.", error);
  }
}

async function getOrCreateGeminiTab() {
  const tabs = await tabsQuery({ url: GEMINI_MATCH_PATTERN });
  const existing = tabs.find((tab) => tab && tab.id !== undefined);
  if (existing?.id !== undefined) {
    const updated = await tabsUpdate(existing.id, {
      active: true,
      url: GEMINI_APP_URL,
    });
    return updated || existing;
  }
  return tabsCreate({ url: GEMINI_APP_URL, active: true });
}

async function deliverPromptToGemini(tabId, requestId) {
  if (requestId !== currentRequestId) {
    return;
  }
  try {
    await tabsSendMessage(tabId, {
      type: "DELIVER_PROMPT",
      payload: { id: requestId },
    });
  } catch (error) {
    logWarn("Failed to deliver prompt to Gemini tab.", error);
  }
}

function waitForTabComplete(tabId, requestId) {
  clearActiveDelivery();
  activeDelivery.requestId = requestId;
  activeDelivery.tabId = tabId;

  const listener = (updatedTabId, changeInfo) => {
    try {
      if (updatedTabId !== tabId) {
        return;
      }
      if (changeInfo.status === "complete") {
        clearActiveDelivery();
        deliverPromptToGemini(tabId, requestId);
      }
    } catch (error) {
      logWarn("Failed to handle tab update.", error);
    }
  };

  activeDelivery.listener = listener;
  chrome.tabs.onUpdated.addListener(listener);
  activeDelivery.timeoutId = setTimeout(() => {
    if (requestId !== currentRequestId) {
      clearActiveDelivery();
      return;
    }
    logWarn("Gemini tab did not finish loading within timeout.");
    clearActiveDelivery();
  }, REQUEST_TIMEOUT_MS);
}

async function openGeminiForPayload(payload) {
  const requestId = uuidv4();
  currentRequestId = requestId;
  clearActiveDelivery();

  const pending = {
    id: requestId,
    url: payload?.url || "",
    title: payload?.title || "",
    channel: payload?.channel || "",
    createdAt: Date.now(),
  };

  await setPendingPrompt(pending);

  let tab;
  try {
    tab = await getOrCreateGeminiTab();
  } catch (error) {
    logWarn("Failed to open Gemini tab.", error);
    return;
  }

  if (!tab?.id) {
    logWarn("Gemini tab was not created.");
    return;
  }

  if (tab.status === "complete") {
    deliverPromptToGemini(tab.id, requestId);
  } else {
    waitForTabComplete(tab.id, requestId);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "OPEN_GEMINI") {
    return;
  }

  openGeminiForPayload(message.payload)
    .then(() => {
      sendResponse?.({ ok: true });
    })
    .catch((error) => {
      logWarn("Failed to handle OPEN_GEMINI message.", error);
      sendResponse?.({ ok: false });
    });

  return true;
});

if (chrome.contextMenus) {
  chrome.runtime.onInstalled.addListener(() => {
    try {
      chrome.contextMenus.removeAll(() => {
        const error = chrome.runtime?.lastError;
        if (error) {
          logWarn("Failed to reset context menus.", error);
        }
        chrome.contextMenus.create(
          {
            id: MENU_ID,
            title: "Summarize with Gemini",
            contexts: ["link"],
          },
          () => {
            const createError = chrome.runtime?.lastError;
            if (createError) {
              logWarn("Failed to create context menu.", createError);
            }
          }
        );
      });
    } catch (error) {
      logWarn("Failed to initialize context menus.", error);
    }
  });

  chrome.contextMenus.onClicked.addListener((info) => {
    try {
      if (info.menuItemId !== MENU_ID) {
        return;
      }
      if (!isYoutubeUrl(info.linkUrl)) {
        return;
      }
      openGeminiForPayload({ url: info.linkUrl, title: "", channel: "" });
    } catch (error) {
      logWarn("Failed to handle context menu click.", error);
    }
  });
} else {
  logInfo("Context menus API not available; permission not granted.");
}

chrome.commands?.onCommand?.addListener((command) => {
  if (command !== "summarize-with-gemini") {
    return;
  }
  tabsQuery({ active: true, currentWindow: true })
    .then((tabs) => {
      const activeTab = tabs?.[0];
      if (!activeTab?.url || !isYoutubeUrl(activeTab.url)) {
        return;
      }
      openGeminiForPayload({
        url: activeTab.url,
        title: activeTab.title || "",
        channel: "",
      });
    })
    .catch((error) => {
      logWarn("Failed to handle command.", error);
    });
});
