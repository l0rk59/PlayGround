#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
RUNTIME_DIR="${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}"
if /usr/bin/time -p test -z "${CAPTURE_URL:-}"; then
  echo "capture.sh: CAPTURE_URL is not set" >&2
  exit 1
fi
if /usr/bin/time -p test -z "${CAPTURE_DIR:-}"; then
  echo "capture.sh: CAPTURE_DIR is not set" >&2
  exit 1
fi
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p test -f "$RUNTIME_DIR/scripts/default-capture.mjs"
set +e
/usr/bin/time -p node "$RUNTIME_DIR/scripts/default-capture.mjs"
status=$?
set -e
if /usr/bin/time -p test "$status" -eq 75; then
  echo "capture.sh: temporary navigation/browser infrastructure failure" >&2
  exit 75
fi
if /usr/bin/time -p test "$status" -ne 0; then
  echo "capture.sh: capture run failed (exit $status)" >&2
  exit 1
fi
/usr/bin/time -p test -f "$CAPTURE_DIR/final-desktop.png"
/usr/bin/time -p test -f "$CAPTURE_DIR/final-mobile.png"
/usr/bin/time -p test -s "$CAPTURE_DIR/final-desktop.png"
/usr/bin/time -p test -s "$CAPTURE_DIR/final-mobile.png"
echo "capture.sh: wrote $CAPTURE_DIR/final-desktop.png and $CAPTURE_DIR/final-mobile.png (app left running)"
