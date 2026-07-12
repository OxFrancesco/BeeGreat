# 006 — Reveal vessel honey with a transform

- **Status**: DONE
- **Commit**: d9f861d
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 file, medium

## Problem

`apps/mobile/src/components/first-focus/honey-vessel.tsx:30-39` animates `height` for 520ms:

```tsx
fillHeight.value = reducedMotion
  ? nextHeight
  : withTiming(nextHeight, { duration: 520 });
const animatedFill = useAnimatedStyle(() => ({ height: fillHeight.value }));
```

Animating height drives layout/paint each frame and exceeds the 300ms UI budget.

## Target

Render the honey layer at fixed `height: cavityHeight`, bottom anchored, and reveal it by translating the full layer downward:

```tsx
const nextTranslateY = cavityHeight * (1 - fillRatio);
transform: [{ translateY: fillTranslateY.value }]
```

Animate to the target for `MotionDuration.progress` (240ms) with `MotionEasing.out`. Under reduced motion assign the target immediately.

## Repo conventions to follow

Keep the existing clipped cavity and bottom anchoring. Import tokens from plan 002 and retain `useReducedMotion()`.

## Steps

1. Rename the shared value from height to translation semantics.
2. Initialize it to `cavityHeight * (1 - fillRatio)`.
3. Retarget with 240ms strong ease-out, or assign immediately for reduced motion.
4. Give the honey view a fixed `height: cavityHeight` and apply only animated transform.
5. Preserve the surface and glow children inside the translated layer.

## Boundaries

- Do NOT change balance calculations, vessel geometry, colors, accessibility, or overflow copy.
- Do NOT animate height, top, or bottom.

## Verification

- **Mechanical**: TypeScript and lint.
- **Feel check**: change balance from 0→50→100 and back. The surface must rise from the bottom, remain level, and finish in 240ms without frame drops. Reduce Motion must jump to the exact correct fill.
- **Done when**: the animated style contains transform only and no animated layout property.
