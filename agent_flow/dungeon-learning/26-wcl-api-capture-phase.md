# Phase 26：配置化 WCL API 抓取与快照草稿生成

日期：2026-08-11

分支：`codex/dungeon-learning`

## 目标

把内容维护者已有权限的 WCL 服务接入 Phase 24/25 的事实快照流水线，减少“手工
导出 report/events JSON”这一步的操作成本，同时保持事实数据不进入浏览器运行时、
不自动注册副本、不自动生成 forces 或攻略结论。

## 输入与配置

- `--report-code=<code>` 是唯一必需的 WCL 报告身份；不能从标题或 URL 猜测。
- `--api-base=<url>` 或环境变量 `DUNGEON_WCL_API_BASE` 指定 API 根地址。地址必须是
  `http`/`https` 绝对 URL；代码不写死线上域名，也不把 token 写入文件。当前本地可
  配置为 `http://localhost:9528/v1`，部署环境通过环境变量配置现有 `rpglogs.cn`
  服务。
- `--fight-id` 继续沿用 Phase 25 的显式单场合同；不传时多 fight report 仍 fail-closed。
- 抓取器先读取 `report/fights/<code>`，根据已验证的 fight 时间范围请求 events 分页，
  汇总后再交给 `buildWclFactSnapshot`。不会把单页 `nextPageTimestamp` 传入下游。
- 每个 API 响应若带有 `code`/`reportCode`，必须与请求的 report code 一致；缺失 code 不会
  被代码伪造为已核验身份，而是交给下游的 draft warning/release error 门禁处理。
- 施法事件必须落在已解析的 `[start_time, end_time]` 闭区间内；范围外或缺 timestamp 的
  cast 直接阻断，避免把别的 fight 拼进当前事实。
- 默认抓取 events；`--skip-events` 只允许生成敌人目录 draft，并明确 warning。`--release`
  仍不能绕过 WCL 缺少 forces snapshot 的门禁。

## 安全与完整性边界

1. API 根地址不进入 FactSnapshot、runtime registry 或生产 bundle；输出只包含来源引用、
   ID、scope 和 digest。
2. HTTP 非 2xx、非 JSON、分页标记不递增、分页超过上限、整体超时/取消或报告范围不可验证时，命令
   fail-closed，不生成输出文件。
3. 单页响应默认限制为 16 MiB、总 events 默认限制为 250,000 条；可通过 CLI 显式降低或
   在受控环境提高，但仍有硬上限。抓取期间只保留下游需要的 cast 类事件。
4. 抓取器只允许读取 `report/fights` 与 `report/events` 两类 endpoint；不接受任意路径拼接。
5. 请求默认不发送 credentials；认证由用户部署的服务/现有环境负责。命令不接受把
   `Authorization` 写入 snapshot 的选项。
6. 已抓取的 report/events 不落库、不提交仓库；输出继续使用 Phase 24 的 atomic write
   和输入/输出隔离原则。

## 交付物

- `src/dungeon/runtime/wclFactSource.ts`：注入式 fetch、API base 规范化、fight 范围选择、
  events 分页汇总和稳定错误码。
- `scripts/dungeons/fact-from-wcl-api.ts`：配置化 CLI，复用 Phase 24/25 adapter；不修改
  `fetchWclApi`、CombatLogParser 或报告页面。
- runtime/CLI 测试：base URL、HTTP/JSON 错误、分页、单/多 fight、skip-events、输出
  `fightId` 与下游 digest 绑定。
- 本文档与 `agent_flow/dungeon-learning/README.md` 的操作说明。

## 使用示例

```bash
DUNGEON_WCL_API_BASE=http://localhost:9528/v1 pnpm dungeon:fact-from-wcl-api \
  --report-code=<report-code> \
  --fight-id=<fight-id> \
  --dungeon=ruby-life-pools \
  --build=<当前目标 build> \
  --out=./incoming/ruby-life-pools.wcl-facts.json \
  --evidence-ref=<WCL report URL/code> \
  --max-event-pages=100 \
  --json
```

生产/preview 使用部署方提供的 API base 环境变量；不能把本地地址或 remote-dev 认证配置
编译进前端。抓取完成后仍必须执行：

```text
fact-from-wcl-api
→ fact-check --build=<当前目标 build>
→ fact-binding-plan
→ 人工确认 sourceKey → WoWAnalyzerCN Enemy/Ability
→ fact-bind（仍只生成 draft）
→ forces 独立快照、内容审校与 publish 门禁
```

## 明确不在本 Phase

- 不在浏览器端自动请求 WCL 并把结果显示为正式攻略。
- 不保存真实 report/events、NPC、Spell 或 forces 文件到仓库。
- 不从 WCL 推导 forces、Pull 顺序、路线、技能动作、危险等级或角色建议。
- 不改变现有分析模块、WCL report selector 或登录/鉴权流程。

## 验收与下一步

- 配置本地或线上 API base 后，单 fight 报告能生成与手工 JSON 路径一致的 draft digest。
- 多 fight 未指定 fight ID、分页异常、跨 fight 范围和 API 错误均有稳定诊断且不写输出。
- `--skip-events` 的 enemy-only draft 保留明确 warning，不能被 release 误判为完整事实。
- 下一步仍需内容负责人提供当前 build 的真实报告和独立 forces 证据，进入逐本人工绑定。
