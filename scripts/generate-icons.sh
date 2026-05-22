#!/bin/sh
# Regenerate manifest icons from the project logo (macOS sips).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGO="$ROOT/Preview link tab logo.png"
ICONS="$ROOT/icons"

if [ ! -f "$LOGO" ]; then
  echo "Logo not found: $LOGO" >&2
  exit 1
fi

for size in 16 48 128; do
  sips -z "$size" "$size" "$LOGO" --out "$ICONS/icon${size}.png" >/dev/null
  echo "Wrote icon${size}.png"
done
