#!/usr/bin/env bash
# Copies CN-localized Guide files to src/localization/overrides/ and restores upstream originals.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

UPSTREAM_REF="${1:-upstream/midnight}"
OVERRIDES="${ROOT}/src/localization/overrides"

# Top-level spec Guide.tsx files with i18n wrapping (high merge-conflict risk)
GUIDE_FILES=(
  src/analysis/retail/deathknight/frost/Guide.tsx
  src/analysis/retail/deathknight/unholy/modules/Guide.tsx
  src/analysis/retail/demonhunter/devourer/Guide.tsx
  src/analysis/retail/demonhunter/havoc/Guide.tsx
  src/analysis/retail/demonhunter/vengeance/Guide.tsx
  src/analysis/retail/druid/balance/Guide.tsx
  src/analysis/retail/druid/feral/Guide.tsx
  src/analysis/retail/druid/guardian/Guide.tsx
  src/analysis/retail/druid/restoration/Guide.tsx
  src/analysis/retail/evoker/preservation/Guide.tsx
  src/analysis/retail/mage/arcane/Guide.tsx
  src/analysis/retail/mage/fire/Guide.tsx
  src/analysis/retail/mage/frost/Guide.tsx
  src/analysis/retail/monk/brewmaster/Guide.tsx
  src/analysis/retail/monk/mistweaver/Guide.tsx
  src/analysis/retail/monk/windwalker/Guide.tsx
  src/analysis/retail/paladin/holy/guide/Guide.tsx
  src/analysis/retail/paladin/protection/Guide.tsx
  src/analysis/retail/paladin/retribution/Guide.tsx
  src/analysis/retail/priest/discipline/Guide.tsx
  src/analysis/retail/priest/holy/Guide.tsx
  src/analysis/retail/priest/shadow/Guide.tsx
  src/analysis/retail/rogue/assassination/Guide.tsx
  src/analysis/retail/rogue/outlaw/Guide.tsx
  src/analysis/retail/rogue/subtlety/Guide.tsx
  src/analysis/retail/shaman/enhancement/Guide.tsx
  src/analysis/retail/shaman/restoration/Guide.tsx
  src/analysis/retail/warlock/affliction/Guide.tsx
  src/analysis/retail/warlock/demonology/Guide.tsx
  src/analysis/retail/warlock/destruction/Guide.tsx
  src/analysis/retail/warrior/arms/Guide.tsx
  src/analysis/retail/warrior/fury/Guide.tsx
)

for src_file in "${GUIDE_FILES[@]}"; do
  if ! git diff --quiet "${UPSTREAM_REF}" -- "${src_file}" 2>/dev/null; then
    override_file="${OVERRIDES}/${src_file#src/}"
    mkdir -p "$(dirname "${override_file}")"
    cp "${src_file}" "${override_file}"
    git checkout "${UPSTREAM_REF}" -- "${src_file}"
    echo "Migrated: ${src_file}"
  else
    echo "Skip (same as upstream): ${src_file}"
  fi
done

node scripts/generate-override-registry.mjs 2>/dev/null || echo "Registry generation skipped (run manually if needed)"
