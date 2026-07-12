# 010 — Add restrained task completion feedback

- **Status**: DONE
- **Commit**: d9f861d
- **Severity**: LOW
- **Category**: Missed opportunity
- **Estimated scope**: 1 file, medium

## Problem

`apps/mobile/src/components/goals/task-row.tsx:41-83` instantly swaps the circle/checkmark, color, strikethrough, and due-date presence when `done` changes. Haptics exist, but the visual state has no continuity.

## Target

Keep this frequent action extremely restrained. Render todo and done icons as two stationary overlaid layers driven by one shared progress value. Retarget progress over 120ms with `MotionEasing.out`; crossfade both layers and move only the incoming layer from scale 0.97 to 1. Under reduced motion, keep both scales at 1 and retain the brief opacity crossfade. Do not animate row height or text layout.

## Repo conventions to follow

Use `useReducedMotion`, shared values, and motion tokens. Keep the existing iOS haptic as the primary feedback.

## Steps

1. Add a fixed-size icon slot with todo and done `Animated.View` layers overlaid inside it.
2. Initialize one shared progress value from `done` and retarget it to 0 or 1 over 120ms strong ease-out whenever state changes; never reset it to a fixed intermediate value.
3. Derive opposing opacities and subtle 0.97→1 incoming scales from progress. Under reduced motion derive scale 1 for both layers.
4. Cancel progress animation during cleanup.

## Boundaries

- Do NOT animate row height, due-date removal, text decoration, or the whole row.
- Do NOT delay mutation or haptic feedback.
- Do NOT exceed 160ms.

## Verification

- **Mechanical**: TypeScript and lint.
- **Feel check**: complete and reopen tasks repeatedly. The icon should give a nearly instant confirmation without making list work feel animated. Reduce Motion must retain only the opacity cue.
- **Done when**: icon feedback is ≤120ms and layout changes remain immediate.
