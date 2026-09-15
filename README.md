# Preview link tab

Chrome Manifest V3 extension inspired by Arc's Peek Preview.

## Usage

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder.
5. On a web page, **Alt + click** a link to preview it (shortcut is configurable).

- **Esc** closes the preview.
- Sidebar buttons: back/forward, refresh, copy URL, pin, compact window, new tab, close.
- **Alt + Shift + P** previews the last hovered link.
- Right-click a link → **Preview with Preview link tab**.

The global shortcut can be changed in `chrome://extensions/shortcuts`. While an
overlay is open, `R`, `O`, `C`, `P`, and the left/right arrow keys respectively
refresh, open in a tab, copy, pin, and navigate its preview history.

## Per-domain rules

In **Comportement**, add one rule per line in the form
`domain = overlay`, `domain = compact`, or `domain = blocked`. A more specific
subdomain rule takes precedence. Domain lists also accept URLs and `*.domain`.

Click the extension icon for full settings.

## Branding

Toolbar and store icons are generated from [`Preview link tab logo.png`](Preview%20link%20tab%20logo.png). Regenerate sizes with:

```bash
./scripts/generate-icons.sh
```

## Limits

Some sites block embedded previews (`X-Frame-Options` / CSP). Use the compact window or a new tab instead.

## Tests

With a current Node.js installation, run:

```bash
npm test
```
