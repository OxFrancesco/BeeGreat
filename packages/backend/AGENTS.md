<!-- convex-ai-start -->
This package holds the shared Convex backend for all BeeGreat apps (web, mobile).

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

Run `bun run dev` here (or `bun run backend` from the repo root) to start `convex dev`.
Apps import the API via `@beegreat/backend/convex/_generated/api`.
