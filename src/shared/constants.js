export const SETTINGS_KEY = "settings";
export const PENDING_KEY = "pendingPrompt";

export const SUPPORTED_LANGUAGES = ["en", "es", "hi", "ar", "tr"];

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

export const DEFAULT_PROMPT_TEMPLATE_ES = `Resume este video de YouTube en español.
Título: {title}
Canal: {channel}
URL: {url}

Formato:
- Resumen en 8-12 viñetas
- 3 ideas principales
- Si es un tutorial: pasos accionables`;

export const DEFAULT_PROMPT_TEMPLATE_HI = `इस YouTube वीडियो का हिंदी में सारांश दें।
शीर्षक: {title}
चैनल: {channel}
URL: {url}

फ़ॉर्मैट:
- 8-12 बुलेट में सारांश
- 3 मुख्य निष्कर्ष
- यदि यह ट्यूटोरियल है: चरण-दर-चरण कार्य`;

export const DEFAULT_PROMPT_TEMPLATE_AR = `لخّص هذا الفيديو من YouTube بالعربية.
العنوان: {title}
القناة: {channel}
الرابط: {url}

التنسيق:
- ملخص من 8-12 نقاط
- 3 استنتاجات رئيسية
- إذا كان تعليميًا: خطوات عملية`;

export const normalizeLanguage = (value) => {
  if (!value) {
    return "en";
  }
  const normalized = String(value).toLowerCase();
  const base = normalized.split("-")[0];
  return SUPPORTED_LANGUAGES.includes(base) ? base : "en";
};

export const getDefaultLanguage = () => {
  try {
    const uiLanguage =
      chrome?.i18n?.getUILanguage?.() ||
      navigator?.language ||
      navigator?.languages?.[0] ||
      "";
    return normalizeLanguage(uiLanguage);
  } catch (error) {
    // Fallback below.
  }
  return "en";
};

export const getDefaultPromptTemplate = (language) => {
  switch (normalizeLanguage(language)) {
    case "tr":
      return DEFAULT_PROMPT_TEMPLATE_TR;
    case "es":
      return DEFAULT_PROMPT_TEMPLATE_ES;
    case "hi":
      return DEFAULT_PROMPT_TEMPLATE_HI;
    case "ar":
      return DEFAULT_PROMPT_TEMPLATE_AR;
    case "en":
    default:
      return DEFAULT_PROMPT_TEMPLATE_EN;
  }
};

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
