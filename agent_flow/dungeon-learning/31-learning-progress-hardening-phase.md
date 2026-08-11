# Phase 31：学习进度存储合同加固

日期：2026-08-11

分支：`codex/dungeon-learning`

## 背景

学习页已经支持“先回忆、再揭示”和薄弱项复习，但进度来自浏览器可修改的
`localStorage`。旧实现只检查顶层 `version/byDungeon`，损坏的嵌套记录、非法角色、伪造时间戳或
原型污染键仍可能进入运行时，随后在学习页计算复习状态时产生错误结果或异常。

本阶段只加固 Dungeon Learning 自己的 progress runtime，不修改 parser、analysis、报告数据或
正式内容门禁；无法解析的本地数据应丢弃为安全的空/部分进度，不能阻断学习页面。

## 合同

1. `readLearningProgress` 只接受 `version=1`、普通对象、合法角色、合法置信度、布尔 `revealed`、
   可解析的 UTC ISO `updatedAt` 和非空 `contentFingerprint`。
2. 顶层合同错误（包括非法 `lastRole`）返回空进度；单个 Dungeon/Situation 记录错误只丢弃该
   记录，保留同一存储中其它合法记录。
3. `__proto__`、`constructor`、`prototype` 等危险键不进入返回对象。
4. `writeLearningProgress` 不把不符合合同的运行时对象写入 storage；storage 不可用、配额失败、
   JSON 序列化失败或超过本地 payload/记录上限时返回 `false`，不伪造“已保存”。
5. `recordRecall` 对运行时非法 dungeon/situation/confidence fail-closed，合法路径保持不可变
   更新和现有 fingerprint 行为。

## 退出标准

- 新增 malformed nested record、旧 schema、非法 role/time/confidence、危险键、部分恢复和写入拒绝
  的单元测试。
- 现有 dungeon/runtime、scripts、typecheck、`dungeon:check` 和生产构建继续通过。
- 不修改 `src/parser/**`、`src/analysis/**`，不写入任何当前 build NPC/Spell/forces 数据。
