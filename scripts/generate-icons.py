#!/usr/bin/env python3
"""Generate extension PNG icons from Preview link tab logo.png (requires Pillow)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "Preview link tab logo.png"
ICONS = ROOT / "icons"


def main() -> None:
    try:
        from PIL import Image
    except ImportError:
        print("Install Pillow (pip install pillow) or run scripts/generate-icons.sh on macOS.")
        raise SystemExit(1) from None

    if not LOGO.is_file():
        print(f"Logo not found: {LOGO}")
        raise SystemExit(1)

    ICONS.mkdir(parents=True, exist_ok=True)
    img = Image.open(LOGO).convert("RGBA")
    for size in (16, 48, 128):
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(ICONS / f"icon{size}.png")
        print(f"Wrote icon{size}.png")


if __name__ == "__main__":
    main()
