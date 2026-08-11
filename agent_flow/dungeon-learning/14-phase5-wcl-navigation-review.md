# Phase 5A：WCL / 学习双向导航实现与对抗性 Review

日期：2026-08-11  
分支：`codex/dungeon-learning`

## 本轮范围

本轮只实现低耦合的 WCL 导航前置，不修改 `CombatLogParser`、Analyzer 或 WCL API 请求：

1. 正式副本 Inspector 的“已有 WCL 日志？”入口进入现有 report selector，使用
   `/?dungeon=<dungeonId>` 记录学习意图；该参数只改变输入框提示，不参与报告匹配或日志解析。
2. 已选中的 WCL fight 在报告上下文中异步加载 Dungeon adapter；只有匹配到
   `reviewed/published` 且通过正式校验的文档，才显示“查看副本攻略”深链。
3. 报告侧的 Dungeon 代码通过 dynamic import 加载，避免把 Dungeon catalog、地图和旧坐标库存放进报告初始 chunk。
4. Dungeon 正式路由默认仍关闭；部署必须显式设置 `VITE_DUNGEON_ROUTES=true`。Threechest legacy QA 路由即使开启正式路由，也只在 DEV 注册。

## 对抗性 Review 发现与修复

| 发现                                                         | 修复                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Lingui `t` 宏的 `message` 不能使用运行时条件表达式           | 保留静态 descriptor，把副本意图作为 JSX 外层条件分支                            |
| 从一个 fight 切换到另一个 fight 时可能短暂保留旧攻略链接     | optional bridge 每次 effect 开始先清空旧 path，并用 active 标记防止卸载后写状态 |
| 生产正式内容存在时，原先 DEV-only route 会让 report 深链 404 | 增加显式 `VITE_DUNGEON_ROUTES` release flag；legacy 坐标 route 仍锁定 DEV       |
| Dungeon optional chunk 加载失败不应影响日志分析              | dynamic import catch 后保持 report 正常，不把 Dungeon 当作 parser 前置依赖      |
| “副本意图”可能被误解为已经选定了日志                         | 文档和代码都将 query 明确限定为 UI hint，report 仍必须由用户粘贴/选择 WCL 日志  |

## 验证证据

- 受影响 Dungeon/UI/WCL/dist-guard suite：22 files，100 tests passed。
- `pnpm dungeon:check`：通过；8 个 S2 catalog、8 个 legacy coordinate snapshot。
- `pnpm dungeon:generate -- --dungeon=all --check`：8 个 legacy snapshot 全部通过。
- `pnpm typecheck`、受影响文件 `oxlint`：通过。
- `pnpm build`：通过；保留仓库既有 LightningCSS `:global`、大 chunk 和 plugin timing warning。
- `pnpm dungeon:check-dist`：默认 production build 通过，755 个产物扫描；开启正式路由后曾发现 provider 标识符误报，已收窄门禁并重新验证具体 Threechest URL 不泄漏。

## 尚未满足的 Phase 5B 条件

- RLP 仍未有当前 S2 的空间、forces、作者自测和第二人审校证据，因此 report adapter 当前不会产生真实学习链接。
- 正式部署前仍需批准 OSS 图片 manifest、开启 `VITE_DUNGEON_ROUTES=true`，并执行生产浏览器 QA。
- WCL 报告识别仍遵守“verified encounter ID 优先、标题只作保守 fallback”；没有把模糊标题当成事实。
