# Components

Open Profile → Developer → Components in a development build. The existing
`/playground` route remains valid. Production builds redirect it to Bee.

Choose Chat, Cards, Basics, or App, then search by component name or example
note. Selecting an entry mounts one preview. The full-width frame separates
its name and controls from the component itself. Return to the list to choose
another example. Reset remounts the category and restores local fixture state
while keeping the selected component open.

The page uses the real mobile components. Task cards and Devin cards expose
presentation components so preview fixtures do not query live records. Task
toggles and Mind view switching use local state. Bookmark and journal previews
report an action instead of navigating with fake IDs. First-focus previews use
a local confirmation callback. Replies appear as "Preview response" and are
not sent to an agent. External documentation links and media actions remain
real controls. Each preview has an error boundary and a Retry button.

Fixtures live in `apps/mobile/src/components/playground/fixtures.ts`. Add an
example with `Specimen` under the matching section. Give it a unique name and
only include a note when it explains a variant or interaction. Each specimen
receives the available width; small variants can use `VariantRow`.

## Task and accessibility examples

Cards includes Tasks saving, Tasks failed update, Tasks large text, Tasks empty,
and Tasks loading. Saving waits two seconds. The failure example rejects its
first update, then allows retry and reopening. These examples use local data.
The large-text example doubles ThemedText sizes inside the preview only.
Device font scaling remains enabled in every screen.

Task cards and project task rows show Saving while an update is pending. A
failed update preserves the task state and offers retry. The shared TaskUpdates
controller rejects duplicate taps until the request settles. Mobile task rows
and subtask controls have a minimum 48-point target. Task titles wrap without
a two-line cap. Web task cards have a minimum 48-pixel target; project toggles
retain their existing 44-pixel controls.

Chat, generated cards, project controls, bookmark previews, and journal cards
use platformSymbol to map SF Symbols to Android Material Symbols. The mapping
also covers tool activity icons. iOS keeps its existing SF Symbols.

## Scope

The Components directory remains mobile-only and development-only. Task update
feedback applies to both mobile and web chat cards and project lists. The CLI
and iMessage have no tappable task rows, so their plain-text presentation stays
unchanged. Agent, voice, Hive, and settings entry points share the same task
records; no wire contract or provider behavior changed. OpenRouter and Codex
are unaffected. No Convex, agent worker, or Railway deployment is required.

Physical checks use the connected Android development build. iOS, unfolded
layout, authenticated server failure, and production deployment require
separate verification. A delayed or failed preview mutation is local fixture
proof only. Follow-up layout work includes wrapping long Devin titles and
checking the same components on iOS and an unfolded display.
