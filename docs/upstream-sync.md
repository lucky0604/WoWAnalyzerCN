# 上游同步指南

本文档说明如何将上游 [WoWAnalyzer/WoWAnalyzer](https://github.com/WoWAnalyzer/WoWAnalyzer) 的更新合并到本 CN fork。

## 基础设置（一次性）

```bash
# 添加上游 remote
git remote add upstream https://github.com/WoWAnalyzer/WoWAnalyzer.git

# 启用 rerere — 自动记住冲突解决方案，下次遇到相同冲突时自动复用
git config rerere.enabled true
```

## 日常同步

### 使用同步脚本（推荐）

```bash
# 合并 upstream/midnight（默认）
bash scripts/sync-upstream.sh

# 合并指定上游分支
bash scripts/sync-upstream.sh the-war-within
```

脚本会自动：

1. 检查工作区是否干净
2. Fetch 上游最新代码
3. 创建带时间戳的备份分支
4. 执行合并，利用 rerere 自动解决已知冲突
5. 按优先级分类展示剩余冲突文件

### 手动同步

```bash
git fetch upstream
git merge upstream/midnight --no-edit
# 解决冲突后
git add .
git commit
```

## 分支对应关系

| 本地分支   | 上游分支            | 说明                       |
| ---------- | ------------------- | -------------------------- |
| `midnight` | `upstream/midnight` | 主开发分支，对应午夜资料片 |

功能分支按需从 `midnight` 创建，完成后合并回 `midnight` 并删除。保持仓库只有一个长期分支。

## 同步频率

建议每 1-2 周同步一次。如果上游有重要更新（新版本、新职业支持），应及时同步。

## 冲突解决指南

### 优先级

1. **基础设施文件**（`package.json`、`vite.config.ts`、`lingui.config.ts`）— 最优先解决，影响构建
2. **翻译文件**（`src/localization/`）— 通常选择保留双方修改
3. **分析模块**（`src/analysis/`）— 数量最多但模式一致，逐个解决

### 常见冲突模式

#### 1. import 行冲突

上游没有 lingui import，我们添加了。通常保留我们的 import：

```typescript
// 保留双方：上游的新 import + 我们的 lingui import
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
```

#### 2. JSX 字符串包装冲突

上游修改了英文文案，我们用 `<Trans>` 包装了同一段文字。解决方法：

- 接受上游的逻辑变更
- 重新用 `<Trans>` 包装新文案
- 更新 `content.json` 中的翻译

#### 3. package.json 依赖冲突

上游可能升级了 lingui 版本。通常：

- 接受上游的版本号
- 运行 `pnpm install` 重新安装
- 检查 API 是否有 breaking change

### rerere 如何帮助

`git rerere`（reuse recorded resolution）会自动记住你每次解决冲突的方式。当下次遇到相同模式的冲突时，git 会自动应用之前的解决方案。

- 第一次同步冲突最多，需要手动解决
- 之后每次同步，已解决过的冲突模式会自动处理
- 只有上游新增/修改的文件需要手动处理

查看 rerere 缓存：

```bash
ls .git/rr-cache/
```

### 回滚

同步脚本在合并前自动创建备份分支 `backup/<branch>/<timestamp>`：

```bash
# 查看备份分支
git branch | grep backup/

# 回滚到合并前
git reset --hard backup/midnight/20260520-173000
```

## 已知冲突热点

以下文件/目录在同步时最可能产生冲突：

| 文件/目录                           | 原因                                    | 建议                     |
| ----------------------------------- | --------------------------------------- | ------------------------ |
| `src/localization/I18nProvider.tsx` | 我们添加了 `SPEC_TRANSLATIONS` 加载逻辑 | 保留我们的修改           |
| `package.json`                      | lingui 版本可能不同                     | 接受上游版本，测试兼容性 |
| `vite.config.ts`                    | 构建插件配置不同                        | 合并双方配置             |
| `src/analysis/retail/monk/`         | 大量 i18n 包装                          | 逐文件解决               |
| `src/analysis/retail/druid/`        | 大量 i18n 包装                          | 逐文件解决               |
| `src/analysis/retail/shaman/`       | 大量 i18n 包装                          | 逐文件解决               |

## 汉化最佳实践（减少未来冲突）

### 翻译层级策略

按冲突风险从低到高，优先使用低风险方式：

| 层级 | 方式                    | 冲突风险 | 适用场景                              |
| ---- | ----------------------- | -------- | ------------------------------------- |
| 1    | `content.json` 翻译字典 | 无       | 所有已有 message ID 的字符串          |
| 2    | 修改共享 UI 组件        | 极低     | `Statistic`、`Panel` 等组件的通用标签 |
| 3    | `t()` 包装单个字符串    | 低       | 短标签、tooltip、属性值               |
| 4    | `<Trans>` 包装整段 JSX  | 中-高    | 包含 `<SpellLink>` 等组件的段落       |

### 具体建议

#### 1. 优先使用 `content.json`（零冲突）

翻译文件 `src/localization/zh/{class}/{spec}/content.json` 是纯增量文件，上游不会修改，永远不会冲突。

所有翻译的最终目标都是写入 `content.json`，源文件中的 `t()` / `<Trans>` 只是为了**提取** message ID。

#### 2. `t()` 优于 `<Trans>`（冲突面更小）

```typescript
// 推荐：t() 只改一行，冲突面小
label: t({ id: 'spec.module.label', message: 'Original English' }),

// 避免：<Trans> 重构整段 JSX，冲突面大
<Trans id="spec.module.paragraph">
  This is a long paragraph with <SpellLink spell={SPELL} /> that
  restructures multiple lines of the original code...
</Trans>
```

使用 `t()` 时，只修改了一个属性的值，上游对同一文件其他行的修改不会产生冲突。

使用 `<Trans>` 时，整个 JSX 块被重构，上游对该段文字的任何改动都会冲突。

#### 3. Message ID 命名规范

保持与上游一致的命名模式，便于未来上游也推进 i18n 时合并：

```
{spec}.{module}.{key}
```

示例：

- `balance.eclipse.explanation_p1`
- `monk.windwalker.combostrikes.tooltip`
- `restoration.rejuv.good_label`

#### 4. 新职业汉化流程

对尚未汉化的新职业，推荐流程：

1. 先扫描所有模块文件，列出需要翻译的字符串
2. 对每个字符串用 `t()` 包装（优先）或 `<Trans>` 包装
3. 运行 `pnpm run extract` 生成 message catalog
4. 在对应的 `content.json` 中填写中文翻译
5. 提交时将**源文件修改**和**翻译文件**分开 commit，便于 cherry-pick

#### 5. 文件覆盖系统（Guide 等高冲突文件）

CN 翻译版 Guide 放在 `src/localization/overrides/`，与上游源文件路径一一对应。构建时
`vite-plugins/cn-overrides.ts` 会自动用覆盖文件替换 `src/analysis/...` 中的同名模块。

- 上游 `src/analysis/retail/mage/frost/Guide.tsx` 保持与 upstream 一致（合并无冲突）
- CN 汉化版：`src/localization/overrides/analysis/retail/mage/frost/Guide.tsx`
- 新增职业覆盖：`bash scripts/migrate-guides-to-overrides.sh`（仅迁移有 diff 的 Guide）
- 注册表：`node scripts/generate-override-registry.mjs`

#### 6. 上游核心 i18n 文件（禁止改宏）

`scripts/upstream-i18n-core-files.txt` 列出的文件使用 upstream 的 `defineMessage` 模式。
**只**在 `src/localization/zh/messages.json` 填翻译，不要改成 `t()`。

#### 7. 同步后只需两步

```bash
# 第一步：一键修复所有 i18n 问题（Trans→t、defineMessage→t、修 import、修 JSX 语法）
node scripts/i18n-fix.mjs

# 第二步：检查 + typecheck（覆盖文件变更检测、核心 i18n 一致性）
bash scripts/post-merge-i18n-checks.sh backup/<branch>/<timestamp> midnight
```

可选步骤：

```bash
# 查找遗漏的翻译
python scripts/find_untranslated.py

# 更新 message catalog
pnpm run extract --clean
```
