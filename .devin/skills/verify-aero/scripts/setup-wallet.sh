#!/usr/bin/env bash
# One-time per machine: create (or restore) the verify-aero wallet inside
# AERO_VERIFY_HOME. The CLI prints a fresh mnemonic once; it reaches the
# terminal and is never captured to a file.
#
# Usage:
#   scripts/setup-wallet.sh            create a fresh wallet (no-op if one exists)
#   scripts/setup-wallet.sh --force    overwrite an existing wallet
#   AERO_VERIFY_MNEMONIC="w1 ... w12" scripts/setup-wallet.sh   restore instead
set -euo pipefail

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
AERO="$SCRIPT_DIR/aero"

if [ ! -x /usr/bin/expect ]; then
  echo "setup-wallet needs /usr/bin/expect (macOS ships it at that path)" >&2
  exit 1
fi

AERO_VERIFY_HOME="${AERO_VERIFY_HOME:-$HOME/.aero-verify}"
# Check isolation before creating directories or a passphrase.
bun "$SCRIPT_DIR/safety.ts" "$AERO_VERIFY_HOME"
mkdir -p "$AERO_VERIFY_HOME/wallet" "$AERO_VERIFY_HOME/cache" "$AERO_VERIFY_HOME/indices" "$AERO_VERIFY_HOME/runs"

if [ ! -f "$AERO_VERIFY_HOME/passphrase" ]; then
  (umask 077 && uuidgen | tr -d '-' | tr 'A-F' 'a-f' > "$AERO_VERIFY_HOME/passphrase")
  chmod 600 "$AERO_VERIFY_HOME/passphrase"
fi

# shellcheck source=env.sh
source "$SCRIPT_DIR/env.sh"

FORCE=0
if [ "${1:-}" = "--force" ]; then
  FORCE=1
fi

if [ -f "$SUGAR_WALLET_DIR/wallet.enc" ] && [ "$FORCE" = 0 ]; then
  "$AERO" wallet status
  echo "Wallet already present at $SUGAR_WALLET_DIR (pass --force to overwrite)."
  exit 0
fi

export AERO_CLI="$AERO"

if [ -n "${AERO_VERIFY_MNEMONIC:-}" ]; then
  /usr/bin/expect - <<'EXPECT'
    log_user 1
    set timeout 120
    set mnemonic $env(AERO_VERIFY_MNEMONIC)
    spawn /bin/bash $env(AERO_CLI) wallet restore
    expect {
      -re {A local wallet already exists\. Overwrite it\?} { send "y\r"; exp_continue }
      {Mnemonic (input hidden): } { send -- "$mnemonic\r"; exp_continue }
      -re {Use 0x[0-9a-fA-F]+\?} { send "y\r"; exp_continue }
      timeout { puts stderr "timed out waiting for aero wallet restore"; exit 1 }
      eof {}
    }
    catch wait result
    exit [lindex $result 3]
EXPECT
else
  # The CLI prints the mnemonic exactly once. log_user stays on so it reaches
  # the terminal; nothing here writes it to a file.
  /usr/bin/expect - <<'EXPECT'
    log_user 1
    set timeout 120
    spawn /bin/bash $env(AERO_CLI) wallet create
    expect {
      -re {A local wallet already exists\. Overwrite it\?} { send "y\r"; exp_continue }
      -re {Use 0x[0-9a-fA-F]+\?} { send "y\r"; exp_continue }
      timeout { puts stderr "timed out waiting for aero wallet create"; exit 1 }
      eof {}
    }
    catch wait result
    exit [lindex $result 3]
EXPECT
fi

ADDRESS="$("$AERO" wallet status | grep -oE '0x[0-9a-fA-F]{40}' | head -1)"
echo "Verify wallet: ${ADDRESS:-unknown} ($SUGAR_WALLET_DIR)"
echo "Send at least 0.002 ETH on Base (8453) to ${ADDRESS:-the address above}; nothing else is needed, the suite buys USDC/AERO itself"
