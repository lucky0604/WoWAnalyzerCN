# 02 · 数据流程与 API 层

本文梳理数据从"WCL 战斗日志"到"分析结果"的完整流动，以及背后的 API 客户端、报告加载管线、状态管理与缓存。

## 1. WCL API 客户端（`src/common/`）

### 1.1 `fetchWclApi.ts` —— HTTP 客户端与端点封装

核心导出：

- `fetchWcl<T>(endpoint, queryParams, options?, noCache?)` —— 通用单请求抓取器。用 `makeWclApiUrl` 拼 URL，`fetch` 时按跨域决定是否携带 credentials，60s 超时，并把 HTTP 状态/码映射为类型化错误。
- 错误类：`ApiDownError`、`LogNotFoundError`、`CharacterNotFoundError`、`GuildNotFoundError`、`UnauthorizedError`、`JsonParseError`、`WclApiError`、`UnknownApiError`、`CorruptResponseError`。
- 端点封装：
  - `fetchFights(code, refresh?)` → `report/fights/{code}`，自动重试已知 WCL bug（缺 `fights` 数组、translate 失败）。返回 `WCLFightsResponse`（= `WCLReport`）。
  - `fetchEvents(reportCode, fightStart, fightEnd, actorId?, filter?, maxPages=3)` → 按 `nextPageTimestamp` 分页拉 `report/events/{code}`，合并返回 `AnyEvent[]`。**这是核心战斗事件流**。
  - `fetchCombatants(code, start, end)` → 用过滤器 `type="combatantinfo"` 拉玩家信息事件。
  - `fetchTable<T>(...)` → `report/tables/{tableName}/{code}` 聚合表（少用）。
- `toJson(response)` —— 手工解析 JSON，修复德文日志中的控制字符与法术名未转义引号，失败时上报 Sentry。

### 1.2 `makeWclApiUrl.ts` —— URL 构建（含 CN 分流）

按优先级解析 API 基址：

1. **`VITE_WCL_API_BASE` 已设置** → 直连该完整 URL（如 `https://wcl-live-mp.rpglogs.cn`），拼 `/v1/{endpoint}`。这是国服直连模式。
2. **`VITE_WCL_DIRECT === 'true'`** → 同源 `/wcl-api/{endpoint}`（dev 时 Vite 代理到本地 `wcl-proxy-server` 端口 9528，该代理自带认证）。
3. **否则** → `makeApiUrl('v1/'+endpoint)` → 上游 `wowanalyzer.com/i/` 代理（原版默认）。

### 1.3 `makeApiUrl.ts` —— 上游应用代理

- `makeApiUrl(endpoint, ...)` → `{VITE_SERVER_BASE}{VITE_API_BASE}i/{endpoint}`。
- `makeCharacterApiUrl(...)` → 构建 `i/character[/classic]/[id]/[region]/[realmSlug]/[name]`，realm slug 经 `game/REALMS` 解析。
- `makeGuildApiUrl(...)` → 类似 `i/guild/...`。

### 1.4 `WCL_TYPES.ts` —— 响应类型

`WCLResponseJSON`（各响应形状的联合）、`WCLFightsResponse = WCLReport`、`WCLEventsResponse { events; nextPageTimestamp? }`、`WCLGuildReportsResponse`、`WCLRankingsResponse`、`WCLParsesResponse`、各类 table 响应、`WclTable` 枚举（summary/damage-done/…/threat）。事件类型化于 `src/parser/core/Events.ts`（`AnyEvent`）。

### 1.5 认证模型

- v1 API key **不随浏览器发送**，由代理/服务器持有（直连国服端点、`/wcl-api` Vite 代理都自带认证）。`.env.example` 里虽然有可选 `VITE_WCL_API_KEY`，但客户端抓取路径并未引用。
- CN 英雄榜网关使用另一套同源认证（见 §3）。

## 2. 报告加载管线（`report/:reportCode`）

### 2.1 路由入口

`src/interface/App.tsx` 中 `report/:reportCode/:fightId?/:player?/:build?` 懒加载 `./report`，即 `src/interface/report/index.tsx`。

### 2.2 `index.tsx` —— 编排组件

`Component()` 渲染嵌套管线：

```
NavigationBar
  → ReportLoader               (拉取 fights JSON)
    → ReportExpansionContextProvider
      → PatchChecker
        → FightSelection       (选择战斗)
          → PlayerLoader       (SWR 拉玩家列表)
            → SupportChecker
              → ResultsLoader  (拉事件 + 解析)
```

