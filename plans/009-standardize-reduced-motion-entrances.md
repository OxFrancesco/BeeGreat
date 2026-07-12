# 009 — Standardize reduced-motion entrances

- **Status**: DONE
- **Commit**: d9f861d
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 3 files, medium

## Problem

The sign-in hero always translates (`apps/mobile/src/app/sign-in.tsx:76`), while generated cards and Hive completion remove all transition under reduced motion:

```tsx
entering={reducedMotion ? undefined : FadeInDown.duration(240)}
```

Reduced motion should drop position changes but retain gentle opacity feedback.

## Target

- `sign-in.tsx`: call `useReducedMotion`; use `FadeIn.duration(200)` for the hero under reduced motion and the existing playful spring otherwise. Shorten delayed copy/actions to undelayed 200ms fades under reduced motion.
- `generated-ui.tsx`: use undelayed `FadeIn.duration(200)` under reduced motion; retain the existing 80ms staggered spring entrance otherwise.
- `hive.tsx`: use `FadeIn.duration(200)` under reduced motion; retain `FadeInDown.duration(240)` otherwise.
- Pull 200/240ms values from plan 002 tokens where builder APIs accept them.

## Repo conventions to follow

Use Reanimated `useReducedMotion()` already present in generated UI and Hive. `FloatingBee` demonstrates system preference behavior.

## Steps

1. Add `useReducedMotion` to sign-in and branch all three entrance builders.
2. Import `FadeIn` in Hive and replace the `undefined` reduced branch.
3. Replace generated UI's `undefined` reduced branch with a 200ms opacity-only fade and no stagger.
4. Keep non-reduced spatial direction, delays, and rare-screen delight unchanged unless a shared duration token exactly applies.

## Boundaries

- Do NOT remove all feedback for reduced-motion users.
- Do NOT add transforms to reduced branches.
- Do NOT alter authentication, generated UI, or completion logic.

## Verification

- **Mechanical**: TypeScript and lint.
- **Feel check**: enable Reduce Motion and visit sign-in, stream generated cards, and complete a Highlight. Each surface should fade for 200ms without vertical movement. Disable it and confirm existing spatial entrances remain.
- **Done when**: all three surfaces retain opacity feedback and suppress movement under reduced motion.
