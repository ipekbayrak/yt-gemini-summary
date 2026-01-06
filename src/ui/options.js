import { DEFAULT_SETTINGS } from "../shared/constants.js";
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

const normalizeDelay = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_SETTINGS.sendDelayMs;
  }
  return clamp(parsed, 0, 2000);
};

const populateForm = (settings) => {
  const safe = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  languageInput.value = sanitizeLanguage(safe.language);
  autoSendInput.checked = Boolean(safe.autoSend);
  openInNewTabInput.checked = Boolean(safe.openInNewTab);
  hoverOnlyInput.checked = Boolean(safe.showButtonOnHoverOnly);
  sendDelayInput.value = normalizeDelay(safe.sendDelayMs);
  promptTemplateInput.value = safe.promptTemplate || DEFAULT_SETTINGS.promptTemplate;
};

const readForm = () => ({
  language: sanitizeLanguage(languageInput.value),
  autoSend: autoSendInput.checked,
  openInNewTab: openInNewTabInput.checked,
  showButtonOnHoverOnly: hoverOnlyInput.checked,
  sendDelayMs: normalizeDelay(sendDelayInput.value),
  promptTemplate: promptTemplateInput.value || DEFAULT_SETTINGS.promptTemplate,
});

const handleSave = async (event) => {
  event.preventDefault();
  const payload = readForm();
  sendDelayInput.value = payload.sendDelayMs;
  await setSettings(payload);
  showStatus("Saved");
};

const handleReset = async () => {
  await setSettings(DEFAULT_SETTINGS);
  populateForm(DEFAULT_SETTINGS);
  showStatus("Reset to defaults");
};

const init = async () => {
  const settings = await getSettings();
  populateForm(settings);
};

form.addEventListener("submit", handleSave);
resetButton.addEventListener("click", handleReset);
init().catch(() => populateForm(DEFAULT_SETTINGS));
