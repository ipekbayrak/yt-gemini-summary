export const SETTINGS_KEY = "settings";
export const PENDING_KEY = "pendingPrompt";

export const DEFAULT_PROMPT_TEMPLATE_TR = `Bu YouTube videosunu Türkçe özetle.
Başlık: {title}
Kanal: {channel}
URL: {url}

Format:
- 8-12 madde özet
- 3 ana çıkarım
- Eğer öğreticiyse: adım adım yapılacaklar`;

export const DEFAULT_PROMPT_TEMPLATE_EN = `Summarize this YouTube video in English.
Title: {title}
Channel: {channel}
URL: {url}

Format:
- 8-12 bullet summary
- 3 key takeaways
- If it's a tutorial: step-by-step action items`;

export const getDefaultLanguage = () => {
  try {
    const uiLanguage =
      chrome?.i18n?.getUILanguage?.() ||
      navigator?.language ||
      navigator?.languages?.[0] ||
      "";
    const normalized = String(uiLanguage).toLowerCase();
    if (normalized.startsWith("tr")) {
      return "tr";
    }
  } catch (error) {
    // Fallback below.
  }
  return "en";
};

export const getDefaultPromptTemplate = (language) =>
  language === "tr" ? DEFAULT_PROMPT_TEMPLATE_TR : DEFAULT_PROMPT_TEMPLATE_EN;

export const getDefaultSettings = () => {
  const language = getDefaultLanguage();
  return {
    language,
    autoSend: true,
    openInNewTab: true,
    showButtonOnHoverOnly: true,
    sendDelayMs: 150,
    promptTemplate: getDefaultPromptTemplate(language),
  };
};

export const DEFAULT_SETTINGS = getDefaultSettings();
export const DEFAULT_PROMPT_TEMPLATE = DEFAULT_SETTINGS.promptTemplate;
