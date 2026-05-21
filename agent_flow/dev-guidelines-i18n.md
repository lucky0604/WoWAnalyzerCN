# 开发规范: WoWAnalyzerCN 汉化与上游同步

> **适用范围**: 所有对 WoWAnalyzerCN 进行汉化、功能开发或上游同步的开发者（含 AI Agent）
> **最后更新**: 2026-05-21

---

## 1. 项目架构概览

WoWAnalyzerCN 是 [WoWAnalyzer/WoWAnalyzer](https://github.com/WoWAnalyzer/WoWAnalyzer) 的中文 fork。汉化涉及两个独立的翻译体系：

```
WoWAnalyzerCN 翻译体系
├── Lingui i18n（静态 UI 文本）
│   ├── messages.json — 全局 UI 字符串（按钮、导航、提示等）
│   ├── content.json — 各职业/专精分析模块的文字（按 class/spec 组织）
│   └── 工具: t() 宏、<Trans> 组件
│
└── CN_MAPPING（动态 API 数据）
    ├── bossNames.ts — Boss encounter ID → 中文名
    ├── zoneNames.ts — Zone ID → 中文名
    ├── dungeonNames.ts — Dungeon slug → 中文名
    └── 工具: getBossDisplayName() 查找函数
```

两个体系互补，不互相覆盖。

---

## 2. Lingui i18n 汉化规范

### 2.1 技术栈

- **框架**: Lingui v5（`@lingui/core`、`@lingui/react`、`@lingui/core/macro`、`@lingui/react/macro`）
- **构建集成**: `@lingui/swc-plugin` + `@vitejs/plugin-react-swc`
- **翻译文件格式**: JSON（`src/localization/{locale}/messages.json`）
- **默认语言**: `zh`（中文）

### 2.2 翻译文件组织

```
src/localization/
├── en/messages.json          # 英文（lingui extract 输出）
├── zh/messages.json          # 中文全局 UI 翻译
└── zh/                       # CN fork 特有：按职业/专精的翻译字典
    ├── druid/
    │   ├── balance/content.json
    │   ├── feral/content.json
    │   ├── guardian/content.json
    │   └── restoration/content.json
    ├── monk/
    │   ├── brewmaster/content.json
    │   ├── mistweaver/content.json
    │   └── windwalker/content.json
    ├── shaman/
    │   ├── elemental/content.json
    │   ├── enhancement/content.json
    │   └── restoration/content.json
    └── ... (其他职业)
```

`I18nProvider.tsx` 在加载 `messages.json` 后，自动合并 `SPEC_TRANSLATIONS` 中注册的各 `content.json` 文件。

### 2.3 两种汉化宏的使用规则

#### `t()` — 用于纯字符串（推荐优先使用）

```typescript
import { t } from '@lingui/core/macro';

// 适用于: title、label、tooltip、alt 等接受 string 的属性
label: t({ id: 'spec.module.label', message: 'Original English' }),
```

- 返回类型: `string`
- 兼容所有接受 `string` 的 prop
- 仅修改一行代码，合并冲突面最小

#### `<Trans>` — 用于含 JSX 的富文本

```typescript
import { Trans } from '@lingui/react/macro';

// 适用于: 包含 <SpellLink>、<b> 等 JSX 组件的段落
<Trans id="spec.module.explanation">
  Use <SpellLink spell={SPELL} /> to maximize your damage.
</Trans>
```

- 返回类型: `ReactNode`
- 用于混合文本+组件的场景
- 会重构整段 JSX，合并冲突面较大

#### 禁止使用 `defineMessage()`

`defineMessage()` 返回 `MessageDescriptor` 类型，不兼容 `string` 或 `ReactNode`，会导致 TypeScript 类型错误。所有需要 `defineMessage` 的场景一律改用 `t()`。

### 2.4 Message ID 命名规范

```
{spec}.{module}.{key}
```

| 示例 | 含义 |
|------|------|
| `balance.eclipse.explanation_p1` | 平衡德 Eclipse 模块 说明段落1 |
| `monk.windwalker.combostrikes.tooltip` | 踏风武僧 ComboStrikes 工具提示 |
| `restoration.rejuv.good_label` | 恢复德 Rejuvenation 好的标签 |
| `common.interface.loading` | 全局界面 加载中 |

规则：
- 使用英文小写，用 `.` 分隔层级
- 避免过长 ID，保持可读性
- 与上游已有的 ID 命名保持一致

### 2.5 翻译层级策略（按冲突风险排序）

| 优先级 | 方式 | 冲突风险 | 适用场景 |
|--------|------|----------|----------|
| 1 | `content.json` 翻译字典 | 无 | 所有已有 message ID 的字符串 |
| 2 | `t()` 包装单个字符串 | 低 | 短标签、tooltip、属性值 |
| 3 | `<Trans>` 包装 JSX | 中-高 | 含组件的段落（无法用 `t()` 的场景） |

**核心原则**: 能用 `t()` 解决的就不用 `<Trans>`；翻译内容写入 `content.json`，源文件只是载体。

---

## 3. 新职业/专精汉化流程

### 3.1 标准步骤

1. **扫描**: 列出目标专精 `src/analysis/retail/{class}/{spec}/` 下所有包含硬编码英文的 `.tsx` 文件
2. **包装**: 对每个英文字符串添加 `t()` 或 `<Trans>` 包装，并分配 message ID
3. **提取**: 运行 `pnpm run extract` 更新 message catalog
4. **翻译**: 在 `src/localization/zh/{class}/{spec}/content.json` 中填写中文翻译
5. **注册**: 在 `I18nProvider.tsx` 的 `SPEC_TRANSLATIONS` 中注册新的 `content.json`（如尚未注册）
6. **验证**: 运行 `pnpm run typecheck` 确保零错误

### 3.2 常见需要汉化的位置

| 位置 | 方式 | 示例 |
|------|------|------|
| `CONFIG.tsx` 中的 description | `<Trans>` | Guide 页面的职业/专精介绍 |
| `Guide.tsx` 中的 explanation | `<Trans>` | 各 section 的说明段落 |
| `statistic()` 方法中的 tooltip | `<Trans>` 或 `t()` | 统计面板的提示文字 |
| `statistic()` 方法中的 label | `t()` | 统计面板的标签 |
| `CastSummaryAndBreakdown` 的 explanation | `<Trans>` | 施法统计的说明 |
| `addInefficientCastReason` 的 message | `t()` | 低效施法原因 |
| `RoundedPanel` 的 title | `t()` | 面板标题 |
| 各种 `castNote` / `freeNote` | `t()` | 时间轴上的施法注释 |

### 3.3 提交规范

将源文件修改和翻译文件**分开 commit**：

```bash
# Commit 1: 源文件的 i18n 包装
git add src/analysis/retail/druid/balance/
git commit -m "feat(i18n): wrap balance druid modules with t()/Trans macros"

# Commit 2: 翻译文件
git add src/localization/zh/druid/balance/
git commit -m "feat(i18n): add Chinese translations for balance druid"
```

这样在上游同步遇到冲突时，翻译文件（commit 2）可以轻松 cherry-pick 到新版本上。

---

## 4. CN_MAPPING 动态数据汉化规范

### 4.1 适用范围

用于翻译来自 WCL API 的动态数据（Boss 名、Zone 名等），这些数据无法通过 Lingui 静态翻译覆盖。

### 4.2 数据模块位置

```
src/common/CN_MAPPING/
├── index.ts           # 统一导出和查找函数
├── bossNames.ts       # Boss encounter ID → 中文名
├── zoneNames.ts       # Zone ID → 中文名
├── dungeonNames.ts    # Dungeon slug → 中文名
└── seasonNames.ts     # 赛季中英文映射
```

### 4.3 查找函数规范

- 返回 `string | null`，未命中返回 `null`（不抛异常）
- 调用方负责处理 fallback（通常回退到 API 返回的英文名）
- O(1) hash lookup，无性能顾虑

### 4.4 新版本数据更新

当新的团队副本或地下城赛季上线时：
1. 从游戏数据源获取新的 Boss/Zone 中文名
2. 追加到对应的 `CN_MAPPING/*.ts` 文件
3. 更新 `game/raids/` 下对应 boss 定义的 `name` 字段
4. 运行 `pnpm run typecheck` 验证

---

## 5. 上游同步规范

### 5.1 基础设施

| 配置 | 说明 |
|------|------|
| upstream remote | `https://github.com/WoWAnalyzer/WoWAnalyzer.git` |
| git rerere | 已启用 — 自动记住并复用冲突解决方案 |
| 同步脚本 | `scripts/sync-upstream.sh` |
| 完整文档 | `docs/upstream-sync.md` |

### 5.2 同步频率

- **常规**: 每 1-2 周一次
- **紧急**: 上游发布重要功能或修复后立即同步
- **版本节点**: 新资料片/赛季上线时全量同步

### 5.3 同步操作

```bash
# 确保工作区干净
git stash  # 或 git commit

# 运行同步脚本（自动创建备份、分类展示冲突）
bash scripts/sync-upstream.sh

# 如有冲突，按优先级解决
# 1. 基础设施文件（package.json, vite.config.ts）
# 2. 翻译文件（src/localization/）
# 3. 分析模块（src/analysis/）

# 解决后
git add .
git commit

# 验证
pnpm install
pnpm run typecheck
```

### 5.4 冲突解决原则

| 冲突类型 | 解决策略 |
|----------|----------|
| import 行 | 保留双方（上游新增 + 我们的 lingui import） |
| JSX 被 `<Trans>` 包装 | 接受上游逻辑变更，重新包装 + 更新 `content.json` |
| `package.json` 依赖版本 | 接受上游版本，运行 `pnpm install` 验证 |
| `vite.config.ts` | 合并双方配置（上游新插件 + 我们的 SWC 配置） |
| `I18nProvider.tsx` | 保留我们的 `SPEC_TRANSLATIONS` 逻辑 |

### 5.5 同步后检查清单

```bash
pnpm install                      # 安装依赖
pnpm run typecheck                # 类型检查（零容忍）
pnpm run extract --clean          # 更新翻译 catalog
python scripts/find_untranslated.py  # 查找遗漏翻译
```

---

## 6. 已知冲突热点

| 文件/目录 | 原因 | 冲突概率 |
|-----------|------|----------|
| `src/localization/I18nProvider.tsx` | CN fork 添加了 `SPEC_TRANSLATIONS` | 高 |
| `package.json` | lingui 版本差异 | 高 |
| `vite.config.ts` | SWC vs Babel 构建方式 | 高 |
| `src/analysis/retail/monk/**` | 70+ 文件 i18n 包装 | 中 |
| `src/analysis/retail/druid/**` | 67+ 文件 i18n 包装 | 中 |
| `src/analysis/retail/shaman/**` | 17+ 文件 i18n 包装 | 中 |
| `src/interface/reducers/language.ts` | 默认语言改为 `zh` | 低 |

---

## 7. 禁止事项

1. **禁止使用 `defineMessage()`** — 改用 `t()`，避免 `MessageDescriptor` 类型不兼容
2. **禁止在 `t()` 中使用 `values` 属性** — Lingui v5 的 `t()` 不支持 `values`，用模板字符串替代
3. **禁止在 `<Trans>` 中使用 `values` 属性** — 变量通过 JSX children 隐式传入
4. **禁止修改上游的 i18n 架构** — 我们的汉化是加法操作，不删改上游已有的 i18n 基础
5. **禁止在 `content.json` 中使用自动生成的 hash ID** — 必须使用有意义的命名 ID

---

## 8. 相关文件速查

| 文件 | 用途 |
|------|------|
| `src/localization/I18nProvider.tsx` | i18n 初始化 + `SPEC_TRANSLATIONS` 加载 |
| `src/localization/zh/messages.json` | 全局中文翻译 |
| `src/localization/zh/{class}/{spec}/content.json` | 各专精中文翻译 |
| `lingui.config.ts` | Lingui 配置（catalog 路径、locale 列表） |
| `src/common/CN_MAPPING/` | 动态数据中文映射 |
| `src/common/getBossDisplayName.ts` | Boss 名中文查找函数 |
| `scripts/sync-upstream.sh` | 上游同步脚本 |
| `docs/upstream-sync.md` | 上游同步完整指南 |
