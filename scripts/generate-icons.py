#!/usr/bin/env python3
"""Generate extension PNG icons from their individual sources (requires Pillow)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "icons"
SOURCES = ICONS / "sources"


def main() -> None:
    try:
        from PIL import Image
    except ImportError:
        print("Install Pillow (pip install pillow) or run scripts/generate-icons.sh on macOS.")
        raise SystemExit(1) from None

    ICONS.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 128):
        source = SOURCES / f"icon{size}.png"
        if not source.is_file():
            print(f"Source not found: {source}")
            raise SystemExit(1)
        with Image.open(source) as original:
            img = original.convert("RGBA")
        side = min(img.size)
        left = (img.width - side) // 2
        top = (img.height - side) // 2
        square = img.crop((left, top, left + side, top + side))
        resized = square.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(ICONS / f"icon{size}.png")
        print(f"Wrote icon{size}.png")


if __name__ == "__main__":
    main()
