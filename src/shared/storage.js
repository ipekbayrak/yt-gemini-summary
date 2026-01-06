import { getDefaultSettings, PENDING_KEY, SETTINGS_KEY } from "./constants.js";

function storageGet(key) {
  if (!chrome?.storage?.local) {
    return Promise.resolve({});
  }

  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(key, (result) => {
        const error = chrome.runtime?.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve(result || {});
      });
    } catch (error) {
      reject(error);
    }
  });
}

function storageSet(values) {
  if (!chrome?.storage?.local) {
    return Promise.resolve();
  }

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

function storageRemove(key) {
  if (!chrome?.storage?.local) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.remove(key, () => {
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

function normalizeObject(value) {
  return value && typeof value === "object" ? value : {};
}

export async function getSettings() {
  const defaults = getDefaultSettings();
  try {
    const result = await storageGet(SETTINGS_KEY);
    const stored = normalizeObject(result[SETTINGS_KEY]);
    return { ...defaults, ...stored };
  } catch (error) {
    return { ...defaults };
  }
}

export async function setSettings(partial) {
  const updates = normalizeObject(partial);
  const defaults = getDefaultSettings();
  try {
    const current = await getSettings();
    const merged = { ...current, ...updates };
    await storageSet({ [SETTINGS_KEY]: merged });
    return merged;
  } catch (error) {
    const merged = { ...defaults, ...updates };
    return merged;
  }
}

export async function getPending() {
  try {
    const result = await storageGet(PENDING_KEY);
    return result[PENDING_KEY] ?? null;
  } catch (error) {
    return null;
  }
}

export async function setPending(pending) {
  try {
    await storageSet({ [PENDING_KEY]: pending ?? null });
  } catch (error) {
    // Ignore storage errors; caller can retry later.
  }
}

export async function clearPending() {
  try {
    await storageRemove(PENDING_KEY);
  } catch (error) {
    // Ignore storage errors; caller can retry later.
  }
}
