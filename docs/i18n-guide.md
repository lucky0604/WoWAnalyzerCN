# WoWAnalyzerCN 汉化开发指南

本文档面向开发者和 AI code agent，说明 CN fork 的国际化 (i18n) 架构、汉化流程和上游同步方式。

## 目录

- [项目背景](#项目背景)
- [代码结构](#代码结构)
- [i18n 技术栈](#i18n-技术栈)
- [翻译方式总览](#翻译方式总览)
- [新模块汉化流程](#新模块汉化流程)
- [文件覆盖系统](#文件覆盖系统)
- [关键规则](#关键规则)
- [上游同步完整流程](#上游同步完整流程)
- [常见问题排查](#常见问题排查)
- [脚本清单](#脚本清单)

---

## 项目背景

本项目是 [WoWAnalyzer/WoWAnalyzer](https://github.com/WoWAnalyzer/WoWAnalyzer) 的中文 fork。上游是纯英文项目，我们在此基础上添加中文国际化支持。核心目标：

1. 保持与上游的定期同步（获取新功能、新职业支持）
2. 尽量不修改上游源文件，减少合并冲突
3. 翻译工作独立于上游代码变更

---

## 代码结构

```
src/
├── analysis/                          # 上游分析模块（保持与 upstream 一致）
│   └── retail/{class}/{spec}/
│       ├── Guide.tsx                  # 上游原版（不要直接翻译）
│       ├── modules/
│       └── ...
├── localization/
│   ├── I18nProvider.tsx               # i18n 初始化，自动加载翻译
│   ├── zh/
│   │   ├── messages.json              # Lingui 主翻译目录（界面通用 + 核心文件翻译）
│   │   └── {class}/{spec}/
│   │       └── content.json           # 各职业专属翻译字典（零冲突）
│   └── overrides/
│       └── analysis/retail/{class}/{spec}/
│           └── Guide.tsx              # CN 翻译版 Guide（覆盖上游原版）
├── interface/                         # 界面组件
├── common/                            # 通用工具
├── game/                              # 游戏数据定义
└── parser/                            # 日志解析器

scripts/
├── sync-upstream.sh                   # 上游同步脚本
├── i18n-fix.mjs                       # 一键 i18n 修复（合并后运行）
├── post-merge-i18n-checks.sh          # 合并后检查（defineMessage 导入、覆盖文件变更等）
├── migrate-guides-to-overrides.sh     # 迁移 Guide 到覆盖目录
├── generate-override-registry.mjs     # 生成覆盖文件注册表
└── upstream-i18n-core-files.txt       # 上游核心 i18n 文件清单（禁止修改宏）

vite-plugins/
└── cn-overrides.ts                    # Vite 插件：构建时用覆盖文件替换上游模块
```

### 翻译文件加载机制

`I18nProvider.tsx` 在激活 locale 时：

1. 加载 `src/localization/zh/messages.json`（Lingui 主目录，包含界面通用翻译）
2. 用 `import.meta.glob('./zh/**/content.json')` 自动发现并加载所有职业 `content.json`
3. 合并后调用 `i18n.activate('zh')`

新增 `content.json` 无需修改任何代码，放到对应目录即可自动加载。

---

## i18n 技术栈

| 组件                  | 版本                           | 用途                                     |
| --------------------- | ------------------------------ | ---------------------------------------- |
| Lingui v6             | `@lingui/core` `@lingui/react` | i18n 运行时                              |
| `@lingui/core/macro`  | —                              | 提供 `t()` 和 `defineMessage()` 编译时宏 |
| `@lingui/react/macro` | —                              | 提供 `<Trans>` JSX 宏                    |
| `@lingui/vite-plugin` | —                              | Vite 构建时宏转换                        |

### 三个核心 API

| API                              | 返回类型            | 何时执行             | 模块顶层安全                    |
| -------------------------------- | ------------------- | -------------------- | ------------------------------- |
| `t({ id, message })`             | `string`            | 立即执行翻译         | **不安全**（i18n 未激活时报错） |
| `defineMessage({ id, message })` | `MessageDescriptor` | 只创建描述符，不翻译 | **安全**                        |
| `<Trans id="...">text</Trans>`   | `ReactNode`         | 渲染时翻译           | 只能在 JSX 中使用               |

**关键区别：** `t()` 会立即调用 `i18n._()`，如果在模块顶层（文件加载时）调用，此时 i18n 尚未激活，会报错：`Attempted to call a translation function without setting a locale`。需要翻译的模块顶层常量必须用 `defineMessage()`。

---

## 翻译方式总览

按冲突风险从低到高排列，优先使用上面的方式：

### 方式 1：`content.json` 翻译字典（零冲突，首选）

路径：`src/localization/zh/{class}/{spec}/content.json`

```json
{
  "monk.brewmaster.section.coreSkills": "核心技能",
  "monk.brewmaster.staggerManagement.description": "酒仙的核心防御循环使用<0>醉拳</0>..."
}
```

- 上游不会修改这些文件，永远不会冲突
- 新增文件无需改代码，自动被 `import.meta.glob` 发现并加载
- 所有翻译的最终目标都是写入 `content.json`

### 方式 2：`t()` 包装字符串（低冲突）

```typescript
// 在函数/组件内部使用
label: t({ id: 'spec.module.label', message: 'Original English' }),
```

- 只改一行，冲突面小
- **必须在函数体内调用**，不能放在模块顶层

### 方式 3：`<Trans>` 包装 JSX 段落（中高冲突）

```tsx
<Trans id="spec.module.paragraph">
  This is a paragraph with <SpellLink spell={SPELL} /> inside.
</Trans>
```

- 包含 JSX 子元素（`<SpellLink>` 等）时必须用 `<Trans>`
- 会重构整段 JSX，上游对该段的任何改动都会冲突
- 尽量避免，除非段落内嵌了 React 组件

### 方式 4：文件覆盖（零冲突，适用于大段翻译的文件）

将整个文件的 CN 翻译版放到 `src/localization/overrides/`，上游原文件保持不变。详见[文件覆盖系统](#文件覆盖系统)。

---

## 新模块汉化流程

以汉化 **猎人-兽王** 专精的分析模块为例：

### 第一步：创建翻译字典

```bash
mkdir -p src/localization/zh/hunter/beastmastery
```

创建 `src/localization/zh/hunter/beastmastery/content.json`：

```json
{
  "hunter.beastmastery.guide.section.core": "核心技能",
  "hunter.beastmastery.guide.beastCleave.title": "野兽群劈"
}
```

### 第二步：在源文件中标记需翻译的字符串

打开 `src/analysis/retail/hunter/beastmastery/modules/` 下的文件。

**短字符串（属性值、标签）用 `t()`：**

```typescript
import { t } from '@lingui/core/macro';

// 在类方法或函数体内
suggestions(when) {
  when(this.threshold).addSuggestion((suggest) =>
    suggest(t({ id: 'hunter.beastmastery.beastCleave.suggestion', message: 'Maintain Beast Cleave' }))
  );
}
```

**包含 React 组件的段落用 `<Trans>`：**

```tsx
import { Trans } from '@lingui/react/macro';

<Trans id="hunter.beastmastery.beastCleave.description">
  Keep <SpellLink spell={SPELLS.BEAST_CLEAVE} /> active during AoE.
</Trans>;
```

### 第三步：Message ID 命名规范

```
{class}.{spec}.{module}.{key}
```

示例：

- `hunter.beastmastery.beastCleave.suggestion`
- `monk.windwalker.combostrikes.tooltip`
- `druid.restoration.rejuv.good_label`

### 第四步：提取翻译条目

```bash
pnpm run extract --clean
```

这会更新 `src/localization/zh/messages.json`，新增的 message ID 初始值为空字符串。

### 第五步：填写翻译

在 `content.json` 中填写中文翻译（优先），或在 `messages.json` 中填写。

### 第六步：验证

```bash
pnpm run typecheck   # 类型检查
pnpm run dev          # 启动开发服务器，浏览器验证
```

### 第七步：提交

建议分两个 commit：

```bash
git add src/analysis/                    # 源文件修改（i18n 标记）
git commit -m "feat(i18n): add i18n markers for hunter/beastmastery"

git add src/localization/                # 翻译文件
git commit -m "feat(i18n): add zh translations for hunter/beastmastery"
```

分开 commit 便于 cherry-pick 和冲突解决。

---

## 文件覆盖系统

对于 Guide.tsx 这类需要大段翻译的文件，直接修改会导致每次同步都产生冲突。覆盖系统的方案是：

1. 上游 `src/analysis/retail/{class}/{spec}/Guide.tsx` 保持与 upstream 完全一致
2. CN 翻译版放在 `src/localization/overrides/analysis/retail/{class}/{spec}/Guide.tsx`
3. 构建时 `vite-plugins/cn-overrides.ts` 自动用覆盖文件替换原版

### 工作原理

Vite 插件 `cn-overrides` 在模块解析阶段拦截 import：

```
import 请求: ./Guide
           ↓
原始路径: src/analysis/retail/mage/frost/Guide.tsx
           ↓ 检查覆盖文件是否存在
覆盖路径: src/localization/overrides/analysis/retail/mage/frost/Guide.tsx
           ↓ 存在则重定向
实际加载: src/localization/overrides/...Guide.tsx
```

### 新增覆盖文件

**方法一：使用迁移脚本（批量）**

```bash
bash scripts/migrate-guides-to-overrides.sh
```

脚本会自动：

1. 检测哪些 Guide.tsx 与上游不同
2. 将 CN 修改版复制到 `overrides/` 目录
3. 还原 `src/analysis/` 中的原文件为上游版本
4. 更新覆盖注册表

**方法二：手动创建（单个文件）**

```bash
# 1. 创建目录
mkdir -p src/localization/overrides/analysis/retail/hunter/beastmastery

# 2. 复制原文件
cp src/analysis/retail/hunter/beastmastery/Guide.tsx \
   src/localization/overrides/analysis/retail/hunter/beastmastery/Guide.tsx

# 3. 在覆盖文件中进行翻译修改
# （编辑 src/localization/overrides/.../Guide.tsx）

# 4. 还原源文件为上游版本
git checkout upstream/midnight -- src/analysis/retail/hunter/beastmastery/Guide.tsx

# 5. 更新注册表
node scripts/generate-override-registry.mjs
```

### 覆盖文件内的 import 解析

覆盖文件可以正常使用相对路径 import 同目录的模块。Vite 插件会将 importer 的路径映射回原始 `src/` 目录来解析依赖：

```typescript
// src/localization/overrides/analysis/retail/mage/frost/Guide.tsx
import CombustionSection from './modules/combustion/CombustionSection';
// 解析为 → src/analysis/retail/mage/frost/modules/combustion/CombustionSection
```

### 注意事项

- `tsconfig.json` 已将 `src/localization/overrides/analysis/**` 加入 `exclude`，TypeScript 不会直接编译这些文件（由 Vite 插件处理）
- 上游更新了被覆盖的源文件时，`post-merge-i18n-checks.sh` 会发出警告，需要手动同步更新覆盖文件

---

## 关键规则

### 规则 1：不要修改核心 i18n 文件的宏

`scripts/upstream-i18n-core-files.txt` 中列出的文件使用上游的 `defineMessage()` 模式。只在 `zh/messages.json` 填翻译，不要改成 `t()`。

这些文件包括（完整清单见 `scripts/upstream-i18n-core-files.txt`）：

- `src/game/SPECS.ts` — 职业专精名称
- `src/game/DIFFICULTIES.ts` — 难度名称
- `src/game/GEAR_SLOTS.tsx` — 装备部位名称（模块顶层 `Record<number, JSX.Element>`）
- `src/parser/core/SPELL_CATEGORY.ts` — 技能分类名称
- `src/common/getBossName.ts` — Boss 名称
- 各职业 `CONFIG.tsx` — 模块顶层对象，使用 `<Trans>` 返回 JSX.Element
- 部分 `src/interface/` UI 组件（CharacterParses、GuildReports、PlayerLoader 等）
- 部分 spec 分析模块（MarrowrendUsage、Ossuary、RuneDetails 等）

### 规则 2：`t()` 不能在模块顶层调用

```typescript
// 错误：模块加载时 i18n 未激活，会报错
const pages = [
  { name: t({ id: 'page.news', message: 'News' }) }, // ✗
];

// 正确方式一：移到函数体内
function Component() {
  const pages = [
    { name: t({ id: 'page.news', message: 'News' }) }, // ✓
  ];
}

// 正确方式二：模块顶层用 defineMessage，渲染时再翻译
const pages = [
  { name: defineMessage({ id: 'page.news', message: 'News' }) }, // ✓
];
```

### 规则 3：`t()` 返回 string，`defineMessage()` 返回 MessageDescriptor

如果类型要求 `string`，用 `t()`（在函数体内）。
如果类型要求 `MessageDescriptor`，用 `defineMessage()`。

### 规则 4：覆盖文件 vs 源文件修改

| 场景                      | 方式                        |
| ------------------------- | --------------------------- |
| 短标签、tooltip、单行文本 | 在源文件中用 `t()`          |
| 包含 React 组件的段落     | 在源文件中用 `<Trans>`      |
| Guide.tsx 等大段翻译文件  | 使用文件覆盖系统            |
| 上游核心文件              | 只在 `messages.json` 填翻译 |

---

## 上游同步完整流程

### 一次性设置

```bash
# 添加上游 remote
git remote add upstream https://github.com/WoWAnalyzer/WoWAnalyzer.git

# 启用 rerere — 自动记住冲突解决方案，下次遇到相同冲突时自动复用
git config rerere.enabled true
```

### 同步步骤

#### 第一步：运行同步脚本

```bash
bash scripts/sync-upstream.sh
```

脚本会自动：

1. 检查工作区是否干净
2. `git fetch upstream`
3. 创建备份分支 `backup/{branch}/{timestamp}`
4. 执行 `git merge upstream/midnight --no-edit`
5. 如无冲突，自动运行合并后检查

#### 第二步：解决冲突（如有）

脚本会按优先级分类显示冲突文件：

| 优先级 | 类型                                         | 处理方式             |
| ------ | -------------------------------------------- | -------------------- |
| 1      | 基础设施（`package.json`、`vite.config.ts`） | 最优先解决，影响构建 |
| 2      | 翻译文件（`src/localization/`）              | 保留双方修改         |
| 3      | 分析模块（`src/analysis/`）                  | 数量多但模式一致     |

常见冲突模式和解决方式：

**import 行冲突** — 保留双方 import：

```typescript
import { t } from '@lingui/core/macro'; // 我们的
import { NewUpstreamThing } from '...'; // 上游的
```

**JSX 字符串包装冲突** — 接受上游逻辑变更，重新用 i18n 宏包装新文案。

**package.json** — 接受上游版本号，运行 `pnpm install`。

解决完成后：

```bash
git add .
git commit
```

#### 第三步：一键修复 i18n 问题

```bash
node scripts/i18n-fix.mjs
```

这个脚本在一次文件遍历中完成所有修复：

- 将纯文本 `<Trans>` 转为 `t()` 调用（降低冲突面）
- 将 CN 文件中不必要的 `defineMessage()` 转为 `t()`（模块顶层的会自动跳过）
- 修复缺失的 `defineMessage` / `t` import
- 修复 JSX 语法问题

可以先用 `--dry-run` 预览：

```bash
node scripts/i18n-fix.mjs --dry-run
```

#### 第四步：检查 + 类型验证

```bash
bash scripts/post-merge-i18n-checks.sh backup/{branch}/{timestamp} midnight
```

检查内容：

- `defineMessage` 导入完整性
- 上游核心 i18n 文件是否被意外修改
- 覆盖文件对应的上游源文件是否有更新（需要同步）
- `zh/messages.json` 中的空翻译条目
- `pnpm run typecheck`

#### 第五步：可选操作

```bash
# 查找遗漏的翻译
python scripts/find_untranslated.py

# 更新 message catalog
pnpm run extract --clean
```

### 回滚

```bash
# 查看备份分支
git branch | grep backup/

# 回滚到合并前
git reset --hard backup/midnight/20260602-110000
```

### 同步频率

建议每 1-2 周同步一次。如果上游有新版本或新职业支持，应及时同步。

### rerere 如何帮助

`git rerere` (reuse recorded resolution) 自动记住每次冲突的解决方式。第一次同步冲突最多，之后相同模式的冲突会自动解决。

---

## 常见问题排查

### 报错：Cannot find name 'defineMessage'

**原因：** 文件使用了 `defineMessage()` 但缺少 import。

**修复：**

```bash
node scripts/i18n-fix.mjs
```

或手动添加：

```typescript
import { defineMessage } from '@lingui/core/macro';
```

### 报错：Attempted to call a translation function without setting a locale

**原因：** `t()` 在模块顶层调用，此时 `i18n.activate()` 还未执行。

**修复：** 将包含 `t()` 的常量定义移到组件函数体内，或改用 `defineMessage()`。

### 报错：Type 'MessageDescriptor' is not assignable to type 'string'

**原因：** 在需要 `string` 的地方使用了 `defineMessage()`。

**修复：** 在函数体内改用 `t()` 或用 `i18n._(descriptor)` 将 `MessageDescriptor` 转为 string。

### 覆盖文件不生效

**检查：**

1. 覆盖文件路径是否正确：`src/localization/overrides/` 后接 `src/` 之后的相对路径
2. Vite 插件是否已在 `vite.config.ts` 中注册
3. 运行 `node scripts/generate-override-registry.mjs` 更新注册表

### typecheck 报重复定义

**原因：** `tsconfig.json` 未排除覆盖目录。

**检查：** `tsconfig.json` 的 `exclude` 数组应包含 `"src/localization/overrides/analysis/**"`。

---

## 脚本清单

| 脚本                                     | 用途                                    | 何时使用           |
| ---------------------------------------- | --------------------------------------- | ------------------ |
| `scripts/sync-upstream.sh`               | 合并上游最新代码                        | 定期同步时         |
| `scripts/i18n-fix.mjs`                   | 一键修复所有 i18n 问题                  | 同步后运行         |
| `scripts/post-merge-i18n-checks.sh`      | 合并后检查（导入、覆盖变更、typecheck） | 同步后运行         |
| `scripts/migrate-guides-to-overrides.sh` | 批量迁移 Guide 到覆盖目录               | 新增覆盖文件时     |
| `scripts/generate-override-registry.mjs` | 更新覆盖文件注册表                      | 手动新增覆盖文件后 |

`scripts/upstream-i18n-core-files.txt` 是配置文件，列出不应修改 i18n 宏的上游核心文件。

---

## 给 AI Code Agent 的提示

如果你是 AI 代码助手，请注意以下要点：

1. **翻译字符串时**，首选 `content.json`，其次 `t()`，最后 `<Trans>`
2. **不要在模块顶层使用 `t()`**，用 `defineMessage()` 代替
3. **不要修改** `scripts/upstream-i18n-core-files.txt` 中列出的文件的 i18n 宏
4. **Guide.tsx 翻译**应放在 `src/localization/overrides/` 目录，不要直接修改 `src/analysis/` 中的 Guide
5. **新增 `content.json` 后**不需要修改 `I18nProvider.tsx`，`import.meta.glob` 会自动发现
6. **Message ID 格式**：`{class}.{spec}.{module}.{key}`
7. **同步上游后**只需运行两个命令：`node scripts/i18n-fix.mjs` 然后 `bash scripts/post-merge-i18n-checks.sh`
