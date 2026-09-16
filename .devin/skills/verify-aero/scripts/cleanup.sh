#!/usr/bin/env bash
# Remove disposable verify-aero state. Keeps the wallet, the passphrase, the
# regression baseline, and every run's evidence.
set -euo pipefail

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
# shellcheck source=env.sh
source "$SCRIPT_DIR/env.sh"

removed=()

# Cleanup participates in the same exclusive lock protocol as the runner.
# Never remove an existing lock, including an empty file a runner just created.
if ! (set -o noclobber; printf '{"pid":%s,"at":0}\n' "$$" > "$AERO_VERIFY_HOME/run.lock") 2>/dev/null; then
  pid="$(grep -oE '"pid":[0-9]+' "$AERO_VERIFY_HOME/run.lock" 2>/dev/null | grep -oE '[0-9]+' | head -1 || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "Cleanup refused: run.lock belongs to live pid $pid. Wait for the runner to finish." >&2
  else
    echo "Cleanup refused: existing run.lock. Verify no runner or CLI child remains, reconcile executions, then remove the lock manually before retrying." >&2
  fi
  exit 1
fi
trap 'rm -f "$AERO_VERIFY_HOME/run.lock"' EXIT

for path in "$AERO_CACHE_DIR" "$AERO_INDEX_DIR" "$AERO_ALM_CONFIG" "$SUGAR_WALLET_DIR/alm-state.json"; do
  if [ -e "$path" ]; then
    rm -rf "$path"
    removed+=("$path")
  fi
done

if [ -d "$AERO_VERIFY_HOME/runs" ]; then
  for tmp in "$AERO_VERIFY_HOME"/runs/*/tmp; do
    if [ -e "$tmp" ]; then
      rm -rf "$tmp"
      removed+=("$tmp")
    fi
  done
fi

if [ ${#removed[@]} -eq 0 ]; then
  echo "Nothing to clean under $AERO_VERIFY_HOME"
else
  printf 'Removed %s\n' "${removed[@]}"
fi
echo "Kept wallet/, passphrase, baseline.json, and runs/*/ evidence."
