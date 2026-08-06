# CN fork 部署指南(docker compose)

本文档描述 WoWAnalyzerCN 在服务器上用 docker compose 的部署方式。

## 前置要求

- 服务器已安装 Docker 及 docker compose(v2)。
- 已按仓库根目录 `default.conf` / `docker-compose.yml` 的现有结构执行过一次基础部署。

## 部署命令

```bash
# 拉取代码后,构建镜像并启动
docker compose up -d --build
```

> 使用 `--build` 是因为需要把**新代码**(前端逻辑 + nginx `/cn-armory` 代理配置)打进镜像。
> 如果省略 `--build`,会使用旧的本地镜像,新增的 CN 角色资料路径不会生效。

## 对外端口

```yaml
ports:
  - '${NGINX_PORT:-9000}:80'
```

默认以 `9000` 端口对外(容器内 nginx 监听 80)。如需换端口,在 `.env` 或 compose 环境里设置 `NGINX_PORT`:

```bash
NGINX_PORT=8080 docker compose up -d --build
```

## 环境变量

### 前端构建变量(镜像构建时生效)

| 变量                      | 默认值                             | 说明                                               |
| ------------------------- | ---------------------------------- | -------------------------------------------------- |
| `VITE_WCL_API_BASE`       | `https://wcl-live-mp.rpglogs.cn`   | CN WCL API 直连地址                                |
| `VITE_WCL_DIRECT`         | `false`                            | `true` 时前端请求 `/wcl-api` 走 nginx 代理         |
| `VITE_SERVER_BASE`        | `/`                                | 同源相对路径(不要改成绝对地址,会影响 `/i/` 代理)   |
| `VITE_API_BASE`           | `i/`                               | 后端 API 路径前缀,必须与 nginx `location /i/` 匹配 |
| `VITE_ENABLE_GA`          | `false`                            | Google Analytics                                   |
| `VITE_DISABLE_USER_FETCH` | `true`                             | 关闭用户相关外部请求                               |
| `VITE_CN_ARMORY_BASE`     | `/cn-armory/wow-armory-server/api` | CN 角色资料网关(默认相对路径,见下文)               |

> `VITE_CN_ARMORY_BASE` 默认即为相对路径,不设也能工作;无需额外配置。

### 运行时变量(nginx 容器运行时生效)

| 变量                           | 默认值                               | 说明                              |
| ------------------------------ | ------------------------------------ | --------------------------------- |
| `CN_ARMORY_API_PROXY_TARGET`   | `https://webapi.rpglogs.cn`          | `/cn-armory` 代理目标(无 URI)     |
| `CN_ARMORY_API_PROXY_HOST`     | `webapi.rpglogs.cn`                  | 转发到目标时的 Host 头            |
| `WCL_API_PROXY_TARGET`         | `https://wcl-live-mp.rpglogs.cn/v1/` | `/wcl-api` 代理目标               |
| `WCL_API_PROXY_HOST`           | `wcl-live-mp.rpglogs.cn`             | ...                               |
| `WOWANALYZER_API_PROXY_TARGET` | `https://wowanalyzer.com/i/`         | `/i/` 代理目标(上游角色/玩家 API) |
| `WOWANALYZER_API_PROXY_HOST`   | `wowanalyzer.com`                    | ...                               |

## `/cn-armory` 代理与 CN 角色资料

CN 报告的角色资料(头像/种族/专精等)由前端请求同源相对路径
`/cn-armory/wow-armory-server/api/index?...`,由当前 host(dev 为 Vite proxy,生产为 nginx)
转发到 CN 英雄榜网关 `webapi.rpglogs.cn`。

关键点:

- **前端产物里写死的是相对路径**(构建时 `${VITE_CN_ARMORY_BASE}` 为空则用默认 `/cn-armory/...`),
  所以无论部署在哪个域名,请求都跟随当前 host,不需要改域名。
- nginx 已配置 `location /cn-armory/`,内部 `rewrite` 去掉 `/cn-armory` 前缀后转发到网关。
- 网关 CORS 不允许 `auth` 自定义头,因此必须走同源代理(此机制正是为此而建),**不要**把
  `VITE_CN_ARMORY_BASE` 改成绝对地址直接跨域调用。

## 验证

部署后验证:

```bash
# 1. nginx 容器起来
docker compose ps

# 2. 检查 /cn-armory 代理是否工作(本机若有 curl)
curl -v -H "auth: <签名>" "http://<host>:<port>/cn-armory/wow-armory-server/api/index?realm_slug=deathwing&role_name=<角色名>"
# 期望返回 JSON code 0(成功)或 30003/30004(隐私/限流),而不是页面

# 3. 浏览器打开一个 CN 报告,Network 里角色请求应为
#    http://<host>:<port>/cn-armory/wow-armory-server/api/index?...
#    而非 wowanalyzer.com/i/character/...
```

## 常见问题

- **改完代码后没生效**:没带 `--build`。重新 `docker compose up -d --build`。
- **改 env 变量不生效**:`VITE_` 前缀的变量要重建镜像才生效(`--build`),不能只 restart。
- **端口被占**:换个 `NGINX_PORT`,注意放行防火墙。
