# 06 · 国服定制与国际化的深入解析

这是本项目相对上游 WoWAnalyzer 差异最大的部分，也是定制核心。本文把"国服能力"与"国际化"两条线完整讲清。

## 1. i18n 国际化系统（Lingui 6）

### 1.1 配置（`lingui.config.ts`）

`defineConfig`：目录在 `src/localization/{locale}/messages`，语言 `['de','en','es','fr','it','ko','pl','pt','ru','zh']`，`sourceLocale: 'en'`，`fallbackLocales.default: 'en'`，格式 `formatter({style:'minimal'})`，排除 `src/parser/core/stats.ts`。npm 脚本：`extract` = `lingui extract --overwrite --clean`。

### 1.2 加载与切换（`src/localization/I18nProvider.tsx`）

- 从 Redux `getLanguage(locale)` 读语言。
- `loadCatalog(locale)` 动态 import `` `./${locale}/messages.json?lingui` ``，`i18n.load(locale, messages)`，然后合并各专精中文翻译 `SPEC_TRANSLATIONS['zh']`（glob `./zh/**/content.json`，47 个文件，`Object.assign` 合并），再 `i18n.activate(locale)`。
- 用 `useHead` 设置 `<html lang>` / `translate="no"`。
- 语言未加载完前阻塞渲染（测试模式除外），随后用 `<LinguiI18nProvider i18n={i18n}>` 包裹子组件。

### 1.3 目录结构

- 目录文件 `src/localization/{locale}/messages.json`（Lingui minimal 格式，`zh` ~672KB、`en` ~709KB）+ `messages.js`。
- 每专精翻译 `src/localization/{locale}/**/content.json`，与 `src/analysis/retail/{class}/{spec}/` 镜像（如 `zh/mage/fire/content.json`）。所有语言都有。

### 1.4 语言持久化与切换 UI

- `src/interface/reducers/language.ts`：Redux Toolkit slice，`initialState` 读 cookie `LANGUAGE`（默认 `'zh'`），`setLanguage` 写 1 年 cookie `LANGUAGE`。
- `src/interface/selectors/language.ts`：`getLanguage(state)`。
- `src/interface/LanguageSwitcher.tsx`：下拉遍历 `Object.keys(languages)`，`dispatch(setLanguage(code))`。
- `src/interface/languages.ts`：`LANGUAGES: Record<string, Language>`（englishName、localName、region、locale）。`zh = { englishName:'Chinese', localName:'中文', region:null, locale:'zh_CN' }`，注释"it has no working API"——这正是国服角色走 CN 网关的原因。

## 2. 国服服务器 slug 表

### 2.1 生成器（`scripts/cn-sn-slug/generate-cn-server-slug.mjs`）

Node ESM 脚本（无导出符号）。读取国服服务器表（来自 `wcl-mp-client/src/assets/datas/regions.ts`，经 argv / `process.env.WCL_MP_CLIENT_REGIONS` / 默认路径），输出 **`src/common/CN_SERVER_SLUG.ts`** —— `Record<string,string>` 把国服服务器中文名映射到罗马化 slug（如 `世界之树: 'world-tree'`、`死亡之翼: 'deathwing'`）。定位 `slug: 'CN'` 块、括号匹配 `servers: [...]` 数组、正则提取 `{ id, name, slug }` 三元组。输出带 `@generated ... DO NOT EDIT DIRECTLY` 头。npm 脚本 `generate-cn-server-slug`。

### 2.2 产物（`src/common/CN_SERVER_SLUG.ts`，377 行）

固定的 `CN_SERVER_SLUG: Record<string,string>` 常量，默认导出。供 `fetchCnArmory.ts` 的 `cnRealmSlug()` 消费。wcl-mp regions 表变更时需重新生成。

## 3. CN_MAPPING 中文名映射

位于 `src/common/CN_MAPPING/`，桶文件 `index.ts` 组合并 re-export 各分类查找助手：

