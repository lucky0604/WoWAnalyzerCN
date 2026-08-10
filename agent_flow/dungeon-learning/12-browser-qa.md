# 浏览器级 QA 记录

> 执行日期：2026-08-10
> 分支：`codex/dungeon-learning`
> 环境：Vite `localhost:3000`、本机 Google Chrome（Playwright 1.54.2 驱动，headless）、桌面 `1440×1000`、移动 `390×844`

## 关键流程

| 流程                 | 结果 | 证据                                                                     |
| -------------------- | ---- | ------------------------------------------------------------------------ |
| `/dungeons` 覆盖路线 | 通过 | 能看到 S2 八本状态卡，RLP 显示为知识草稿，未审校副本没有正式学习 CTA     |
| RLP `quick` 学习     | 通过 | 章节、动作/后果、角色切换、置信度选择和答案揭示均可操作                  |
| `review=weak`        | 通过 | 完成一个场景后进入“只复习薄弱项”，URL 保留稳定 Situation ID              |
| Route 只读页         | 通过 | 能看到学习路线、Pull 原因和位置门禁；没有编辑、导入或保存按钮            |
| Inspector 地图控制   | 通过 | 地图收起/展开、地图聚焦和 Escape 退出均正常；floor 深链未丢失            |
| legacy Threechest QA | 通过 | `/dungeons/legacy/magi` 展示隔离的坐标索引和快照审计，不混入 S2 学习目录 |
| 移动端 RLP 学习      | 通过 | `390×844` 无横向溢出，章节、课件、角色侧栏按纵向顺序可学习               |

## 自动检查

- 上述页面未产生 console error 或 page error。
- 桌面和移动页面 `document.documentElement.scrollWidth` 未超过 viewport。
- 学习页底部显示可读的“分享本节链接”，不再直接展示原始 query 字符串。
- 视觉截图使用临时文件保存于 `/tmp`，没有进入生产资源或仓库。

## 未覆盖范围

- 真实远程 Threechest 图片加载只在配置 `VITE_DUNGEON_ASSET_PROVIDER=remote-dev` 的本地环境验证；默认测试环境使用 placeholder，因此本次 QA 不把外部网络可用性当作功能前提。
- RLP 仍是 `draft + spatial pending + forces pending`；浏览器流程通过不代表可以发布正式路线。
- WCL 正式学习入口仍等待 `reviewed/published` 文档，不在本地草稿阶段强行展示。
