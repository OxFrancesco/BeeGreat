#!/usr/bin/env bash
# Mirror packages/sugar to the standalone repository.
#
# The monorepo is the source of truth. `git subtree split` is deterministic
# for the same underlying commits, so successive runs fast-forward as long as
# nobody commits directly to the standalone repo. If the push is rejected,
# reconcile by landing the standalone changes here first, then re-run.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

REMOTE="${1:-https://github.com/OxFrancesco/aerodrome-sdk-ts.git}"

echo "Splitting packages/sugar history..." >&2
COMMIT="$(git subtree split --prefix=packages/sugar HEAD)"
echo "Pushing ${COMMIT} to ${REMOTE} main..." >&2
git push "${REMOTE}" "${COMMIT}:refs/heads/main"
