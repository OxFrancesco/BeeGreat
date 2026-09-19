# TUI

`aero tui` opens an interactive terminal UI over the same SDK: pool browsing, positions, quotes, and wallet state. It needs a real terminal, so verification drives it inside a `tmux` session with `send-keys` and `capture-pane`. It is not part of the automated runner.

## Sub-features

- `tui-launch` starts the interface in a detached tmux session.
- `tui-navigate` exercises the key bindings from the README.
- `tui-quit` exits cleanly back to the shell.

## How to get to it (user POV)

- Run `aero tui` in a terminal.
- Keys (per the CLI README): `esc` goes back, `ctrl+r` refreshes or reruns the current view, `ctrl+k` opens the command palette, `j` toggles JSON on results, `o` opens a sort picker where a list can be sorted, `enter` on a pool/position/token row opens a picker, `ctrl+c` quits (asks for a second press within three seconds during a broadcast).

## Driving it with verify-aero

Preconditions:

- `tmux` is installed.
- The isolated environment is applied (the wrapper handles this inside the tmux command).

- **Launch.** Run `tmux new-session -d -s aero-tui '.devin/skills/verify-aero/scripts/aero tui; read'`. The session `aero-tui` exists and `tmux capture-pane -t aero-tui -p` shows the TUI's initial screen.
- **Navigate.** Send keys and capture the screen. `tmux send-keys -t aero-tui C-r` refreshes the view, `C-k` opens the command palette, `j` toggles raw JSON on a result, and `enter` on a row opens its picker. Navigate to Analytics → Trade to open the pool sort picker with `o`. `escape` backs out. Capture state with `tmux capture-pane -t aero-tui -p` after each key.
- **Quit.** `tmux send-keys -t aero-tui C-c` exits (a second press within three seconds forces exit during broadcast; do not start a broadcast just to test quitting), then `tmux kill-session -t aero-tui`.
- **Evidence.** Create `$AERO_VERIFY_HOME/runs/<run-id>/tui/` outside the cleanup-owned `tmp/` directory, then save captures with `tmux capture-pane -t aero-tui -p > $AERO_VERIFY_HOME/runs/<run-id>/tui/<capture-name>.txt`.

## Gotchas

- The TUI writes alternate-screen control codes; captured panes contain what is on screen, not scrollback.
- Use a real TTY through tmux; a piped spawn does not prove the interactive screen.
- `ctrl+c` during a broadcast only marks the intent to quit; send it again within three seconds to actually exit. Preserve and inspect any execution journal before recovery.
- This feature is excluded from `verify.ts`; drive it by hand when a TUI change needs a look.
