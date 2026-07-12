# 011 — Animate comb progress with a clipped transform

- **Status**: DONE
- **Commit**: d9f861d
- **Severity**: LOW
- **Category**: Missed opportunity
- **Estimated scope**: 1 file, medium

## Problem

`apps/mobile/src/components/goals/comb-cell.tsx:27-38` recalculates the honey rectangle directly from `progress`, so the core “work fills the comb” metaphor teleports between levels.

## Target

Keep a full-size honey rectangle inside a translated inner Skia group, wrapped by a stationary outer group that owns the hex clip. Animate the inner translation from `size` (empty) to `0` (full):

```tsx
const translateY = size * (1 - clampedProgress);
transform={[{ translateY: animatedProgress }]}
```

Use a Reanimated shared progress value with 240ms `MotionEasing.out`. Under reduced motion assign progress immediately. Animate the Skia transform, not React Native width/height/y layout.

## Repo conventions to follow

Match the clipped full-layer transform strategy from plan 006. React Native Skia accepts Reanimated shared/derived values directly in animated properties in the installed integration.

## Steps

1. Add `useEffect`, `useReducedMotion`, `useSharedValue`, `useDerivedValue`, and `withTiming`.
2. Keep the rectangle full canvas size at `x=0`, `y=0`, `width=size`, `height=size`.
3. Apply the hex clip to a stationary outer `Group`, then apply the derived translation only to a nested honey `Group`.
4. Retarget to clamped progress over 240ms strong ease-out, or assign immediately under reduced motion.
5. Cancel the progress animation in cleanup.

## Boundaries

- Do NOT change hex geometry, stroke, colors, or progress clamping.
- Do NOT animate React Native layout properties.
- Do NOT add a bounce to progress.

## Verification

- **Mechanical**: TypeScript and lint.
- **Feel check**: update a project through several progress values. Honey should rise from the bottom, remain clipped to the cell, retarget smoothly mid-animation, and complete in 240ms. Reduce Motion must update instantly.
- **Done when**: progress is visually continuous and the React Native Canvas dimensions remain static.
