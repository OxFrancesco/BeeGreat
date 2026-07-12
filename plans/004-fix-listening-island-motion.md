# 004 — Fix Listening Island lifecycle and interruption

- **Status**: DONE
- **Commit**: d9f861d
- **Severity**: HIGH
- **Category**: Performance, interruptibility, accessibility
- **Estimated scope**: 1 file, medium

## Problem

`apps/mobile/src/components/agent/listening-island.tsx:39-51` starts an infinite pulse but returns early when inactive, without cancellation. Lines 60-62 conditionally mount `FadeInUp`/`FadeOutUp` keyframe builders, so quick mic start/stop/start cycles restart rather than retarget.

## Target

Keep one mounted absolute wrapper and drive its visibility with a shared value:

```tsx
opacity: visibility.value,
transform: [{ translateY: reducedMotion ? 0 : (1 - visibility.value) * -8 }]
```

Animate active entry for 200ms and exit for 150ms with `MotionEasing.out`. Set `pointerEvents` to `box-none` only while active. Use a static dot under reduced motion. Always cancel `pulse` and `visibility` in cleanup.
Retain the last non-idle state label during the 150ms exit so Speaking or Thinking never changes to Listening while still visible.

## Repo conventions to follow

Use Reanimated shared values and `useReducedMotion`, matching the patterns established by plan 003. Use tokens from plan 002.

## Steps

1. Remove `FadeInUp` and `FadeOutUp` imports and remove the early `return null`.
2. Add `visibility`, `useAnimatedStyle`, `useReducedMotion`, and token imports.
3. Retarget visibility from its current value whenever `active` changes; never reset it before timing.
4. In the pulse effect, cancel first; start the opacity pulse only when active and not reduced; otherwise assign a stable opacity. Return cleanup that cancels it.
5. Track the last non-idle state for the visible label, hide accessibility descendants while inactive, and disable pointer events while inactive.

## Boundaries

- Do NOT change safe-area positioning or Dynamic Island detection.
- Do NOT animate `top`, width, height, or padding.
- Do NOT leave an invisible interactive element.

## Verification

- **Mechanical**: TypeScript and lint.
- **Feel check**: rapidly toggle recording at least ten times. The pill must reverse from its current position without flashing or restarting. Leave it idle and inspect Reanimated activity to confirm no pulse remains. With Reduce Motion, confirm a fade remains but vertical motion and pulsing stop.
- **Done when**: no infinite animation runs while idle and visibility is retargetable.
