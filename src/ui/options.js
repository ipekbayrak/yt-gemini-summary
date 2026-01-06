import { getDefaultSettings } from "../shared/constants.js";
import { getSettings, setSettings } from "../shared/storage.js";

const form = document.getElementById("options-form");
const languageInput = document.getElementById("language");
const autoSendInput = document.getElementById("autoSend");
const openInNewTabInput = document.getElementById("openInNewTab");
const hoverOnlyInput = document.getElementById("showButtonOnHoverOnly");
const sendDelayInput = document.getElementById("sendDelayMs");
const promptTemplateInput = document.getElementById("promptTemplate");
const resetButton = document.getElementById("resetButton");
const status = document.getElementById("status");

let statusTimer = null;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const showStatus = (message) => {
  status.textContent = message;
  status.classList.add("is-visible");
  if (statusTimer) {
    clearTimeout(statusTimer);
  }
  statusTimer = setTimeout(() => {
    status.classList.remove("is-visible");
  }, 1500);
};

const sanitizeLanguage = (value) => (value === "en" ? "en" : "tr");

const normalizeDelay = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return clamp(parsed, 0, 2000);
};

const populateForm = (settings) => {
  const defaults = getDefaultSettings();
  const safe = { ...defaults, ...(settings || {}) };
  languageInput.value = sanitizeLanguage(safe.language);
  autoSendInput.checked = Boolean(safe.autoSend);
  openInNewTabInput.checked = Boolean(safe.openInNewTab);
  hoverOnlyInput.checked = Boolean(safe.showButtonOnHoverOnly);
  sendDelayInput.value = normalizeDelay(safe.sendDelayMs, defaults.sendDelayMs);
  promptTemplateInput.value = safe.promptTemplate || defaults.promptTemplate;
};

const readForm = () => {
  const defaults = getDefaultSettings();
  return {
    language: sanitizeLanguage(languageInput.value),
    autoSend: autoSendInput.checked,
    openInNewTab: openInNewTabInput.checked,
    showButtonOnHoverOnly: hoverOnlyInput.checked,
    sendDelayMs: normalizeDelay(sendDelayInput.value, defaults.sendDelayMs),
    promptTemplate: promptTemplateInput.value || defaults.promptTemplate,
  };
};

const handleSave = async (event) => {
  event.preventDefault();
  const payload = readForm();
  sendDelayInput.value = payload.sendDelayMs;
  await setSettings(payload);
  showStatus("Saved");
};

const handleReset = async () => {
  const defaults = getDefaultSettings();
  await setSettings(defaults);
  populateForm(defaults);
  showStatus("Reset to defaults");
};

const init = async () => {
  const settings = await getSettings();
  populateForm(settings);
};

form.addEventListener("submit", handleSave);
resetButton.addEventListener("click", handleReset);
init().catch(() => populateForm(getDefaultSettings()));
