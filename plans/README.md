# Animation improvement plans

All plans were stamped against commit `d9f861d`.

| # | Plan | Severity | Status | Dependencies |
| --- | --- | --- | --- | --- |
| 001 | Stabilize streaming conversation scroll | HIGH | DONE | None |
| 002 | Add one native motion vocabulary | LOW | DONE | None |
| 003 | Make the voice orb accessible and tactile | HIGH | DONE | 002 |
| 004 | Fix Listening Island lifecycle and interruption | HIGH | DONE | 002 |
| 005 | Simplify tool activity motion | HIGH | DONE | None |
| 006 | Reveal vessel honey with a transform | MEDIUM | DONE | 002 |
| 007 | Make reasoning disclosure crisp | MEDIUM | DONE | None |
| 008 | Repair the GolieBee celebration | MEDIUM | DONE | 002 |
| 009 | Standardize reduced-motion entrances | MEDIUM | DONE | 002 |
| 010 | Add restrained task completion feedback | LOW | DONE | 002 |
| 011 | Animate comb progress with a clipped transform | LOW | DONE | 002, 006 |

## Recommended execution order

1. Execute 001, 002, 005, and 007 independently.
2. Execute 003 and 004 together because they share the voice status surface.
3. Execute 006 before 011 so both honey fills use the same clipped-transform model.
4. Execute 008 and 009 after the shared tokens exist.
5. Execute 010 last; it is isolated polish on a high-frequency list interaction.

After implementation, review the complete diff with the `review-animations` standards. The review must block any remaining ease-in UI motion, scale-zero entrance, layout-property animation, high-frequency decorative entrance, missing reduced-motion branch, or orphaned infinite animation.
