---
title: Terminal UI
description: Browse every command as a keyboard form, pair wallets, and approve the exact plan on screen.
group: Integrations
---

## Launch

```sh
evm tui
```

The TUI needs an interactive terminal for both input and output. Otherwise it fails with `InvalidInput`. It reads the same environment variables and flags as the CLI, including `--rpc` and `--database`, and uses the same journal. Wallet connections stay open while the TUI runs, so you pair once and sign several times.

## Layout

The left column holds a search box and the list of commands. The right side shows the selected command's description, its form, any pairing link or QR code, and the result.

## Keys

| Key | Action |
| --- | --- |
| Ctrl+K | Focus the command search. Type to filter by name or description. Enter opens the first match. |
| Esc | Return focus to the command list |
| Up and Down | Move through a list |
| Tab | Next field, then the picker below the result |
| Shift+Tab | Previous field |
| Enter in a field | Run the command |
| Ctrl+R | Run the command |
| Ctrl+E | Approve the plan, workflow, batch or typed data shown on screen |
| Ctrl+W | Open the wallet connection form |
| Ctrl+C | Quit |

## Forms

Every catalog command has a form built from its input schema. Text and number fields take plain values. Fields for arrays and objects take JSON, and `args` starts as `[]`. Optional fields can stay empty.

Some fields start filled in:

| Field | Starts as |
| --- | --- |
| `chainId`, `originChainId` | `8453` |
| `destinationChainId` | `42161` |
| `slippage` | `0.5` |
| `key` | A random UUID |
| Boolean fields | `false` |
| `account`, `userAddress`, `receiverAddress` | The selected wallet's address, if the field is empty |

The wallet form offers Browser wallet, WalletConnect and Smart wallet, plus the chain and a name that defaults to `main`. A pairing link or QR code appears in the TUI instead of standard error.

## Pickers

Some results open a picker. Press Tab until it has focus, then choose with Enter.

| After | Picker | Choosing an item |
| --- | --- | --- |
| `inspect` | The contract's functions | Opens `read` for view and pure functions, or `prepare-call` for the rest, with the signature and a fresh key filled in |
| `operations` | Recent operations with state and key | Opens the operation in `status`, ready for review |
| `workspace` | Saved aliases | Opens `inspect` for that alias |

## Review and approve

Running `execute`, `workflow-run`, `bridge-run` or `batch-run` from its form sends no approval, so the command returns `ApprovalRequired`. Approval happens with Ctrl+E on something you have in front of you:

- When the result is a plan in `prepared`, `pending`, `submitting` or `walletPending` state, the screen shows its chain, sender, destination, value, calldata, gas limit, gas price cap and expiry, plus a line with the EOA gas fee cap (`gas × gasPrice`) and the L1 data fee estimate. Ctrl+E executes that plan with its exact fingerprint.
- When the result is a workflow, including `vault`, `lending` and `aero` with a key, Ctrl+E runs it with the workflow fingerprint. Steps still execute one at a time.
- When the result is a bridge or swap, Ctrl+E runs `bridge-run` with the bridge's workflow fingerprint.
- When the result is a prepared batch, Ctrl+E runs `batch-run` with the batch fingerprint.
- After a `sign-typed-data` preview, Ctrl+E signs that digest.

The TUI never uses `--yolo`. An operation left `walletPending`, for example a smart-wallet approval that was interrupted, keeps its Ctrl+E action so you can resume it with the same fingerprint.