`ResultsLoader`（同文件内）是分析阶段的总编排：调用 `useParser`（加载专精 `CombatLogParser` 类）、`useEvents`（拉事件）、`useBossPhaseEvents`、`useCharacterProfile`、`useTimeEventFilter`（阶段/时间过滤）、`useEventParser`（分批次解析），最后渲染 `<Results>`。

### 2.3 `ReportLoader.tsx` —— 抓取器

- 从 URL 参数读 `reportCode`/`fightId`，调 `fetchFights(code, refresh)` 得到 `WCLReport`。
- 包装成 `Report = { ...WCLReport, code, isAnonymous }`（匿名码以 `a:` 开头）。
- 存在**本地 React state**（`useState<Report|null>`），同时 `dispatch(setReport/clearReport)` 到 Redux `navigation`（供导航栏显示标题），再经 `<ReportProvider>` 提供给子组件。
- 错误经 `handleApiError` 处理；强制刷新通过 sessionStorage key `report:last-force-refresh` 做 30s 限流。

### 2.4 上下文存储（报告不在 Redux）

- `context/ReportContext.tsx` —— `ReportProvider` / `useReport()`（React 19 `use()`）。
- `context/FightContext.tsx` —— `FightProvider` / `useFight()`。
- `context/PlayerContext.tsx` —— `PlayerProvider` / `usePlayer()`（给出 `player` + `allPlayers`）。
- `context/PatchContext.tsx` —— 补丁信息，`useEventParser` 会读。

### 2.5 事件抓取与解析

- `hooks/useEvents.ts` —— 分页 `report/events/{code}`，`translate: true`，按 `nextPageTimestamp` 递归翻页。
- `hooks/useParser.ts` —— 用 `retryingPromise` 动态 import 专精的 `CombatLogParser` 类。
- `hooks/useEventParser.ts` —— 实例化 `new parserClass(config, report, player, fight, playerCombatantInfo, characterProfile, allPlayers)`，调 `parser.normalize(events)`，再以约 66ms 批次（`requestIdleCallback` 调度）逐条 `EventEmitter.triggerEvent`，避免阻塞 UI，更新 `progress`；完成后 `parser.finish()`，并通过 `common/server-metrics.ts` 上报 `serverMetrics`。

## 3. CN 英雄榜网关（`src/common/fetchCnArmory.ts`）

这是国服角色资料的**唯一来源**（国服角色不走上游 `/i/character`）。

### 3.1 网关客户端导出

- `fetchCnCharacterProfile({guid, realm, name})` —— 一步入口：`fetchCharacterSummaryDeduped` → `buildCharacterProfile`，返回 WoWAnalyzer 的 `CharacterProfile` 或 `null`（失败静默降级）。
- `fetchCharacterSummary({realm, name})` —— `GET {base}/index?realm_slug=<slug>&role_name=<name>`，带 `auth` 头。
- `fetchCharacterDetail(token, apiType, options)` —— `GET {base}/do?token=...&api=...`（可选补专精详情）。
- `fetchCharacterSummaryDeduped({realm, name})` —— in-flight Promise 去重（模块级 `Map`，key `realm|name`），应对网关限流（错误码 3004）。
- `encrypto(str, xor=471, hex=25)` —— wcl-mp 同款 XOR + 变进制签名，用于构造 `makeAuthHeader()`（时间戳）。
- `cnRealmSlug(realm)` —— 国服服务器名 → 罗马化 slug，优先 `CN_SERVER_SLUG`，兜底 `REALMS.CN`，最后原样返回。
- `buildCharacterProfile(guid, data)` —— 把 CN 网关结构组装成 `CharacterProfile`（映射国服阵营字符串→int、中文种族名→Blizzard race id 经 `CN_RACE_TO_ID`、性别字符串→int）。

### 3.2 基址与 CORS 处理

```ts
const CN_ARMORY_BASE =
  import.meta.env.VITE_CN_ARMORY_BASE || '/cn-armory/wow-armory-server/api';
```

采用**同源相对路径**，因为网关（`webapi.rpglogs.cn`）CORS 不允许自定义 `auth` 头，浏览器跨域直连会被 preflight 拦截。同源请求无 preflight，`auth` 头可正常发送。dev 由 Vite proxy、生产由 nginx 转发（见 §5）。

### 3.3 CN vs 非 CN 路由

