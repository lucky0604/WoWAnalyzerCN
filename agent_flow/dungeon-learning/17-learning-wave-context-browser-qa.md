# Learning Wave Context 浏览器 QA

日期：2026-08-11

分支：`codex/dungeon-learning`

代码提交：`5b0e591689`

## 环境

- 本地 Vite：`VITE_DUNGEON_ROUTES=true pnpm start -- --host 127.0.0.1`
- 页面：`/dungeons/ruby-life-pools/learn?mode=quick`
- 浏览器：gstack headless Chromium
- 视口：桌面 `1440×1000`，移动 `390×844`

## 结果

| 检查               | 结果                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| RLP 学习页首次加载 | 通过，内容草稿 banner、来源、章节、课节和路线上下文均出现                                      |
| 波次上下文         | 通过，显示 `路线节点 P1`、6 个位置参考锚点、怪物上下文和 `forces 待核验`                       |
| 事实门禁文案       | 通过，明确提示位置锚点不等于完整 Pull 或 forces 结论                                           |
| 主动回忆           | 通过，先选“有点模糊”后“显示参考答案”可用，进度更新为 `1/6`                                     |
| 角色切换           | 通过，切换治疗后 URL 带 `role=healer`，职责建议随角色更新                                      |
| Route 深链         | 通过，点击“打开只读路线节点 →”进入 `/dungeons/ruby-life-pools/route/rlp-phase1-learning-route` |
| Route 页面         | 通过，显示只读声明、5 个 Pull、位置参考锚点和待核验 forces，不出现编辑/保存入口                |
| 移动布局           | 通过，facts 栏单列，侧栏落到主内容后方，未发现横向溢出                                         |
| 控制台             | 无新增异常；仅有 React Router v7 future-flag warning                                           |

## 视觉观察

页面沿用现有 WoWAnalyzerCN 深色背景、金色强调、分层边框和 NavigationBar，波次卡片
没有引入独立的 MDT/Threechest 视觉语言。桌面上学习内容、章节侧栏与角色侧栏层级清晰；
移动端先呈现章节和课节，再呈现角色面板，符合“先学动作，再查路线”的目标。

## 未关闭事项

本 QA 只验证草稿学习闭环和只读空间入口。它不能替代 RLP 的事实发布门：当前 NPC、
Spell、forces、完整 Pull、作者自测、第二人审校、live build 版本和生产图片授权仍需
独立完成；因此页面继续保持 local preview，不进入 `reviewed/published`。
