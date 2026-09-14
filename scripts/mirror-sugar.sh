#!/usr/bin/env bash
# Mirror packages/sugar to the standalone repository.
#
# The monorepo is the source of truth. `git subtree split` is deterministic
# for the same underlying commits, so successive splits descend from earlier
# ones. The standalone repo also carries its own commits (CI workflow, lint
# config, lockfile), so instead of overwriting its main we merge the split
# into it. If the merge conflicts, resolve it in the temporary clone printed
# below, then push that clone's main by hand.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

REMOTE="${1:-https://github.com/OxFrancesco/UNOFFICIAL-Aero-SDK.git}"
CLONE="$(mktemp -d "${TMPDIR:-/tmp}/aero-mirror.XXXXXX")"

echo "Splitting packages/sugar history..." >&2
COMMIT="$(git subtree split --prefix=packages/sugar HEAD)"

echo "Cloning ${REMOTE} into ${CLONE}..." >&2
git clone --quiet "${REMOTE}" "${CLONE}"
git -C "${CLONE}" fetch --quiet "$(pwd)" "${COMMIT}"

if git -C "${CLONE}" merge-base --is-ancestor FETCH_HEAD HEAD; then
  echo "Standalone main already contains ${COMMIT}; nothing to mirror." >&2
  rm -rf "${CLONE}"
  exit 0
fi

echo "Merging ${COMMIT} into standalone main..." >&2
git -C "${CLONE}" merge --no-edit FETCH_HEAD \
  -m "chore: sync packages/sugar from BeeGreat $(git rev-parse --short HEAD)"

echo "Pushing standalone main..." >&2
git -C "${CLONE}" push "${REMOTE}" HEAD:refs/heads/main
rm -rf "${CLONE}"
