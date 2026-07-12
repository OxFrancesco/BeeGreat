# 002 — Add one native motion vocabulary

- **Status**: DONE
- **Commit**: d9f861d
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 new file plus imports in touched motion components

## Problem

`apps/mobile/src/constants/theme.ts:69` defines shared spacing but no motion vocabulary, while agent UI hand-types unrelated durations and easings, for example:

```tsx
withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.ease) })
FadeInUp.duration(220)
FadeOut.duration(150)
```

## Target

Create `apps/mobile/src/constants/motion.ts` with exact shared values:

```ts
import { Easing } from 'react-native-reanimated';

export const MotionDuration = {
  pressIn: 100,
  pressOut: 160,
  exit: 150,
  enter: 200,
  progress: 240,
} as const;

export const MotionEasing = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
} as const;

export const MotionScale = {
  pressed: 0.97,
  enter: 0.94,
} as const;
```

## Repo conventions to follow

Shared UI values live under `apps/mobile/src/constants/`; import them through the existing `@/constants/...` alias. Preserve `as const` conventions used in `theme.ts`.

## Steps

1. Add the constants file exactly as specified.
2. In files changed by plans 003–011, replace matching literal durations, curves, and scales with these tokens.
3. Do not migrate unrelated animation code in this pass.

## Boundaries

- Do NOT add dependencies or CSS motion variables.
- Do NOT export component-specific amplitudes such as orb glow radii.
- Do NOT modify color, typography, or spacing tokens.

## Verification

- **Mechanical**: run TypeScript and lint using the commands in plan 001.
- **Feel check**: compare the touched surfaces at 10% playback and verify entrances share the strong ease-out while state morphs use the strong ease-in-out.
- **Done when**: touched components no longer duplicate the exact shared durations/curves/scales.