- `interface/report/hooks/useCharacterProfile.ts` —— `isCnRegion(region)`（`region === 'cn'`）→ 调 `fetchCnCharacterProfile`；非 CN 走上游 `makeCharacterApiUrl`。优先从 `report.exportedCharacters`（匹配 `player.name`）解析 region/realm/name，兜底用 `player`。
- `interface/reducers/charactersById.ts` —— `fetchCharacter` async thunk；`region === 'cn'` 时返回 `fetchCnCharacterProfile`（静默降级，不 404）；否则上游路径（未支持区域抛 `Region not supported`）。
- `interface/report/PlayerTile.tsx` —— 守卫已放行 CN 区域以触发 CN 抓取。
- `interface/CharacterParses.tsx`（约 302 行）—— 角色页对 CN 跳过 battle.net 图片抓取（无 CN API），用 `FALLBACK_PICTURE`；解析数据仍走 `fetchWcl('parses/character/...')`。

## 4. 状态管理

### 4.1 SWR

`PlayerLoader.tsx`：`useSWR<PlayerDetailsResponse>(makeApiUrl('v2/report/{code}/fight/{id}/players'), { fetcher, isPaused })` —— Redux 之外的服务器数据缓存，专用于玩家名册。

### 4.2 Redux 与角色缓存

- `charactersById`（`Record<number, CharacterProfile>`）+ `fetchCharacter` thunk（CN 分支）。`PlayerTile` 渲染时 `useWaSelector(getCharacterById(state, guid))`，缺失则 `dispatch(fetchCharacter(...))`。
- 头像经 `makeThumbnailUrl(characterInfo, classic)`（`src/interface/makeAnalyzerUrl.ts`）按区域选择渲染主机。

### 4.3 URL 选择器

`src/interface/selectors/url/report/`：`getReportCode`、`getFightId`、`getPlayerId`、`getPlayerName`、`getBuild`、`getResultTab`、`getMatch`、`getFightParts` —— 解析 `/report/:reportCode/:fightId/:player/:build/:resultTab` 路径。`getPlayerId`/`getPlayerName` 会在 `-` 处拆分（如 `1234-PlayerName`）。

## 5. 战斗/玩家选择

- **战斗选择** `FightSelection.tsx`：读 `fightId` 参数在 `report.fights` 中查找；无有效战斗则渲染 `FightSelectionList`（含 `FightSelectionPanel`/`FightSelectionPanelList`，击杀过滤、刷新、时长/版本警告）；命中则 `dispatch(setFight)` 并用 `<FightProvider>` 包裹。
- **玩家选择** `PlayerLoader.tsx`：SWR 拉玩家列表；只给名字的 URL 会重定向到带 id 的形式；无匹配玩家则渲染 `PlayerSelection`（`PlayerTile` 网格）+ `ReportRaidBuffList` + `RaidCompositionDetails`；命中则 `getConfig(...)` 后 `<PlayerProvider>` 包裹。
- `PlayerTile.tsx`：可点击卡片（专精图标、ilvl、职业颜色），链接 `makeUrl(player.id)`，触发 `fetchCharacter`（CN 网关感知）以显示头像。

## 6. 环境变量与代理

### dev（`vite.config.ts`）

- `/wcl-api` → `http://localhost:9528`（本地 `wcl-proxy-server`），重写 `/wcl-api → /v1`。设 `VITE_WCL_DIRECT=true` 时生效。
- `/cn-armory` → `https://webapi.rpglogs.cn`，重写剥离 `/cn-armory` 前缀（消除会拦截 `auth` 头的 CORS preflight）。

### 生产（nginx）

`default.conf` / `default.conf.template` / `docker-compose.yml`：

- `/wcl-api/` → `proxy_pass https://wcl-live-mp.rpglogs.cn/v1/`（国服 WCL API）
- `/i/` → `proxy_pass https://wowanalyzer.com/i/`（非 CN 角色/API 透传）
- `/cn-armory/` → `rewrite ^/cn-armory/(.*)$ /$1 break; proxy_pass https://webapi.rpglogs.cn`（CN 网关）

### 关键环境变量（`.env.example`）

```
VITE_WCL_API_BASE=https://wcl-live-mp.rpglogs.cn
VITE_WCL_DIRECT=false
VITE_CN_ARMORY_BASE=/cn-armory/wow-armory-server/api
VITE_SERVER_BASE=
VITE_API_BASE=i/
```

## 7. 数据流动一图流

```
[WCL API]  report/fights ──▶ ReportLoader ──▶ ReportContext
              │
              ├─ report/events ──▶ useEvents ──▶ AnyEvent[]
              │
              └─ v2/.../players ──▶ SWR ──▶ PlayerLoader ──▶ PlayerContext

[CN 网关]  /cn-armory/index ──▶ fetchCnCharacterProfile ──▶ charactersById(Redux)
                │
[上游 API]  i/character ──▶ makeCharacterApiUrl（非 CN）

useEventParser ──▶ new CombatLogParser ──▶ normalize() ──▶ triggerEvent×N ──▶ Results
```