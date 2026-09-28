# Pecu task skills

Pecu's system prompt is `skills/pecu/core/SKILL.md` (response style, transaction and recovery rules, planning, how to load skills) plus a one-line index of the task skills. It is about 3.9 KB, down from 14.3 KB. Everything task-specific lives in eight skills under `skills/pecu/`:

| Skill | Tools | Loads on words like |
| --- | --- | --- |
| `wallet` | `evm_*` | send, transfer, approve, allowance, revoke, contract, a `0x` address |
| `safe` | `safe_*` | multisig, treasury, signers, budget, role, passkey, "my Safe" |
| `aerodrome` | `aero_*` | swap, quote, liquidity, pool, position, stake, claim, stock, buy, sell |
| `aave` | `aave_*` | Aave, lend, borrow, supply, repay, collateral, yield |
| `polymarket` | 10 discovery, price, book and history tools | Polymarket, odds, prediction market |
| `polymarket-data` | every other `polymarket_*`, including research | Polymarket plus leaderboard, positions, trades, holders, PnL, research |
| `nansen` | `nansen_*` | Nansen, flows, who is buying, smart money, PnL, portfolio |
| `funding` | `deposit_*` | deposit, fund, top up, add money, bank |

Each `SKILL.md` declares its tools (exact names, or `prefix_*`; exact names win) and a case-insensitive trigger regex in its frontmatter. These are instructions for the running Pecu agent, not development-assistant skills. The official Aave workflows keep their own `aave_skill` loader inside the `aave` skill.

## Selection

The OpenCode context hook runs before every model step and picks the active skills:

1. Skills whose triggers match the user's message.
2. If none match, the classifier's family when it is at least 90% confident (wallet → wallet + safe, defi → aerodrome + aave + wallet, markets → polymarket, analytics → nansen, funding → funding).
3. If there is still nothing, the skills the previous turn in this chat ended with. "Use this plan" after a liquidity recommendation keeps `aerodrome`. Explanation-only turns do not change this.
4. Plus any skill the model loaded this turn with `load_skills`.

The step then sees `ask_user`, `load_skills`, `wallet_address`, `wallet_balances`, the active skills' tools, and their instructions in one system block that starts `Loaded skills:`. The block is replaced on every step, so loading takes effect on the next step without leaving copies in history. Explanation-only turns still see only `ask_user`.

A missed trigger costs one extra model step: the model reads the index, calls `load_skills`, and continues. A false trigger costs only prompt size. `load_skills` replaced `enable_all_tools`, which exposed the whole 139-tool catalog (about 125 KB of schemas). No step exposes the full catalog anymore.

The same hook serves the ChatGPT subscription and OpenRouter fallback paths, web and X Chat. Deterministic commands bypass inference as before. Confirmation, expiry, receipt recovery, wallet ownership and YOLO enforcement stay in the backend; skills add no tool, signing authority or permission switch.

## Editing and checking

Edit the Markdown skills, then from `apps/pecu`:

```sh
bun run skills:build
bun run typecheck
bun run lint
bun run test
bun run build
```

The generator validates frontmatter (tool patterns, compilable triggers) and bundles everything into `src/agent-skills.generated.json`, so Workers need no filesystem access. Typecheck and build fail when that file is stale. `tests/agent-skills.test.ts` checks tool ownership, trigger selection on sample messages and the selection order. `tests/fixtures/model-routing-check.ts` checks that every registered tool except the four base tools belongs to a skill, loading, carry-over across turns, explanation turns and both inference routes. `tests/command-matrix.test.ts` checks 339 command recipes: every parser verb, all 17 Aero SDK actions, all 52 Polymarket endpoints and every prefix. Parser checks and mocked lifecycles are not live transaction execution.

## Experiment

`scripts/benchmark-agent-skills.ts` compares the previous runtime (saved 14.3 KB prompt, classifier-family tool catalog, `enable_all_tools`) with skills on 17 natural-language scenarios covering every skill, a follow-up acceptance, a message that needs `load_skills`, and a request that must not prepare anything. It replays loading steps, so their latency and tokens count, and stops at the first real tool call. It validates arguments against the real tool schemas and never runs a tool. Provider caching is uncontrolled.

```sh
bun scripts/benchmark-agent-skills.ts ../../reports/pecu-agent-skills-20260928 3
```

Run on 2026-09-28 with GPT-6 Luna (low reasoning) through OpenRouter's OpenAI endpoint, 3 samples per scenario:

| | Previous runtime | Skills |
| --- | --- | --- |
| Expected tool choice | 46/51 | 50/51 |
| Median time to first real tool call, 45 pairs where both passed | 4.90 s | 2.31 s |
| P95, same pairs | 8.15 s | 3.82 s |
| Mean prompt tokens, same pairs | 25,955 | 5,479 |
| Samples that needed an extra loading step | 27 | 3 |

Most of the old time went to `enable_all_tools` expansions followed by a 139-tool step. The three skill loads are the scenario built to need one ("increase my Nvidia exposure", which names no trigger word). Two scenarios were slightly slower with skills (odds 2.7 s vs 1.9 s, Safe info 2.5 s vs 2.2 s medians), within provider noise at 3 samples. The one skills miss read `wallet_address` next to the balance before a send, which the strict rubric counts as a miss but which the self-send rule allows. Raw samples are in `reports/pecu-agent-skills-20260928/`.

## Scope and release

Pecu web and X Chat share the changed harness. BeeGreat mobile, Android, CLI, iMessage and voice use a different harness and need no change. No wire contract or channel rendering changes. The change is live only after the Pecu agent Worker is deployed; no Convex, iMessage bridge or SDK mirror deploy is needed.
