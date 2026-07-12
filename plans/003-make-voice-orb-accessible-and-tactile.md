# 003 — Make the voice orb accessible and tactile

- **Status**: DONE
- **Commit**: d9f861d
- **Severity**: HIGH
- **Category**: Accessibility, easing, physicality
- **Estimated scope**: 1 file, medium

## Problem

`apps/mobile/src/components/agent/voice-orb.tsx:63-113` runs perpetual radius/glow/ripple loops without reduced-motion handling. Its listening sequence includes explicit ease-in:

```tsx
withTiming(1.08, { duration: 420, easing: Easing.out(Easing.quad) }),
withTiming(1, { duration: 420, easing: Easing.in(Easing.quad) }),
```

The primary button at `voice-orb.tsx:123` also uses a static style and provides no visual press response.

## Target

- Call `useReducedMotion()`.
- Under reduced motion, cancel all three shared-value animations and assign stable state-indicating values without movement.
- Replace listening breathe sequencing with one reversible timing loop using `MotionEasing.inOut`; no `Easing.in` may remain.
- Keep Skia circle geometry fixed and animate centered `Group` transforms plus ripple opacity, avoiding per-frame radius rasterization.
- Wrap/animate the press surface from scale `1` to `MotionScale.pressed` over `MotionDuration.pressIn`, returning over `MotionDuration.pressOut` with `MotionEasing.out`.
- For reduced motion, do not scale; retain immediate opacity feedback through Pressable state.

## Repo conventions to follow

Reuse Reanimated shared values, `cancelAnimation`, and the motion constants from plan 002. `FloatingBee` demonstrates the repo's `useReducedMotion()` convention.

## Steps

1. Add `useReducedMotion` and `useAnimatedStyle` imports plus motion-token imports.
2. Add a `pressScale` shared value and animated transform style.
3. Use `onPressIn`/`onPressOut` to animate scale only when reduced motion is false; use `pressed` style opacity for feedback in every mode.
4. At the start of the state effect, cancel existing animations. If reduced motion is true, assign static values and return.
5. Replace the listening breathe sequence with `withRepeat(withTiming(1.08, { duration: 420, easing: MotionEasing.inOut }), -1, true)`.
6. Replace derived animated radii with centered Skia `Group` scale transforms over constant-radius circles; keep ripple opacity derived.
7. Pass the system reduced-motion behavior to indefinite repeat animations where supported and clean up all shared-value animations on effect disposal.

## Boundaries

- Do NOT change orb dimensions, Skia colors, labels, or state meanings.
- Do NOT animate layout properties.
- Do NOT remove useful listening/thinking/speaking differentiation.

## Verification

- **Mechanical**: TypeScript and lint.
- **Feel check**: press repeatedly and switch rapidly through all orb states. The press should respond immediately at scale 0.97 and never jump. At 10% playback the listening loop must reverse smoothly with no fast seam. Enable Reduce Motion and confirm radius/scale/ripple movement stops while state and press feedback remain legible.
- **Done when**: there is no `Easing.in`, no unbounded motion under reduced motion, and the whole orb gives tactile press feedback.
