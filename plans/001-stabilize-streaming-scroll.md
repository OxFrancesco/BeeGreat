# 001 — Stabilize streaming conversation scroll

- **Status**: DONE
- **Commit**: d9f861d
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 1 file, small

## Problem

`apps/mobile/src/components/agent/conversation.tsx:30` animates every content-size update:

```tsx
const handleContentSizeChange = useCallback(() => {
  if (following) {
    scrollRef.current?.scrollToEnd({ animated: true });
  }
}, [following]);
```

Streaming assistant text changes size repeatedly, so a single response continuously restarts scroll motion on a high-frequency productivity path.

## Target

Keep following behavior, but make streaming growth stable and immediate:

```tsx
scrollRef.current?.scrollToEnd({ animated: false });
```

## Repo conventions to follow

Preserve the existing `following` threshold and `useCallback` structure in `conversation.tsx:21-34`. No new dependency or state is needed.

## Steps

1. In `apps/mobile/src/components/agent/conversation.tsx`, change only the content-size follow call to `animated: false`.
2. Preserve user scroll release behavior and the 80-point bottom threshold.

## Boundaries

- Do NOT alter message rendering, streaming, or scroll ownership.
- Do NOT add throttles or timers.
- Do NOT change initial navigation scrolling.

## Verification

- **Mechanical**: run `bunx tsc --noEmit -p apps/mobile/tsconfig.json` and `bun run --cwd apps/mobile lint`.
- **Feel check**: stream a long reply while following the bottom, then scroll upward during another reply. Confirm growth stays anchored without easing/chasing, and manual upward scrolling still releases follow mode.
- **Done when**: no animated scroll is initiated by `onContentSizeChange`.
