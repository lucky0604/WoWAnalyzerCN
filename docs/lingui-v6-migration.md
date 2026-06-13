# Lingui v6 迁移记录

本文档记录 WoWAnalyzerCN 从 Lingui v5 升级到 v6 后的大规模 `<Trans>` 迁移过程，说明问题的根因、规模、修复方式和后续维护策略。

## 目录

- [背景](#背景)
- [根因分析](#根因分析)
- [迁移规模](#迁移规模)
- [修复策略](#修复策略)
- [为什么后续同步不会重演](#为什么后续同步不会重演)
- [后续维护流程](#后续维护流程)
- [参考文档](#参考文档)

---

## 背景

WoWAnalyzerCN 在初始化时引入了 Lingui v6 作为 i18n 方案。上游 WoWAnalyzer 使用 Lingui v5，两者在 `<Trans>` 宏的运行时行为上存在不兼容：

| 特性                        | Lingui v5 | Lingui v6              |
| --------------------------- | --------- | ---------------------- |
| `<Trans>` 含 `<SpellLink>`  | ✅ 正常   | ❌ DOM 嵌套错误        |
| `<Trans>` 含 `<br/>`        | ✅ 正常   | ❌ void element 错误   |
| `<Trans>` 含 `<strong>/<b>` | ✅ 正常   | ⚠️ 运行时警告          |
| `t()` 宏在模块顶层          | ✅ 安全   | ❌ locale 未激活时报错 |

> **注意**：Lingui v6 本身是正确的。上游的写法在 v5 中合法，v6 中不合法，因此所有违反规则的位置都需要迁移。

---

## 根因分析

### 问题链

```
Lingui v5 → v6 升级
    ↓
<Trans> 在 v6 中只能包含纯文本（text children only）
    ↓
WoWAnalyzer 大量使用 <SpellLink spell={...} /> 渲染技能图标链接
    ↓
SpellLink/SpellIcon → 渲染为 <a> 标签
    ↓
<a> 不能嵌套在 <Trans> 内 → "Cannot be descendant of <a>"
    ↓
82 个文件 495 个风险 <Trans> 块需要迁移
    ↓
另有非 JSX 上下文 t() macro 触发 lint 错误
```

### SpellLink 的渲染链

```tsx
// src/interface/SpellLink.tsx
<a href={spellTooltip(spellId, {...})}>
  <img src={iconPath} />
  {spellName}
</a>
```

`<SpellLink>` 渲染为 `<a>` 标签，放在 `<Trans>` 内就形成了嵌套 `<a>`。

### `<br/>` 问题

Lingui v6 的 `<Trans>` 使用 indexed 子元素机制，void elements（`<br/>`、`<img/>`、`<hr/>`）在其内部会导致渲染错误。

---

## 迁移规模

最终统计（截至 2026-06-13）：

| 指标                  | 数值                      |
| --------------------- | ------------------------- |
| 初始风险 `<Trans>` 块 | **495** 个（82 个文件）   |
| 最终剩余风险块        | **0**                     |
| 修改文件数            | **244** 个                |
| 新增代码行            | **3,576** 行              |
| 删除代码行            | **2,001** 行              |
| 耗时                  | 多个 session，总计约 2 周 |

### 修改文件分布

按类型分类：

| 类型                            | 文件数 |
| ------------------------------- | ------ |
| 分析模块 Guide 文件（retail）   | ~30    |
| 分析模块 Guide 文件（classic）  | ~2     |
| 独立模块文件（modules/spells/） | ~120   |
| 覆盖文件（overrides/）          | ~33    |
| i18n 基础设施                   | ~3     |
| 辅助脚本和文档                  | ~8     |
| UI 组件和界面                   | ~48    |

### 覆盖职业

以下专精的分析模块均有改动：

paladin（holy/protection/retribution）、druid（balance/feral/guardian/restoration）、monk（brewmaster/mistweaver/windwalker）、demonhunter（havoc/vengeance/devourer）、shaman（elemental/enhancement/restoration）、mage（arcane/fire/frost）、deathknight（blood/frost/unholy）、priest（discipline/holy/shadow）、rogue（assassination/outlaw/subtlety）、warrior（arms/fury）、evoker（devastation/augmentation/preservation）、warlock（affliction/demonology/destruction）、hunter（beastmastery/marksmanship/survival）

---

## 修复策略

### 策略 1：`<Trans>` → `t()` + 显式 JSX

对于包含 `<SpellLink>`、`<br/>`、`<strong>`、`<b>` 的 `<Trans>`：

```tsx
// 错误（Lingui v6 不允许）
<Trans id="spec.module.desc">
  Use <SpellLink spell={SPELL} /> when available<br />
  for maximum <strong>damage</strong>
</Trans>

// 正确
<>
  {t({ id: 'spec.module.desc.p1', message: 'Use ' })}
  <SpellLink spell={SPELL} />
  {t({ id: 'spec.module.desc.p2', message: ' when available' })}
  <br />
  <strong>{t({ id: 'spec.module.desc.strong', message: 'damage' })}</strong>
</>
```

### 策略 2：`t()` macro → `i18n._()`（非 JSX 上下文）

对于函数体外的 `t()` macro（触发 `lingui-t-macro-outside-jsx` lint 规则）：

```typescript
// 错误：模块顶层 t() 在 locale 激活前执行
const label = t({ id: 'spec.label', message: 'text' });

// 正确：使用 i18n._() 延迟执行
import { i18n } from '@lingui/core';
const label = i18n._({ id: 'spec.label', message: 'text' });
```

### 策略 3：安全 `<Trans>` 保留

纯文本 `<Trans>`（不含 `<SpellLink>`/`<br/>`/`<strong>`/`<b>`）保持不动。

### 检测工具

```bash
# 扫描所有风险 <Trans> 块
node scripts/i18n-fix.mjs --check-trans

# 输出示例
No problematic <Trans> blocks found. All clear.
```

---

## 为什么后续同步不会重演

### 1. 安全网已建立

`--check-trans` 扫描工具可以在每次 merge 后秒级检测出新引入的风险块。有检测手段，就不会漏。

### 2. Override 文件免疫上游改动

`src/localization/overrides/` 下的 33 个 Guide.tsx 是**完整副本**，上游怎么改源文件都不影响它们。`sync-upstream.sh` 的 `post_merge_checks()` 会检测 "上游改了源文件 → 提醒同步 override"，但不是自动渗透。

### 3. 上游不迁移

上游 WoWAnalyzer 仍用 Lingui v5，没有计划做 v6 迁移。他们继续使用 `<Trans>` + `<SpellLink>` 的模式。这意味着每次同步时新引入的风险块是**增量**的，不是全量重演。

### 4. 当前风险已清零

```bash
# 当前状态
--check-trans         → 0 风险块
oxlint target lint    → 0 错误
pnpm typecheck        → 通过
```

### 后续每次 sync 的预期工作量

| 场景                   | 工作量                    |
| ---------------------- | ------------------------- |
| 上游无新文件           | **0**                     |
| 上游新增一个 Guide.tsx | 1-5 个风险块 → 5 分钟修复 |
| 上游修改已有分析模块   | 0-3 个风险块 → 2-5 分钟   |
| 全面迁移（一次）       | **不可能再出现**          |

---

## 后续维护流程

每次同步上游后的完整流程（`docs/i18n-guide.md` 中已有详细步骤，以下仅列出与 v6 相关的关键检查）：

```bash
# 1. 合并上游代码
bash scripts/sync-upstream.sh

# 2. 解决冲突（如有），提交

# 3. 检测新引入的风险 <Trans> 块 ← 核心步骤
node scripts/i18n-fix.mjs --check-trans

# 4. 如果发现问题，手动修复（参考上方修复策略）
# 5. 全量 i18n 自动修复
node scripts/i18n-fix.mjs

# 6. 标准合并后检查
bash scripts/post-merge-i18n-checks.sh backup/<branch>/<timestamp> midnight

# 7. 类型检查
pnpm typecheck
```

**第 3 步 `--check-trans` 是 v6 兼容性的核心安全网。** 只要这一步输出 `All clear`，就不会再有迁移事故。

---

## 参考文档

- [汉化开发指南](i18n-guide.md) — 完整 i18n 架构、翻译方式和同步流程
- [上游同步指南](upstream-sync.md) — 同步脚本用法和冲突解决
- `scripts/sync-upstream.sh` — 上游同步自动化脚本
- `scripts/i18n-fix.mjs` — i18n 自动修复和检查工具
