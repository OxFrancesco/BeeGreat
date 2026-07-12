# 005 — Simplify tool activity motion

- **Status**: DONE
- **Commit**: d9f861d
- **Severity**: HIGH
- **Category**: Purpose & frequency, accessibility
- **Estimated scope**: 1 file, small

## Problem

`apps/mobile/src/components/agent/tool.tsx:32` and `:81` wrap every normal tool row and every Thinking row in:

```tsx
<Animated.View entering={FadeInDown.springify().damping(18)} style={styles.row}>
```

These are frequent transcript events; repeated decorative vertical spring motion makes routine agent work feel busy and ignores reduced-motion preferences.

## Target

Delete the entrance animation. Render both rows as ordinary `View` components. Preserve the opacity-only `Shimmer`, because opacity feedback is useful and reduced-motion compatible.

## Repo conventions to follow

Use the already imported React Native `View`. Do not introduce a replacement animation.

## Steps

1. Remove the Reanimated/FadeInDown import.
2. Replace both `Animated.View` opening and closing tags with `View`.
3. Preserve row layout, Shimmer, power-up tags, and symbols exactly.

## Boundaries

- Do NOT alter tool state logic or human-readable labels.
- Do NOT remove Shimmer.
- Do NOT animate each row with another preset.

## Verification

- **Mechanical**: TypeScript and lint.
- **Feel check**: run a multi-tool response. Rows should appear immediately and quietly; the running label should retain its gentle opacity pulse.
- **Done when**: `tool.tsx` has no entrance animation.
