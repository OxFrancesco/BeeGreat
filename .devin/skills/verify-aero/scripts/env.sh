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

# publicnode rejects multicall3 batches of the heavy scan reads: five
# concurrent pages of 400 pool tuples, or five price-oracle batches of 40
# tokens, exceed its call cap and the whole batch fails as RPC_READ_FAILED.
# Smaller pages keep each batch under the cap; a dedicated endpoint needs no
# cap and a user pin always wins.
if [ "$SUGAR_RPC_URI_8453" = "https://base-rpc.publicnode.com" ]; then
  if [ -z "${SUGAR_POOL_PAGINATION_MAX_SIZE_8453:-}" ] \
    && [ -z "${SUGAR_POOL_PAGINATION_MAX_SIZE:-}" ]; then
    export SUGAR_POOL_PAGINATION_MAX_SIZE_8453=75
  fi
  if [ -z "${SUGAR_PRICE_BATCH_SIZE_8453:-}" ] \
    && [ -z "${SUGAR_PRICE_BATCH_SIZE:-}" ]; then
    export SUGAR_PRICE_BATCH_SIZE_8453=8
  fi
fi
