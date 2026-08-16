# One beeui contract, owned by tool-presentation

Bee's generative-UI vocabulary (the fenced ```beeui``` blocks) is defined once
in `packages/tool-presentation/src/beeui.ts`: the zod component schema, fence
extraction, identifier scrubbing, follow-up derivation (first-focus, Web3 and
generic confirmations, questions), and the channel-neutral Markdown rendering
used by text channels. Web and mobile wrap it and render components natively;
the CLI and iMessage bridge consume the Markdown projection. This replaces
four independently drifting parsers (web and mobile carried near-verbatim zod
copies, the CLI and bridge each hand-rolled their own), which had already
produced real divergence: the CLI recognized a Web3 confirmation only when
`action === "web3"` while the agent emits operation names like `swap`, and
web/mobile silently dropped a whole block when it contained one unknown
component type. Unified semantics are strict and forward-compatible: an
invalid known component drops the entire block so malformed generated JSON can
never leak; an unknown component type degrades to an "unsupported" card
(rendered as "open BeeGreat" copy on text channels, skipped by the apps);
a Web3 confirmation is surfaced only when a reply contains exactly one
action-bound confirm card. New component types are added in one place and
every client follows.
