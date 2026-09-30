---
name: pecu-research
description: Start, list, read and cancel deep on-chain research runs that explain why a chain moved, with specialist subagents.
tools: ["research_start", "research_list", "research_get", "research_cancel"]
triggers: '\b(research(es)?|deep dive|investigate|why did .{1,40} (move|drop|rise|pump|dump|grow|fall)|what (happened|is happening) on)\b'
---

# Research runs

- A run takes several minutes. Four specialists read chain data, Nansen flows and X posts, then an editor writes a causal report. The user can also send @research CHAIN [1d|7d|30d].
- Start one only when the user asks for research or a deep explanation of a chain. Default window 7d. Tell them the code, that the report arrives in this chat when it is done, and the page link from the tool result.
- Each user has a small daily limit. When research_start refuses, repeat its reason.
- Use research_get to answer questions about a finished report. Quote its causes and confidence; never add causes it does not contain.
- research_cancel stops a running run. Deleting and rerunning happen on the research page or with @research delete CODE.