- **`index.ts`** —— 导出 `getBossCnName(id)`、`getZoneCnName(id)`、`getDungeonCnName(slug)`、`getMobCnName(name)`，并 re-export `getSpellCnName`、`getSpellCnNameByEnglish`。均返回 `string | null`。
- **`spellNames.ts`** —— `SPELL_CN_NAMES: Record<number, string>`（法术 id → 中文，按职业分组，约 230 条）+ `getSpellCnName(id)` / `getSpellCnNameByEnglish(englishName)`。英文查找用懒构建、大小写无关的反向索引 `buildEnCnIndex`。数据源自 WCL API（`translate=true`）与 zhCN 客户端本地化。
- **`bossNames.ts`** —— `BOSS_CN_NAMES`（副本首领 WCL zone/boss *index* id → 中文）。
- **`dungeonNames.ts`** —— `DUNGEON_CN_NAMES`（副本英文 slug → 中文；源自 `wcl-mp-client/src/pkgRoutes/constants/dungeonNames.ts`）。
- **`mobNames.ts`** —— `MOB_CN_NAMES`（NPC 英文名 → 中文）。
- **`zoneNames.ts`** —— `ZONE_CN_NAMES`（区域 id → 中文；源自 `wcl-mp-client/src/assets/datas/zones.ts`）。
- `__tests__/`：`bossNames.test.ts`、`mobNames.test.ts`、`zoneNames.test.ts`。

### 3.1 消费者 / 工具链

- **`src/interface/useSpellInfo.ts`** —— 主要法术名翻译 hook。当 `i18n.locale === 'zh'` 时，把 `getSpellCnName(spellId)`（兜底 `getSpellCnNameByEnglish`）叠加到解析出的法术对象上，让中文名出现在 tooltip/伤害分解中。注释强调中文名优先，避免覆盖 WCL 提供的翻译。
- **`src/parser/core/Enemy.ts`** —— 覆写 `get name()`：locale 为 `zh` 时返回 `getMobCnName(englishName) ?? englishName`。
- **`src/common/getBossDisplayName.ts`** —— `getBossDisplayName(fightBossId, fallback)` = `findByBossId(id)?.name ?? getBossCnName(id) ?? fallback`。界面各处首领标签都用它。
- **`src/interface/guide/components/DamageTakenPointChart.tsx`** —— locale 为 `zh` 时图表标签用 `getSpellCnName(uid)`。

## 4. CN 英雄榜网关

角色资料层的内容已在 [02-data-flow.md](./02-data-flow.md) §3 详述。要点回顾：

- 客户端 `src/common/fetchCnArmory.ts`：`fetchCnCharacterProfile` → `fetchCharacterSummaryDeduped` → `buildCharacterProfile`。
- 签名 `encrypto`（wcl-mp 同款 XOR + 变进制），构造 `auth` 头。
- 基址走同源 `/cn-armory/wow-armory-server/api`（CORS 限制）。
- 接入点：`useCharacterProfile.ts`（CN 分支）、`charactersById.ts`（Redux thunk）、`PlayerTile.tsx`、`CharacterParses.tsx`（CN 无头像 API）。

## 5. CN Guide 覆盖（override）机制

这是国服维护者**在不改动上游文件的前提下定制各专精指南**的机制，也是同步上游时减少冲突的关键。

### 5.1 目录与注册

- **`src/localization/overrides/`** —— CN 本地化的 `Guide.tsx` 副本，针对重点专精（33 个文件，覆盖 `analysis/retail/...` 与 `analysis/classic/warrior/fury`）。
- **`src/localization/overrides/registry.ts`** —— 由脚本生成，导出 `CN_OVERRIDE_SOURCE_PATHS` 与类型 `CnOverrideSourcePath`。

### 5.2 构建插件（`vite-plugins/cn-overrides.ts`）

`cnOverridesPlugin()`（`enforce: 'pre'`）拦截模块解析：当某 import 解析到的源文件在 `localization/overrides/` 下存在同名覆盖文件时，**重定向到覆盖文件**。上游源文件保持未修改以便合并。若 import 来自覆盖文件，相对 import 会解析回原始源树（缺覆盖时回落到真实文件，避免在覆盖目录里失败）。

