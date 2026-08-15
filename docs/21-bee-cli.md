# 21 — Bee CLI

The Bee CLI (`apps/cli`) is the terminal client for Bee. It talks to the same
agent as every other client (Flue conversation at `BEE_AGENT_URL`, Clerk OAuth
with PKCE, thread state in `~/.config/beegreat/cli.json`) and shares the
channel contracts through `@beegreat/tool-presentation`.

## Surfaces

- `bee` — interactive TUI (OpenTUI, alternate screen).
- `bee ask <message>` / `bee <message>` / piped stdin — one-shot answer with
  plain-text degradation, tool progress on stderr.
- `bee new`, `bee login`, `bee logout`, `bee telegram …`, `bee imessage …`,
  `bee buddytg …`, `bee help`.

## TUI interaction model

- **Composer.** Multiline textarea. `⏎` sends; `⇧⏎` / `⌥⏎` / `ctrl+j` insert a
  newline. The composer grows up to six lines. `↑↓` navigate prompt history
  while the buffer is a single line; inside a multiline draft they move the
  cursor. Slash commands (`/new`, `/clear`, `/help`, `/exit`) autocomplete with
  fuzzy matching and `tab` completion.
- **Streaming.** Assistant replies render as markdown (headings, bold, lists,
  code, tables) and stream in place. Every agent tool call is one activity line
  that updates in place: spinner while running, `✓`/`✗` when finished, using
  the shared `getToolCopy` labels. The footer shows an animated spinner with
  elapsed time while Bee works.
- **Queueing.** Typing while Bee works is allowed; `⏎` queues the message and
  it is sent when the current turn finishes. `ctrl+c` clears a non-empty
  composer, exits otherwise.

## Ask-user and confirmations (interactive prompts)

When a reply carries a `question`, `confirm`, `first_focus`, or pending Web3
confirmation, the TUI raises an interactive select panel instead of asking the
user to type numbers or yes/no:

- **Questions** (the agent's ask-user tool): one select per question with the
  bounded options plus a "Type something else" row; multi-question cards step
  through `1/2`, `2/2` and submit the shared global option numbers (`1, 4`) so
  `resolveBeeQuestionAnswer` maps them to explicit natural-language answers.
  The transcript shows the chosen labels, not the numbers.
- **Confirmations**: a Yes/No select. Yes/no submit the exact text replies the
  session layer already validates against canonical Convex state (Web3 actions
  are re-checked before any decision is applied; linked-EOA actions still
  degrade to "Open BeeGreat to sign" and never arm a text confirmation).
- `esc` dismisses any prompt to type a free-form answer instead. Prompts never
  appear in the one-shot `bee ask` path, which keeps the numbered-text
  degradation shared with iMessage.

## Channel degradation parity

The CLI projects every `beeui` component to text via `apps/cli/src/reply.ts`:
`devin` cards include the session URL and pull-request links, and unknown
component types degrade to "Bee shared an interactive card the terminal can't
display. Open BeeGreat to continue." — the same decision the iMessage bridge
makes. Machine ids are scrubbed everywhere (`scrubIdentifiers`).
