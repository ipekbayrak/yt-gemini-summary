# YouTube → Gemini Summary (Chrome Extension)

Status: Production ready (v0.1.0)

## What it does
- Adds “🤖 Gemini ile özetle” button on YouTube video + Shorts cards.
- On click opens https://gemini.google.com/app, fills the prompt, and (optionally) auto-sends.

## How it works (high level)
- YouTube content script injects button and extracts URL/title/channel.
- Background service worker opens/reuses Gemini tab and sends a message.
- Gemini content script fills Quill editor (`.ql-editor.textarea.new-input-ui[contenteditable="true"]`) and clicks send (`button.send-button.submit`).

## Install (Developer mode / Load unpacked)
1. Open `chrome://extensions` in Chrome.
2. Enable Developer mode (top-right).
3. Click “Load unpacked” and select the project root folder.

## Usage
- Hover a YouTube card to reveal the button, then click.
- A Gemini tab opens and the summary starts (if Auto-send is enabled).

## Options
- Language: Stored setting for your prompt language; update the template accordingly.
- Auto-send: Automatically clicks send after filling the prompt.
- Open in new tab: Currently stored only; Gemini tab may be reused if already open.
- Hover-only: Show the button only on hover.
- Send delay: Wait time before clicking send (0-2000ms).
- Prompt template: Uses `{title}`, `{channel}`, `{url}` placeholders.

## Known limitations
- Gemini/YouTube DOM can change and may break automation.
- User must be signed into Gemini; if not, the prompt remains pending until sign-in.
- This is UI automation, not an official Gemini API integration.

## Security/Privacy notes
- No external servers.
- Only `chrome.storage.local` is used.
- URL/title/channel are stored locally as `pendingPrompt` only until sent.
- See [PRIVACY.md](PRIVACY.md) for details.

## Contributing
- Issues and PRs are welcome.
- Run through [TEST_CHECKLIST.md](TEST_CHECKLIST.md) before releases.
- Packaging notes are in [RELEASE.md](RELEASE.md).
- Built with ChatGPT 5.2 Codex.

## License
MIT License. See [LICENSE](LICENSE).
