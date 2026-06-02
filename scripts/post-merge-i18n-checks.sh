#!/usr/bin/env bash
# Post-merge i18n checks. Usage: bash scripts/post-merge-i18n-checks.sh [merge-base-ref] [upstream-branch]
set -euo pipefail

MERGE_BASE="${1:-}"
UPSTREAM_BRANCH="${2:-midnight}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
info() { echo -e "${GREEN}[INFO]${NC} $*"; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

MISSING_IMPORT=$(grep -rl 'defineMessage(' src/ --include='*.ts' --include='*.tsx' 2>/dev/null \
  | xargs grep -L 'import.*defineMessage.*from' 2>/dev/null || true)
if [ -n "${MISSING_IMPORT}" ]; then
  warn "defineMessage 导入缺失:"
  echo "${MISSING_IMPORT}" | while IFS= read -r f; do echo "  ${f}"; done
fi

CORE_LIST="scripts/upstream-i18n-core-files.txt"
if [ -f "${CORE_LIST}" ]; then
  while IFS= read -r core_file; do
    [ -z "${core_file}" ] || [[ "${core_file}" == \#* ]] && continue
    if ! git diff --quiet "upstream/${UPSTREAM_BRANCH}" HEAD -- "${core_file}" 2>/dev/null; then
      warn "核心 i18n 文件与 upstream 不一致: ${core_file}"
    fi
  done < "${CORE_LIST}"
fi

REGISTRY="src/localization/overrides/registry.ts"
if [ -f "${REGISTRY}" ] && [ -n "${MERGE_BASE}" ]; then
  while IFS= read -r src_path; do
    [ -z "${src_path}" ] && continue
    if git diff --name-only "${MERGE_BASE}" HEAD -- "${src_path}" 2>/dev/null | grep -q .; then
      warn "上游已更新，请复查覆盖: ${src_path}"
    fi
  done < <(grep -oE '"src/[^"]+"' "${REGISTRY}" | tr -d '"')
fi

info "运行 pnpm run typecheck ..."
pnpm run typecheck
