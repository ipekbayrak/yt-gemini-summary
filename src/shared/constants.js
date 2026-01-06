export const SETTINGS_KEY = "settings";
export const PENDING_KEY = "pendingPrompt";

export const DEFAULT_PROMPT_TEMPLATE = `Bu YouTube videosunu Türkçe özetle.
Başlık: {title}
Kanal: {channel}
URL: {url}

Format:
- 8-12 madde özet
- 3 ana çıkarım
- Eğer öğreticiyse: adım adım yapılacaklar`;

export const DEFAULT_SETTINGS = {
  language: "tr",
  autoSend: true,
  openInNewTab: true,
  showButtonOnHoverOnly: true,
  sendDelayMs: 150,
  promptTemplate: DEFAULT_PROMPT_TEMPLATE,
};
