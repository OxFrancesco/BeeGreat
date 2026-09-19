# Wallet

`aero wallet` manages the encrypted local wallet: `create` generates a fresh mnemonic, `restore` imports one, `status` shows the active wallet's address and storage source, and `remove` deletes it. `aero wallet connect` pairs an external wallet instead. Create, restore, and remove are interactive; setup uses `expect` for create and restore.

## Sub-features

- `wallet-create` generates and seals a new wallet.
- `wallet-restore` imports a known mnemonic.
- `wallet-status` shows the active wallet non-interactively.
- `wallet-remove` deletes the local wallet file.
- `wallet-connect` pairs a browser or WalletConnect wallet (manual only).

## How to get to it (user POV)

- Run `aero wallet create` or `aero wallet restore` in a terminal and answer the prompts.
- Run `aero wallet status` or `aero wallet remove`.
- Run `aero wallet connect --browser` to pair Rabby or another EIP-6963 extension, `aero wallet connect` for a WalletConnect QR session, `aero wallet disconnect` to drop the pairing.

## Driving it with verify-aero

Preconditions:

- `/usr/bin/expect` exists (macOS ships it).
- `SUGAR_WALLET_NO_KEYCHAIN=1` is set by `env.sh`; without it create overwrites the real Keychain wallet.
- `AERO_VERIFY_HOME` points at the verification home, never `~/.config/sugar-ts`.

- **Create.** Run `bash scripts/setup-wallet.sh`. The expect script spawns `aero wallet create`, answers `y` at the `Use 0x...` confirmation, lets the mnemonic reach the terminal once, and prints the address plus the funding note. `wallet.enc` appears under `$AERO_VERIFY_HOME/wallet`.
- **Restore.** Run `AERO_VERIFY_MNEMONIC="word1 ... word12" bash scripts/setup-wallet.sh`. The script answers the hidden mnemonic prompt and the same confirmation.
- **Existing wallet.** Run `bash scripts/setup-wallet.sh` again; it detects `wallet.enc`, prints the address, and exits 0. `--force` overwrites.
- **Status.** Run `scripts/aero wallet status`. Output contains `local encrypted wallet` and the verify address.
- **Remove.** Run `scripts/aero wallet remove` and answer its deletion confirmation. A confirmed removal prints `Local wallet deleted.`; declining keeps the wallet. Use a disposable isolated home for this recipe, preserving the funded verification wallet.
- **Browser and WalletConnect.** `scripts/aero wallet connect --browser` (Rabby/EIP-6963), `scripts/aero wallet connect` (WalletConnect QR), and `scripts/aero wallet disconnect` are manual-only entry points; this suite never drives them.

## Gotchas

- The create prompt needs a TTY; piping stdin fails. That is exactly what `setup-wallet.sh` wraps in expect.
- `wallet status` also reads `wallet.enc` directly for the address; a missing file means `setup-wallet.sh` has not run yet.
- The passphrase for non-interactive signing comes from `$AERO_VERIFY_HOME/passphrase` (0600) or `SUGAR_WALLET_PASSPHRASE`; it is never echoed or written into evidence.
