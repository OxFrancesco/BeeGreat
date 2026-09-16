# verify-aero isolated environment. Source this file; it prints nothing.
#
# Everything the aero CLI writes (wallet, execution journals, ALM config and
# state, token caches, saved indices) lands under AERO_VERIFY_HOME so the real
# wallet at ~/.config/sugar-ts and the cache at ~/.cache/aero stay untouched.

AERO_VERIFY_HOME="${AERO_VERIFY_HOME:-$HOME/.aero-verify}"
export AERO_VERIFY_HOME

# Validate canonical paths before reading secrets or writing verification state.
bun "$(dirname "${BASH_SOURCE[0]}")/safety.ts" "$AERO_VERIFY_HOME" || return 1

# Per-machine settings: $AERO_VERIFY_HOME/env holds plain KEY=VALUE lines
# (# comment lines allowed, no export keyword). Only AERO_VERIFY_RPC and
# SUGAR_* keys are honored, and only when the variable is not already set in
# the environment. Values are never printed. Keep the file at mode 0600 if
# it carries an API-keyed RPC URL.
if [ -f "$AERO_VERIFY_HOME/env" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|\#*) continue ;; esac
    key="${line%%=*}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"
    case "$key" in
      AERO_VERIFY_RPC|SUGAR_*) ;;
      *) continue ;;
    esac
    if [ -z "${!key+x}" ]; then
      value="${line#*=}"
      value="${value%"${value##*[![:space:]]}"}"
      value="${value#"${value%%[![:space:]]*}"}"
      export "$key=$value"
    fi
  done < "$AERO_VERIFY_HOME/env"
fi

export SUGAR_WALLET_DIR="$AERO_VERIFY_HOME/wallet"
# Without this, `aero wallet create` seals into the macOS Keychain entry
# beegreat-sugar-cli/local-wallet and would overwrite the user's real wallet.
export SUGAR_WALLET_NO_KEYCHAIN=1
export AERO_CACHE_DIR="$AERO_VERIFY_HOME/cache"
export AERO_INDEX_DIR="$AERO_VERIFY_HOME/indices"
export AERO_ALM_CONFIG="$AERO_VERIFY_HOME/alm.json"

# Non-interactive signing for tx steps. Never echo this value.
if [ -z "${SUGAR_WALLET_PASSPHRASE:-}" ] && [ -f "$AERO_VERIFY_HOME/passphrase" ]; then
  SUGAR_WALLET_PASSPHRASE="$(cat "$AERO_VERIFY_HOME/passphrase")"
  export SUGAR_WALLET_PASSPHRASE
fi

# RPC selection: AERO_VERIFY_RPC wins, then an ambient SUGAR_RPC_URI_8453,
# then the publicnode endpoint. The SDK's public Alchemy default rate-limits
# the quote path within seconds, so a dedicated endpoint makes runs faster
# (the TUI raises scan concurrency when SUGAR_RPC_URI_8453 is set).
# Exported as SUGAR_RPC_URI_8453 so the CLI and the runner's viem client hit
# the same endpoint.
if [ -n "${AERO_VERIFY_RPC:-}" ]; then
  export SUGAR_RPC_URI_8453="$AERO_VERIFY_RPC"
elif [ -z "${SUGAR_RPC_URI_8453:-}" ]; then
  export SUGAR_RPC_URI_8453="https://base-rpc.publicnode.com"
fi

# SDK profile, picked by the resolved endpoint's throttling model. publicnode
# caps the size of each call, so its profile keeps batches small; keyed
# endpoints like Alchemy throttle on request count, so they win with fewer,
# larger calls (the SDK's default sizes, serialized to one worker). Values in
# $AERO_VERIFY_HOME/env or the process environment always win.
_av_default() {
  # $1 = chain-suffixed key, $2 = bare key, $3 = fallback value
  if [ -z "${!1:-}" ] && [ -z "${!2:-}" ]; then
    export "$1=$3"
  fi
}
_av_default SUGAR_THREADING_MAX_WORKERS_8453 SUGAR_THREADING_MAX_WORKERS 1
_av_default SUGAR_QUOTE_MAX_PATHS_8453 SUGAR_QUOTE_MAX_PATHS 200
if [ "$SUGAR_RPC_URI_8453" = "https://base-rpc.publicnode.com" ]; then
  _av_default SUGAR_QUOTE_BATCH_SIZE_8453 SUGAR_QUOTE_BATCH_SIZE 8
  _av_default SUGAR_PRICE_BATCH_SIZE_8453 SUGAR_PRICE_BATCH_SIZE 8
  _av_default SUGAR_POOL_PAGINATION_MAX_SIZE_8453 SUGAR_POOL_PAGINATION_MAX_SIZE 75
else
  _av_default SUGAR_QUOTE_BATCH_SIZE_8453 SUGAR_QUOTE_BATCH_SIZE 64
  _av_default SUGAR_PRICE_BATCH_SIZE_8453 SUGAR_PRICE_BATCH_SIZE 40
  _av_default SUGAR_POOL_PAGINATION_MAX_SIZE_8453 SUGAR_POOL_PAGINATION_MAX_SIZE 400
fi
