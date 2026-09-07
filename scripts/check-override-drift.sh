#!/usr/bin/env bash
# CN override drift gate.
#
# Fails when:
#   1. src/localization/overrides/registry.ts is stale relative to the
#      overrides/ tree (needs: node scripts/generate-override-registry.mjs), or
#   2. a registered override source file changed in the diff range but its
#      copy under src/localization/overrides/ did not — meaning an upstream
#      change likely landed without the matching CN translation update.
#
# Usage: bash scripts/check-override-drift.sh [base-ref]
#   base-ref defaults to origin/midnight. In CI pass the PR base ref
#   (GITHUB_BASE_REF), mirroring scripts/require-changelog-entry.cjs.
set -euo pipefail

BASE_REF="${1:-origin/midnight}"

cd "$(dirname "$0")/.."

changed_files="$(git diff --name-only "${BASE_REF}..HEAD" || true)"

# 1. Registry sync: regenerating must not change the current registry file.
registry_before="$(mktemp)"
cp src/localization/overrides/registry.ts "$registry_before"
node scripts/generate-override-registry.mjs > /dev/null
if ! cmp -s "$registry_before" src/localization/overrides/registry.ts; then
  rm -f "$registry_before"
  echo "ERROR: src/localization/overrides/registry.ts is out of sync with src/localization/overrides/." >&2
  echo "Run: node scripts/generate-override-registry.mjs" >&2
  exit 1
fi
rm -f "$registry_before"

# 2. Drift between overridden sources and their override copies.
registered="$(grep -o '"src/[^"]*"' src/localization/overrides/registry.ts | tr -d '"' || true)"

drift=0
while IFS= read -r src_path; do
  [ -z "$src_path" ] && continue
  override_path="src/localization/overrides/${src_path#src/}"
  if grep -qxF "$src_path" <<< "$changed_files" && ! grep -qxF "$override_path" <<< "$changed_files"; then
    echo "ERROR: '$src_path' changed but its CN override '$override_path' did not." >&2
    echo "       Update the override copy in src/localization/overrides/ to keep CN translations in sync." >&2
    drift=1
  fi
done <<< "$registered"

if [ "$drift" -ne 0 ]; then
  exit 1
fi

echo "Override drift check passed."
