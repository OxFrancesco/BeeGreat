# 007 — Make reasoning disclosure crisp

- **Status**: DONE
- **Commit**: d9f861d
- **Severity**: MEDIUM
- **Category**: Interruptibility
- **Estimated scope**: 1 file, small

## Problem

`apps/mobile/src/components/agent/reasoning.tsx:117-130` conditionally mounts rapidly reversible content using `FadeIn` and `FadeOut` entry/exit builders. Quick taps can restart these keyframe-style animations, and the fade does not explain layout expansion.

## Target

Prefer deletion for this high-frequency disclosure: remove both entry/exit animations and render the open content as a normal `View`. Opening and closing should respond immediately to the trigger, with no restarted fade.

## Repo conventions to follow

Keep the existing conditional rendering and React Native `View`. The transcript already uses instant state changes for frequently accessed controls.

## Steps

1. Remove the Reanimated/FadeIn/FadeOut import.
2. Replace `Animated.View` with `View` and remove `entering`/`exiting` props.
3. Preserve border, spacing, auto-close timing, labels, and trigger behavior.

## Boundaries

- Do NOT animate height or add a layout transition.
- Do NOT change the 800ms automatic close delay.
- Do NOT change reasoning state logic.

## Verification

- **Mechanical**: TypeScript and lint.
- **Feel check**: spam the disclosure toggle while streaming and after completion. Each tap must take effect immediately, with no half-visible or restarted state.
- **Done when**: reasoning content contains no entry/exit animation.
