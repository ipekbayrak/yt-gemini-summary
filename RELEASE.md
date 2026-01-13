# Release Guide

## Version bump checklist
- Update `manifest.json` version.
- Review README status line if needed.
- Re-run manual checks in [TEST_CHECKLIST.md](TEST_CHECKLIST.md).
- Ensure docs are up to date (README/PRIVACY/RELEASE).

## Build extension zips (Chrome/Firefox/Opera)
- Run `npm run build` (or `node scripts/build.js`).
- Outputs land in `dist/`:
  - `yt-gemini-summary-chrome-vX.Y.Z.zip`
  - `yt-gemini-summary-firefox-vX.Y.Z.zip`
  - `yt-gemini-summary-opera-vX.Y.Z.zip`
- Optional: set `FIREFOX_EXTENSION_ID` to embed a fixed Gecko ID.

## Manual zip (fallback)
Include:
- `manifest.json`
- `src/`
- `assets/`
- `_locales/`
- `README.md`
- `PRIVACY.md`
- `TEST_CHECKLIST.md`
- `RELEASE.md`

Exclude:
- `.git/`
- `node_modules/` (if any)
- local dev notes or temp files

Example:

```bash
zip -r yt-gemini-summary-v0.1.0.zip \
  manifest.json src assets _locales README.md PRIVACY.md TEST_CHECKLIST.md RELEASE.md \
  -x ".git/*" "node_modules/*"
```

## Chrome Web Store notes
- `tabs`: open/activate Gemini tab.
- `storage`: store settings and pending prompt.
- `host_permissions`: run content scripts on YouTube and Gemini.
