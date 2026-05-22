# Preview link tab

Chrome Manifest V3 extension inspired by Arc's Peek Preview.

## Usage

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder.
5. On a web page, **Alt + click** a link to preview it (shortcut is configurable).

- **Esc** closes the preview.
- Sidebar buttons: refresh, copy URL, compact window, new tab, close.
- **Alt + Shift + P** previews the last hovered link.
- Right-click a link → **Preview with Preview link tab**.

Click the extension icon for full settings.

## Branding

Toolbar and store icons are generated from [`Preview link tab logo.png`](Preview%20link%20tab%20logo.png). Regenerate sizes with:

```bash
./scripts/generate-icons.sh
```

## Limits

Some sites block embedded previews (`X-Frame-Options` / CSP). Use the compact window or a new tab instead.
