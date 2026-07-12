# 008 — Repair the GolieBee celebration

- **Status**: DONE
- **Commit**: d9f861d
- **Severity**: MEDIUM
- **Category**: Physicality and correctness
- **Estimated scope**: 1 file, medium

## Problem

`apps/mobile/src/components/first-focus/golie-bee.tsx:32-34` uses an `entering` animation conditional on `celebrating`:

```tsx
entering={celebrating && !reducedMotion ? ZoomIn.springify().damping(12) : undefined}
```

`celebrating` normally flips after this component has mounted, so the entrance does not run. Reanimated's installed `ZoomIn` also starts at `scale(0)`, which violates physicality.

## Target

Drive celebration from the prop transition with a shared scale value. Start at `MotionScale.enter` (0.94), spring to `1.06` using the installed Reanimated-compatible traditional config `{ mass: 1, stiffness: 100, damping: 10 }`, and retain the celebratory scale while the state remains true. Under reduced motion assign `1.06` immediately. When celebration clears, return to `1` over 160ms with `MotionEasing.out`.

## Repo conventions to follow

Use Reanimated shared values/effects as elsewhere in first-focus components. Keep `FloatingBee` autoplay reduction and the existing sparkle/copy behavior.

## Steps

1. Remove `ZoomIn` and the `entering` prop.
2. Add `useEffect`, `useSharedValue`, `useAnimatedStyle`, `withSpring`, `withTiming`, and token imports.
3. On a false→true celebration transition, set scale to 0.94 then spring to 1.06; do not use scale zero.
4. On true→false, return to 1 over 160ms.
5. Remove the static `celebratingFrame` scale so transforms have one owner.
6. Cancel the scale animation in cleanup.

## Boundaries

- Do NOT remount the component with a synthetic key.
- Do NOT change bee image size, name generation, sparkle content, or accessibility label.
- Do NOT add visible bounce above 0.2.

## Verification

- **Mechanical**: TypeScript and lint.
- **Feel check**: complete a Highlight without leaving the Hive screen. The already-mounted bee must visibly celebrate from 0.94 to 1.06. At 10% playback it must never originate from nothing. Reduce Motion must show the completed state without movement.
- **Done when**: celebration triggers on prop change and no `ZoomIn`/scale-zero path remains.