### 5.3 配套脚本

- `scripts/migrate-guides-to-overrides.sh` —— 把 CN Guide 文件复制到 overrides、恢复上游原版。
- `scripts/generate-override-registry.mjs` → `registry.ts`。
- `scripts/sync-upstream.sh`、`scripts/post-merge-i18n-checks.sh`。
- `scripts/find_untranslated.py` / `find_untranslated_summary.py` —— 扫描 analysis JSX 中硬编码的英文。

## 6. 国服 API 路由 / 代理 / 部署

### 6.1 dev（`vite.config.ts`）

- `/wcl-api` → `http://localhost:9528`（本地 `wcl-proxy-server`），重写 `/wcl-api → /v1`，`VITE_WCL_DIRECT=true` 时生效。
- `/cn-armory` → `https://webapi.rpglogs.cn`，重写剥离 `/cn-armory`（消除拦截 `auth` 头的 CORS preflight）。

### 6.2 生产（`default.conf` / `default.conf.template` / `Dockerfile`）

- `/wcl-api/` → `proxy_pass https://wcl-live-mp.rpglogs.cn/v1/`（国服 WCL API）。
- `/i/` → `proxy_pass https://wowanalyzer.com/i/`（非 CN 角色/API 透传）。
- `/cn-armory/` → `rewrite ^/cn-armory/(.*)$ /$1 break; proxy_pass https://webapi.rpglogs.cn`（CN 网关）。
- 另有 `/user` 401 stub、`/logout`、`/static`、SPA `try_files ... /index.html`。

### 6.3 `docker-compose.yml`

单一 `nginx` 服务。构建参数：`NPM_CONFIG_REGISTRY`（默认 `https://registry.npmmirror.com`）、`VITE_WCL_API_BASE`（默认 `https://wcl-live-mp.rpglogs.cn`）、`VITE_WCL_DIRECT`（默认 `false`）、`VITE_SERVER_BASE`、`VITE_API_BASE`（默认 `i/`）、`VITE_ENABLE_GA`、`VITE_DISABLE_USER_FETCH`。运行时环境：`WCL_API_PROXY_TARGET`/`_HOST`、`WOWANALYZER_API_PROXY_TARGET`/`_HOST`、`CN_ARMORY_API_PROXY_TARGET`/`_HOST`（默认 `webapi.rpglogs.cn`）。暴露 `${NGINX_PORT:-9000}:80`，网络 `wowanalyzer`。

## 7. 一图流：国服数据定制全景

```
                    ┌──────────────────────────────────────────────┐
                    │               国服定制 (CN fork)             │
                    └──────────────────────────────────────────────┘
  WCL API 直连 ── makeWclApiUrl ── VITE_WCL_API_BASE=wcl-live-mp.rpglogs.cn
  代理         ── /wcl-api ── localhost:9528 (dev) / nginx (prod)
  角色资料     ── /cn-armory ── webapi.rpglogs.cn (CN 网关,同源 auth)
  slug 表      ── CN_SERVER_SLUG.ts ── 生成自 wcl-mp regions.ts
  中文名       ── CN_MAPPING/ ── 技能/首领/副本/NPC/区域
  Guide 定制   ── localization/overrides/ ── cn-overrides 插件重定向
  部署         ── default.conf + docker-compose ── nginx 反代
```

## 8. 关键事实

1. **默认语言是中文**（cookie `LANGUAGE` 默认 `zh`），且 `zh` 无 API 是国服走网关的根因。
2. CN_MAPPING 是**模块级静态表**，zh 语言下按需叠加到英文名上，不破坏 WCL 自带翻译。
3. CN overrides 的关键价值是**降低上游同步冲突**：上游文件保持原样，CN 定制住在 `localization/overrides/`。
4. CN 网关认证用 wcl-mp 的 `encrypto` XOR 签名，且必须同源（CORS）。