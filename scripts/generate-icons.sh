#!/bin/sh
# Regenerate each icon from its original artwork (macOS sips).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICONS="$ROOT/icons"
SOURCES="$ICONS/sources"

for size in 16 32 48 128; do
  source="$SOURCES/icon${size}.png"
  if [ ! -f "$source" ]; then
    echo "Source not found: $source" >&2
    exit 1
  fi
  width=$(sips -g pixelWidth "$source" | awk '/pixelWidth:/ {print $2}')
  height=$(sips -g pixelHeight "$source" | awk '/pixelHeight:/ {print $2}')
  side="$width"
  if [ "$height" -lt "$width" ]; then side="$height"; fi
  sips -s format png -c "$side" "$side" "$source" --out "$ICONS/icon${size}.png" >/dev/null
  sips -z "$size" "$size" "$ICONS/icon${size}.png" >/dev/null
  echo "Wrote icon${size}.png"
done
