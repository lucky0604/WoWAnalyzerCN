<h1>
  <img src="https://user-images.githubusercontent.com/4565223/54240739-2d6e0b00-451f-11e9-8473-d15e78914c9b.png" height="36" valign="bottom" /> WoWAnalyzer
</h1>

> WoWAnalyzer is a tool to help you analyze and improve your World of Warcraft raiding performance through various relevant metrics and gameplay suggestions.

[https://wowanalyzer.com](https://wowanalyzer.com)

## New to Open Source?

This guide is an excellent introduction and explains all the jargon we may use: https://medium.com/clarifai-champions/99-pr-oblems-a-beginners-guide-to-open-source-abc1b867385a

If you ever get stuck or want to have a chat, join us on our [Discord](https://wowanalyzer.com/discord) server. We love to hear what you're (going to be) working on!

> [!IMPORTANT]
> WoWAnalyzer does not accept AI-generated code from unknown contributors. See our [AI Policy](./AI_POLICY.md) for details.

## CN fork: 本地开发需要先启动 WCL 代理

本仓库不再向 `wowanalyzer.com` 发起任何 API 请求（原站已加入反爬虫措施）。本地开发
（`pnpm run start`）默认通过同源 `/wcl-api/` 走本地 wcl-proxy-server：

1. 先启动 wcl-proxy-server（监听 `localhost:9528`。该服务独立于本仓库、自带 WCL 凭据
   不入库；dev 代理链路说明见 `docs/summary/06-cn-localization.md`）；
2. 再执行 `pnpm run start`（`.env.development` 已设 `VITE_WCL_DIRECT=true`）。

未配置任何 WCL API（`VITE_WCL_API_BASE` / `VITE_WCL_DIRECT`）时会直接报错，
不会静默回退到原站。生产/部署形态见 `docs/deployment-cn.md`。

## Getting started

First make sure you have the following:

- [git](https://git-scm.com/)
  - Optional: Get a UI such [GitHub Desktop](https://github.com/apps/desktop) [TortoiseGit](https://tortoisegit.org/)
- [Node.js](https://nodejs.org/). We recommend the _LTS_ version.
- [pnpm](https://pnpm.io/)

Now you need to pull a copy of the codebase onto your computer. Make a fork of the repo by clicking the **Fork** button at the top of this page. Next, click the green button **Clone or download** and copy your _Clone with HTTPS_ URL, and then run the command `git clone <paste link>`. This will take a minute.

When cloning finishes, open a command window to the source and run the command `pnpm install`.

Once all that's done you're ready to fire up the development server! Just run the command `pnpm start` in the project root. This should open up your local version of WoWAnalyzer in the browser.

At this point you can poke around and start making changes, or head over to the [wiki](https://github.com/WoWAnalyzer/WoWAnalyzer/wiki) for more information.

### Troubleshooting

If you are getting an error about a missing module or library you might have to update your dependencies. Run `pnpm install`. Make sure there's no running `pnpm start` or `pnpm test` when you do as they might lock files.

## Contributing

See the [contributing guidelines](CONTRIBUTING.md) for further information.
