import {
  getDefaultPromptTemplate,
  getDefaultSettings,
  SUPPORTED_LANGUAGES,
} from "../shared/constants.js";
import { getSettings, setSettings } from "../shared/storage.js";

const form = document.getElementById("options-form");
const languageInput = document.getElementById("language");
const autoSendInput = document.getElementById("autoSend");
const openInNewTabInput = document.getElementById("openInNewTab");
const hoverOnlyInput = document.getElementById("showButtonOnHoverOnly");
const sendDelayInput = document.getElementById("sendDelayMs");
const promptTemplateInput = document.getElementById("promptTemplate");
const templateExampleBody = document.getElementById("templateExampleBody");
const resetButton = document.getElementById("resetButton");
const status = document.getElementById("status");

let statusTimer = null;
let lastLanguage = null;

const getMessage = (key, fallback = "") =>
  chrome?.i18n?.getMessage?.(key) || fallback;

const applyLocalization = () => {
  const uiLanguage = chrome?.i18n?.getUILanguage?.();
  if (uiLanguage) {
    document.documentElement.lang = uiLanguage;
    document.documentElement.dir = uiLanguage.toLowerCase().startsWith("ar")
      ? "rtl"
      : "ltr";
  }
  const nodes = document.querySelectorAll("[data-i18n]");
  nodes.forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (!key) {
      return;
    }
    const message = getMessage(key);
    if (message) {
      node.textContent = message;
    }
  });
};

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

const SUPPORTED_LANGUAGE_SET = new Set(SUPPORTED_LANGUAGES);
const sanitizeLanguage = (value) =>
  SUPPORTED_LANGUAGE_SET.has(value) ? value : "en";

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
  lastLanguage = sanitizeLanguage(safe.language);
  updateTemplateExample(lastLanguage);
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

const updateTemplateExample = (language) => {
  if (!templateExampleBody) {
    return;
  }
  templateExampleBody.textContent = getDefaultPromptTemplate(language);
};

const handleLanguageChange = () => {
  const nextLanguage = sanitizeLanguage(languageInput.value);
  const previousLanguage = lastLanguage;
  const currentTemplate = promptTemplateInput.value.trim();
  const previousDefault = previousLanguage
    ? getDefaultPromptTemplate(previousLanguage)
    : "";
  if (!currentTemplate || (previousDefault && currentTemplate === previousDefault)) {
    promptTemplateInput.value = getDefaultPromptTemplate(nextLanguage);
  }
  updateTemplateExample(nextLanguage);
  lastLanguage = nextLanguage;
};

const handleSave = async (event) => {
  event.preventDefault();
  const payload = readForm();
  sendDelayInput.value = payload.sendDelayMs;
  await setSettings(payload);
  showStatus(getMessage("statusSaved", "Saved"));
};

const handleReset = async () => {
  const defaults = getDefaultSettings();
  await setSettings(defaults);
  populateForm(defaults);
  showStatus(getMessage("statusReset", "Reset to defaults"));
};

const init = async () => {
  applyLocalization();
  document.title = getMessage("optionsTitle", document.title);
  const settings = await getSettings();
  populateForm(settings);
};

form.addEventListener("submit", handleSave);
resetButton.addEventListener("click", handleReset);
languageInput.addEventListener("change", handleLanguageChange);
init().catch(() => populateForm(getDefaultSettings()));
