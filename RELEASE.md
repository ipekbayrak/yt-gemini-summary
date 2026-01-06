# Release Guide

## Version bump
- `manifest.json` içindeki `version` alanını güncelleyin.
- Gerekirse README ve dokümanları güncelleyin.

## Zip hazırlama
- Repo kökünde şu dosyaları zipleyin:
  - `manifest.json`
  - `src/`
  - `assets/`
  - `README.md`
  - `PRIVACY.md`
  - `TEST_CHECKLIST.md`
  - `RELEASE.md`

Örnek:

```bash
zip -r yt-gemini-summary-v0.1.0.zip manifest.json src assets README.md PRIVACY.md TEST_CHECKLIST.md RELEASE.md
```

## Chrome Web Store notları
- `tabs`: Gemini sekmesi açma/aktif etme için.
- `storage`: Ayarlar ve bekleyen prompt için.
- `host_permissions`: YouTube ve Gemini içerik scriptleri için.
