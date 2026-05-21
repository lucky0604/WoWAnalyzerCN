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
  echo ""
  info "如需放弃合并:"
  echo "  git merge --abort"
  echo ""
  info "如需回滚到合并前:"
  echo "  git reset --hard ${BACKUP_BRANCH}"
fi
