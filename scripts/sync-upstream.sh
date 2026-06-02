#!/usr/bin/env bash
#
# sync-upstream.sh — 从上游 WoWAnalyzer 合并最新代码到当前分支
#
# 用法:
#   bash scripts/sync-upstream.sh                    # 合并 upstream/midnight
#   bash scripts/sync-upstream.sh the-war-within     # 合并指定上游分支
#
# 前提:
#   git remote add upstream https://github.com/WoWAnalyzer/WoWAnalyzer.git
#   git config rerere.enabled true
#
set -euo pipefail

UPSTREAM_BRANCH="${1:-midnight}"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
BACKUP_BRANCH="backup/${CURRENT_BRANCH}/$(date +%Y%m%d-%H%M%S)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

run_post_merge_checks() {
  local merge_base="${1:-}"

  # --- defineMessage 导入完整性 ---
  MISSING_IMPORT=$(grep -rl 'defineMessage(' src/ --include='*.ts' --include='*.tsx' --include='*.jsx' 2>/dev/null \
    | xargs grep -L 'import.*defineMessage.*from' 2>/dev/null || true)
  if [ -n "${MISSING_IMPORT}" ]; then
    echo ""
    warn "检测到 defineMessage 导入缺失:"
    echo "${MISSING_IMPORT}" | while IFS= read -r f; do echo "  ${f}"; done
    warn "添加 import { defineMessage } from '@lingui/core/macro'; 或改用 t()"
    echo ""
  fi

  # --- 上游核心 i18n 文件保护（应仅通过 messages.json 翻译）---
  CORE_LIST="scripts/upstream-i18n-core-files.txt"
  if [ -f "${CORE_LIST}" ]; then
    CORE_DIFF=""
    while IFS= read -r core_file; do
      [ -z "${core_file}" ] || [[ "${core_file}" == \#* ]] && continue
      if ! git diff --quiet "upstream/${UPSTREAM_BRANCH}" HEAD -- "${core_file}" 2>/dev/null; then
        CORE_DIFF="${CORE_DIFF}  ${core_file}\n"
      fi
    done < "${CORE_LIST}"
    if [ -n "${CORE_DIFF}" ]; then
      warn "以下上游核心 i18n 文件与 upstream 不一致（避免改 t/defineMessage，只改 zh/messages.json）:"
      echo -e "${CORE_DIFF}"
    fi
  fi

  # --- 覆盖文件：上游源文件在合并中是否有更新 ---
  REGISTRY="src/localization/overrides/registry.ts"
  if [ -f "${REGISTRY}" ] && [ -n "${merge_base}" ]; then
    OVERRIDE_STALE=""
    while IFS= read -r src_path; do
      [ -z "${src_path}" ] && continue
      if git diff --name-only "${merge_base}" HEAD -- "${src_path}" 2>/dev/null | grep -q .; then
        OVERRIDE_STALE="${OVERRIDE_STALE}  ${src_path}\n"
      fi
    done < <(grep -oE '"src/[^"]+"' "${REGISTRY}" | tr -d '"')
    if [ -n "${OVERRIDE_STALE}" ]; then
      warn "以下文件在合并中由上游更新，请同步更新对应覆盖文件 (src/localization/overrides/...):"
      echo -e "${OVERRIDE_STALE}"
      warn "运行: diff -u src/analysis/.../Guide.tsx src/localization/overrides/analysis/.../Guide.tsx"
    fi
  fi

  # --- 未翻译 message ID（抽样检查 zh catalog）---
  if command -v node >/dev/null 2>&1; then
    EMPTY_ZH=$(node -e "
      const m = require('./src/localization/zh/messages.json');
      const empty = Object.entries(m).filter(([,v]) => v === '').length;
      if (empty > 0) console.log(empty);
    " 2>/dev/null || true)
    if [ -n "${EMPTY_ZH}" ]; then
      warn "zh/messages.json 仍有 ${EMPTY_ZH} 个空翻译条目，合并后请补充"
    fi
  fi
}

# --- 前置检查 ---
if ! git remote get-url upstream &>/dev/null; then
  error "未找到 upstream remote。请先运行:"
  echo "  git remote add upstream https://github.com/WoWAnalyzer/WoWAnalyzer.git"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  error "工作区不干净，请先 commit 或 stash 所有更改。"
  echo ""
  git status --short
  exit 1
fi

# --- 开始同步 ---
info "当前分支: ${CURRENT_BRANCH}"
info "上游分支: upstream/${UPSTREAM_BRANCH}"

info "正在 fetch upstream..."
git fetch upstream

info "创建备份分支: ${BACKUP_BRANCH}"
git branch "${BACKUP_BRANCH}"

info "开始合并 upstream/${UPSTREAM_BRANCH} ..."
if git merge "upstream/${UPSTREAM_BRANCH}" --no-edit; then
  info "合并成功，无冲突!"
  echo ""
  run_post_merge_checks "${BACKUP_BRANCH}"
  info "建议随后运行: pnpm run typecheck"
  info "合并完成。备份分支: ${BACKUP_BRANCH}"
  info "如需回滚: git reset --hard ${BACKUP_BRANCH}"
else
  echo ""
  warn "合并产生冲突，需要手动解决。"
  echo ""

  CONFLICT_FILES=$(git diff --name-only --diff-filter=U)
  CONFLICT_COUNT=$(echo "${CONFLICT_FILES}" | wc -l | tr -d ' ')

  warn "共 ${CONFLICT_COUNT} 个文件存在冲突:"
  echo ""

  # 分类展示冲突文件
  ANALYSIS_CONFLICTS=""
  LOCALIZATION_CONFLICTS=""
  OTHER_CONFLICTS=""

  while IFS= read -r file; do
    case "${file}" in
      src/analysis/*)     ANALYSIS_CONFLICTS="${ANALYSIS_CONFLICTS}  ${file}\n" ;;
      src/localization/*) LOCALIZATION_CONFLICTS="${LOCALIZATION_CONFLICTS}  ${file}\n" ;;
      *)                  OTHER_CONFLICTS="${OTHER_CONFLICTS}  ${file}\n" ;;
    esac
  done <<< "${CONFLICT_FILES}"

  if [ -n "${OTHER_CONFLICTS}" ]; then
    echo -e "${RED}[优先级1] 基础设施/配置文件:${NC}"
    echo -e "${OTHER_CONFLICTS}"
  fi

  if [ -n "${LOCALIZATION_CONFLICTS}" ]; then
    echo -e "${YELLOW}[优先级2] 翻译文件:${NC}"
    echo -e "${LOCALIZATION_CONFLICTS}"
  fi

  if [ -n "${ANALYSIS_CONFLICTS}" ]; then
    echo -e "${GREEN}[优先级3] 分析模块 (i18n 相关):${NC}"
    echo -e "${ANALYSIS_CONFLICTS}"
  fi

  RERERE_RESOLVED=$(git rerere status 2>/dev/null | wc -l | tr -d ' ')
  if [ "${RERERE_RESOLVED}" -gt 0 ]; then
    info "git rerere 已自动解决 ${RERERE_RESOLVED} 个已知冲突模式"
  fi

  echo ""
  info "解决冲突后运行:"
  echo "  git add ."
  echo "  git commit"
  echo "  bash scripts/post-merge-i18n-checks.sh ${BACKUP_BRANCH} ${UPSTREAM_BRANCH}"
  echo ""
  info "如需放弃合并:"
  echo "  git merge --abort"
  echo ""
  info "如需回滚到合并前:"
  echo "  git reset --hard ${BACKUP_BRANCH}"
fi
