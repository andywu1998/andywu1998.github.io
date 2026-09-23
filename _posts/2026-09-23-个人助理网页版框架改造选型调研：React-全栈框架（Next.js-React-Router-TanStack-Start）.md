---
layout: post
title: "个人助理网页版框架改造选型调研：React 全栈框架（Next.js / React Router / TanStack Start）"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-23 11:27:10 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/个人助理网页版框架改造选型调研：React_全栈框架（Next.js_-_React_Router_-_TanStack_Start）.md`
# 个人助理网页版框架改造选型调研：React 全栈框架（Next.js / React Router / TanStack Start）

调研对象：是否用 **React 全栈框架**（Next.js App Router / React Router framework mode / TanStack Start）
替换现有的「Vite SPA + Vercel Functions 手写 handler」。
调研日期（也是所有来源的访问日期）：**2026-09-23**。
口径：只读一手资料（框架官方文档与官方仓库 / Vercel 官方文档 / Neon、Drizzle 官方文档）。
查不到的一律写「未能从一手资料确认」，不猜。

---

## 一句话结论

这一档里如果要动，**选 React Router（framework mode）**——理由不是它最流行，而是它与现有项目的
契约最省改动：它保留 Vite（现项目的构建与预设都建立在 Vite 上）、服务端入口签名就是
`(request: Request) => Response`（与现在的 handler 同构）、`request.url` 天然给出「浏览器实际访问的
host」（OAuth 回调推导 origin 这条约束不断）、resource route 可以直接返回 JSON/302/Set-Cookie。
代价是要把 11 个 `api/*.ts` 搬进路由表，并接受一次 Vercel Framework Preset 变更。

**Next.js** 能力最全、生态最厚，但对本项目是「用大炮打蚊子」：要顺带把 React 18 升到 React canary(19)、
要额外配 `outputFileTracingRoot` / `outputFileTracingIncludes` 才能把 `web/` 之外的 `notes/` 打进函数包、
Next 16 还把 Edge runtime 与 `preferredRegion` 标成废弃（现有 `regions: ["sin1"]` 的写法要重新想）。

**TanStack Start** 最不对路：官方文档自己仍标注 **Release Candidate**，Neon/Drizzle 在它那里只有「推荐的
合作方」而没有官方集成文档，Vercel 侧的零配置要额外引入 Nitro，而且它默认给 server function 装同源 CSRF
校验——GitHub 的 OAuth 回调是跨站 GET，正好踩在这条规则上。

---

## 一、Next.js（App Router）

### 1. 官方推荐的 Vercel 部署方式

- Vercel 官方：Next.js 在 Vercel 上是**零配置**部署，且比自托管多出 ISR、图片优化等平台特性
  （https://vercel.com/docs/frameworks/full-stack/nextjs）。Vercel 的 Framework Preset 下拉里有
  **Next.js**（https://vercel.com/docs/builds/configure-a-build#framework-preset）。
- 运行时：Route Segment Config 的 `runtime` **默认值是 `'nodejs'`**，`'edge'` 已被标注 **deprecated**，
  文档原话是「The Edge Runtime is deprecated. Remove the `runtime` export from your route files.」
  （https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime）。
  Vercel 自己的 Runtime 列表里 Edge 仍是官方 runtime、未见废弃说明
  （https://vercel.com/docs/functions/runtimes）——即：**废弃是 Next.js 侧的决定**。
- 构建输出形态：`next build` 产出 `.next`，Next.js 用 `@vercel/nft` 对每个页面做 output file tracing，
  静态资源与 server function 分开（https://nextjs.org/docs/app/api-reference/config/next-config-js/output）。
  产物落在哪个磁盘目录由平台决定，未在文档中给出可引用的固定形态描述。
- 平台限制（Vercel 侧，https://vercel.com/docs/functions/limitations）：
  函数包未压缩 **250 MB**（Python 500 MB；Large functions beta 上限 5 GB）、请求/响应体 **4.5 MB**、
  默认时长 300s、默认内存 2 GB/1 vCPU、文件描述符 1024。
  区域默认 `iad1`，用 `regions` 改（https://vercel.com/docs/functions/configuring-functions/region）。
  Node.js 版本：**24.x（默认）**、22.x、20.x（https://vercel.com/docs/functions/runtimes/node-js/node-js-versions）。
- 已知摩擦点：Next.js 16 里 `middleware` 文件约定已弃用并改名 `proxy`
  （https://nextjs.org/docs/app/api-reference/file-conventions/proxy）；
  `preferredRegion` 亦已废弃（https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/preferredRegion）。

### 2. 能不能在构建期读仓库里任意目录的 Markdown

**能，但要显式配置 tracing。** 机制：

- Server Component / Route Handler 默认跑在 Node.js runtime，可用 Node API（runtime 默认 `nodejs`，
  见上面第 1 条的 URL）。
- 构建期 Next.js 用 `@vercel/nft` **静态分析 `import` / `require` / `fs` 用法**来决定把哪些文件打进部署，
  这正说明「构建期读文件」是被支持的用法
  （https://nextjs.org/docs/app/api-reference/config/next-config-js/output）。
- 项目目录之外的文件默认不在 tracing 范围内：文档明确说 monorepo 下 tracing root 是 Next 项目根，
  **该目录之外的文件不会被包含**，需要 `outputFileTracingRoot`；
  需要强制包含时用 `outputFileTracingIncludes`（key 是路由 glob，value 是从项目根解析的文件 glob）
  （同上 URL）。
- 现状对照：本项目 Vercel 的 Root Directory 是 `web/`，而笔记在仓库根的 `notes/`——即 Next 项目根之外。
  迁移后必须配 `outputFileTracingRoot`（指到 `web/` 之外）+ `outputFileTracingIncludes`，
  否则 `notes.json` 不进函数包。

### 3. 请求处理能力

- 定义 JSON 接口：**Route Handlers**，文件为 `app/**/route.ts`，导出 `GET`/`POST` 等，用 Web `Request`/`Response`
  （https://nextjs.org/docs/app/getting-started/route-handlers）。Route Handlers **默认不缓存**
  （GET 可显式选择静态化），见同页。
- 读写 Cookie：`cookies()` 可读可写（https://nextjs.org/docs/app/api-reference/functions/cookies）；
  `NextRequest.cookies` 提供 get/set/delete/has/getAll/clear（https://nextjs.org/docs/app/api-reference/functions/next-request）。
- 发 302：**注意默认值**——`redirect()` 在 Server Action 里做渐进增强表单提交时返回 303，其余情况返回 **307**，
  文档没有 302 档位（https://nextjs.org/docs/app/api-reference/functions/redirect）。
  要精确 302 得用 `NextResponse.redirect(url, 302)`（https://nextjs.org/docs/app/api-reference/functions/next-response）。
- 拿到浏览器实际访问的 host：`headers()` 可读入站请求头（**async**、只读）
  （https://nextjs.org/docs/app/api-reference/functions/headers）；Vercel 文档明确
  `x-forwarded-host` **与 `host` 相同**，并给出 Next.js 里 `request.headers.get('x-forwarded-host')` 的官方示例
  （https://vercel.com/docs/headers/request-headers）。另可用环境变量 `VERCEL_URL`（部署域名，不含协议，
  https://vercel.com/docs/environment-variables/system-environment-variables）。
- 注意：`headers()` 是 **Request-time API**，调用它会把路由 opt 进 dynamic rendering；
  在 Cache Components 下、在 `<Suspense>` 之外调用会**阻止该路由被预渲染**（同 headers 文档）。

### 4. 数据加载模型

- RSC/Client Component 边界与运行位置见
  https://nextjs.org/docs/app/getting-started/server-and-client-components（Server Component 在服务端渲染，
  服务端专用代码可用 `server-only` 标记防止误入客户端）。
- 构建期生成路由用 `generateStaticParams`（在 `page.tsx` / `layout.tsx` / `route.ts` 均可用），
  文档明说它用于「在构建期而非请求时静态生成路由」
  （https://nextjs.org/docs/app/api-reference/functions/generate-static-params）。
- Next 16 的缓存模型是 **Cache Components + `use cache`**（需 `cacheComponents: true`），
  GET Route Handler 在开启后与页面走同一套预渲染模型
  （https://nextjs.org/docs/app/getting-started/caching）。
- 对本项目「首屏拉元数据、正文按篇取」：**更贴合**——首屏 RSC 直接读元数据，正文用 RSC 或 Route Handler
  按 `?n=` 取，不需要手写 fetch 封装。

### 5. 与 Neon serverless + Drizzle 的官方集成

- **Neon 官方有 Next.js 连接指南**（node-postgres / postgres.js / `@neondatabase/serverless` 三种驱动，
  覆盖 App Router 的 Server Components、Server Actions 等）
  （https://neon.com/docs/guides/nextjs）。
- **Neon 官方有 Drizzle 连接指南**，其中明确 `drizzle-orm/neon-http` + `@neondatabase/serverless`
  是「Drizzle 对 Neon 的原生支持」之一（https://neon.com/docs/guides/drizzle）。
- 未找到「Next.js + Drizzle + Neon」三件套的官方整合文档——**未能从一手资料确认**该组合有专属文档；
  现有项目用的 `drizzle-orm/neon-http` 在框架无关层面是官方支持的。

### 6. Markdown 渲染 + 消毒在服务端渲染下的注意点

- DOMPurify 官方 README 第一句就是「**a DOM-only** ... sanitizer」，并在 CI 一节说明 Node 下是
  配合 **jsdom** 跑的（支持 Node v20/22/24/25/26）
  （https://github.com/cure53/DOMPurify）。
- RSC 没有 DOM，因此 **DOMPurify 不能直接跑在 RSC 里**——要么在 Node 侧引入 jsdom（等价于服务端再带一个 DOM 实现），
  要么维持现在的「客户端 marked + DOMPurify」。这是一手资料的推论，文档本身没有 RSC 相关章节
  （未找到 DOMPurify 官方关于 RSC 的说明）。

### 7. 测试

- 官方有 Vitest 指南：`vitest` + `@vitejs/plugin-react` + `jsdom` + `@testing-library/react` + `vite-tsconfig-paths`，
  并提示「Vitest 目前不支持 async Server Components，这类组件建议用 E2E」
  （https://nextjs.org/docs/app/guides/testing/vitest）。
- 与现在「`node:test` + 类型剥离、零测试框架依赖」的落差：**要引入 5 个左右 devDependency + 一份 Vitest 配置**。

### 8. 成熟度

- 稳定版 **16.3.6**（GitHub 官方 release，发布日期 2026-09-22，非 prerelease：
  https://github.com/vercel/next.js/releases；npm dist-tag latest 亦为 16.3.6：https://registry.npmjs.org/next/latest）。
- App Router 使用 **React canary releases**（含已稳定的 React 19 变更），文档建议仍在 package.json 里声明
  react / react-dom（https://nextjs.org/docs/app/getting-started/installation）。

### 9. 对本项目最可能的坑（具体）

1. **`notes/` 不在 Next 项目根内，默认打不进函数包。** 触发条件：只把代码搬进 `web/` 而不配
   `outputFileTracingRoot` / `outputFileTracingIncludes`，构建照样成功，线上 `/api/notes` 报找不到 `notes.json`
   （依据：output file tracing 文档，见第 2 条 URL）。
2. **Vercel 上「Root Directory 之外的文件」默认不可读。** 触发条件：保持 Root Directory=`web/` 且没有开
   `sourceFilesOutsideRootDirectory`。Vercel 文档在 Root Directory 一节写明
   「Your app will not be able to access files outside of that directory. You also cannot use `..` to move up a level」
   （https://vercel.com/docs/builds/configure-a-build#root-directory）；该开关本身只能从 REST API 字段
   `sourceFilesOutsideRootDirectory`（boolean，可选）看到（https://vercel.com/docs/rest-api/reference/endpoints/projects/create-a-new-project），
   公开文档里没有面向用户的说明——**这条要按「平台设置必须跟着框架改造一起改」来对待**。
3. **React 18 → React 19 canary。** 触发条件：装 App Router；文档明确 App Router 内建 React canary
   （含 React 19 稳定变更），`react`/`react-dom` 的 18.3.1 需要一起升（同第 8 条 URL）。
   `marked` + DOMPurify 的客户端渲染路径要跟着回归。
4. **OAuth 302 + Set-Cookie 没有现成 API 直通。** 触发条件：照搬 `redirect()`，会得到 307（非表单场景）
   或 303（Server Action 渐进增强），与现项目「302 带 Set-Cookie 跳转」的行为不一致；必须改用
   `NextResponse.redirect(url, 302)` 并手工挂 `Set-Cookie`（第 3 条 URL）。
5. **区域配置要重做。** 触发条件：保留 `vercel.json` 的 `regions: ["sin1"]` 写法即可（项目级仍有效），
   但想按路由钉区域的老办法（`preferredRegion`）已废弃，Next 16 里会被移除
   （https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/preferredRegion）。

---

## 二、React Router（framework mode，原 Remix）

> 版本说明：调研题目写的是「React Router v7 framework mode」。一手资料显示当前 latest 已是
> **8.4.0**（https://github.com/remix-run/react-router/releases），文档站同时保留 7.18.4 / 6.30.6
> （https://reactrouter.com/start/framework/deploying）。下文按 v8 文档作答，同时标注 v7 仍在维护。

### 1. 官方推荐的 Vercel 部署方式

- Vercel 官方有专门的 React Router 页面，支持 **SSR** 与 **SPA 模式** 两种零配置部署
  （https://vercel.com/docs/frameworks/frontend/react-router）；Framework Preset 下拉里有 **React Router**
  （https://vercel.com/docs/builds/configure-a-build#framework-preset）。
- **「强烈建议」使用 Vercel 自家 preset**：装 `@vercel/react-router`，在 `react-router.config.ts` 里加
  `presets: [vercelPreset()]`（`import { vercelPreset } from '@vercel/react-router/vite'`）。
  配了之后可获得：按路由的函数级配置（memory、maxDuration 等）、Vercel 能理解路由结构从而做 bundle splitting、
  部署详情页显示准确的 Deployment Summary（同上 URL）。
- 运行时：SSR 走 **Vercel Functions**（Node.js runtime 家族，非 Edge 专属），文档给了
  「scales to zero / 自动扩容 / framework-aware 生成 Vercel Functions / 支持 Fluid compute」四条
  （同上 URL）。React Router 侧另提供了 Cloudflare / Netlify / Node+Docker 等部署方式，Vercel 排在首位并写明
  「Vercel maintains their own template for React Router」
  （https://reactrouter.com/start/framework/deploying）。
- 构建输出形态：`react-router build` 产出 `build/client`（静态：预渲染路径的 `[url].html` 与 `[url].data`）
  与 `build/server`（SSR bundle，部署为函数）
  （https://reactrouter.com/how-to/pre-rendering）。平台侧限制同 Vercel Functions 通用限制
  （250 MB 包、4.5 MB 体、区域默认 `iad1`）。
- 包版本：`@vercel/react-router` latest **1.3.6**（https://registry.npmjs.org/@vercel/react-router/latest）。

### 2. 能不能在构建期读仓库里任意目录的 Markdown

**能，而且是最直接的一个。** `react-router.config.ts` 本身是构建期 Node 脚本：文档给出的
`prerender` 既可以是布尔、数组，也可以是 **async 函数**，示例里直接在配置里 `let slugs = getPostSlugs()`
读取数据（https://reactrouter.com/how-to/pre-rendering）；
数据加载文档还专门有「Static Data Loading」一节，说明**预渲染时 loader 在生产构建期运行**，
示例就是 `readProductsFromCSVFile()` 这种「构建期读文件再 map 成路由」的写法
（https://reactrouter.com/start/framework/data-loading）。

- 产物归属：预渲染路径的输出是**静态文件**（`build/client/*.html` / `*.data`）；
  未预渲染的路径仍由 server bundle 在请求时处理，因此「把 `notes.json` 打进函数包」这条路依然成立
  （依据：上面两个 URL + server bundle 概念，见
  https://reactrouter.com/start/framework/route-module 的 `loader` 说明——loader 会从客户端 bundle 中移除）。
- 与现有项目最接近：现在的 `scripts/generate-notes.mjs` 可以在 `react-router.config.ts` 里原样调用。

### 3. 请求处理能力

- 定义 JSON 接口：**Resource Route**——路由模块只导出 `loader`/`action`、不导出 `default` 组件，
  即可返回任意 `Response`（文档示例直接 `Response.json({...})` 与
  `new Response(pdf, { status: 200, headers: { 'Content-Type': 'application/pdf' } })`）
  （https://reactrouter.com/how-to/resource-routes）。GET 走 `loader`，POST/PUT/PATCH/DELETE 走 `action`（同页）。
- 读写 Cookie / Session：官方有 `createCookieSessionStorage`（`httpOnly`、`sameSite: "lax"`、`secure`、
  `secrets` 都是配置项），`getSession()` 解析入站 `Cookie` 头，`commitSession()` / `destroySession()`
  生成出站 `Set-Cookie`（https://reactrouter.com/explanation/sessions-and-cookies）——
  与现项目「自签发 Session 表 + httpOnly cookie」的形态几乎一对一。
- 发 302：`redirect()` 在 loader/action 里抛出，可配合 `data(..., { headers: { 'Set-Cookie': ... } })`
  返回带 Set-Cookie 的重定向（同 sessions/cookies 文档的登录示例）。
- 拿到浏览器实际访问的 host：handler 签名是 `({ request }) => ...`，`request` 是标准 `Request`，
  可用 `request.url` / `request.headers`。路由级响应头由导出的 `headers()` 函数返回
  （https://vercel.com/docs/frameworks/frontend/react-router 的 `Cache-Control` 一节）。
  另外 Vercel 文档说明：自定义 server entrypoint 的签名就是
  `export default async function (request: Request) => Response | Promise<Response>`
  （同上 URL）——与现在 `export default { fetch(request) }` 是同一种心智模型。

### 4. 数据加载模型

- `loader`（服务端，首屏 SSR 与客户端导航都经它）/ `clientLoader`（浏览器）/ `action`；
  文档明确「loader 会从客户端 bundle 里移除，所以你可以在里面用 server-only API」
  （https://reactrouter.com/start/framework/data-loading）。
- 三种渲染策略：CSR、SSR（默认 `ssr: true`）、静态预渲染（`prerender`），并在配置里切换
  （https://reactrouter.com/start/framework/rendering）。
- 对本项目「首屏拉元数据、正文按篇取」：**贴合**——元数据交给路由 `loader`（甚至可预渲染首屏），
  正文交给 resource route 按 id/path 取；不需要引入额外数据层。

### 5. 与 Neon serverless + Drizzle 的官方集成

- **没有 React Router 专属的 Neon/Drizzle 官方文档（未能从一手资料确认）。**
- 但 React Router 官方模板体系里有一档就是 Drizzle + Postgres：
  `remix-run/react-router-templates/node-postgres`，描述为「Server Rendering / **Postgres Database with Drizzle** /
  Tailwind CSS / Custom express server」（https://reactrouter.com/start/framework/deploying）。
  即官方把 Drizzle 当作一等组合提供，但连接层仍是通用 Postgres 方案。

### 6. Markdown 渲染 + 消毒在服务端渲染下的注意点

- React Router 官方文档没有 Markdown/消毒章节（未能从一手资料确认）。
- 唯一要点在 RSC 侧：`how-to/react-server-components` 在 front matter 里标了 `unstable: true`，
  正文有 docs-warning「experimental and subject to breaking changes in minor/patch releases」
  （https://reactrouter.com/how-to/react-server-components）。
  也就是说：**走普通 loader + SSR 时，Markdown 仍可在客户端用 DOMPurify 消毒（现方案不变）**；
  一旦为了 RSC 而启用 RSC，就要重新评估消毒位置（理由同 Next.js 第 6 条：DOMPurify 是 DOM-only）。

### 7. 测试

- 官方 Testing 页推荐用 `createRoutesStub`（为组件提供路由上下文）+ React Testing Library / user-event
  写组件测试（https://reactrouter.com/start/framework/testing）。
- 官方 **默认模板不含任何测试运行器**：`default` 模板的 package.json 里 scripts 只有
  `build` / `dev` / `start` / `typecheck`（https://raw.githubusercontent.com/remix-run/react-router-templates/main/default/package.json）。
- 与现状落差：**比 Next.js 小**——纯函数与接口逻辑仍可继续用 `node:test`；只有组件测试需要新增 RTL（可选）。

### 8. 成熟度

- 稳定版 **8.4.0**（GitHub 官方 release，2026-09-15，非 prerelease：
  https://github.com/remix-run/react-router/releases；npm latest 8.4.0：https://registry.npmjs.org/react-router/latest）。
- v7 仍被文档化（8.4.0 页面并列 7.18.4、6.30.6，https://reactrouter.com/start/framework/deploying）。
- 唯一的「实验」标记是 **RSC 支持**（`unstable: true`，见第 6 条 URL）。

### 9. 对本项目最可能的坑（具体）

1. **Vercel Framework Preset 必须从 Vite 改成 React Router。** 触发条件：不配 `vercelPreset()` 也能跑，
   但拿不到按路由函数配置与 bundle splitting，且部署详情页信息不准（Vercel 文档写「highly recommended」）
   （https://vercel.com/docs/frameworks/frontend/react-router）。同时 Output Directory 从
   `frontend/dist` 变成 `build/client` 这一族（https://reactrouter.com/how-to/pre-rendering）——
   三处平台设置要同步改（preset / build command / output dir）。
2. **11 个 `api/*.ts` 要变成路由或 resource route。** 触发条件：直接保留 `api/` 目录。
   React Router 的约定是 `app/routes.ts` 路由表（https://reactrouter.com/start/framework/route-module），
   文件系统式的 `api/xxx.ts` 不再被框架识别。
3. **构建设置里读文件的路径语义会变。** 触发条件：`react-router.config.ts` 里 `fs` 读 `../notes`——
   现在这条路径依赖 Vercel 的 Root Directory=`web`，「不能向上 `..`」是 Vercel 文档明写的限制
   （https://vercel.com/docs/builds/configure-a-build#root-directory），所以同样要先确认
   `sourceFilesOutsideRootDirectory`（第 3 条坑见 Next.js 小节，同样适用）。
4. **`ssr: false`（SPA 模式）是一条错路。** 触发条件：为了少改后端而把应用切成 SPA 模式——
   文档明确 `ssr:false` 时**所有路由禁止导出 `headers` 和 `action`**，且没有运行时服务器
   （https://reactrouter.com/how-to/pre-rendering）。OAuth 回调与 Session 立刻失效。
5. **RSC 一旦启用就踩实验特性。** 触发条件：为了「用框架的新东西」而在 React Router 里开 RSC——
   `unstable: true`、minor/patch 都可能 breaking，且要多带一个实验性的 `@vitejs/plugin-rsc`
   （https://reactrouter.com/how-to/react-server-components）。本项目没有任何 RSC 收益（只读展示 + 单用户）。

---

## 三、TanStack Start

### 1. 官方推荐的 Vercel 部署方式

- Vercel 官方页面存在：**TanStack Start 通过 Nitro 部署**，需要装 `nitro` 并在 `vite.config` 里
  与 `tanstackStart()` 并列注册（`import { nitro } from 'nitro/vite'`）；Vercel 用 Fluid compute 跑这些函数
  （https://vercel.com/docs/frameworks/full-stack/tanstack-start）。
- 官方 KB 指南（作者 Ben Sabic，发布 2026-09-01、更新 2026-09-22）补充：Vercel **自动检测 TanStack Start 与
  Nitro**，无需设置 build command / output directory；monorepo 或历史项目检测不到时，三种办法之一是
  在 `vercel.json` 写 `{ "framework": "tanstack-start" }`
  （https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel）。
- TanStack 侧同样把 Vercel 标为 **Official Partner**，并给出一致的 Nitro 配置与
  `{ "$schema": "...", "framework": "tanstack-start" }`
  （https://tanstack.com/start/latest/docs/framework/react/guide/hosting）。
- Nitro 官方文档确认：Vercel preset 名 `vercel`，「Integration with this provider is possible with **zero configuration**」，
  并提醒「Nitro's top-level `/api` directory isn't compatible with Vercel，请用 `routes/api/`」
  （https://v3.nitro.build/deploy/providers/vercel）。
- Framework Preset 下拉里确有 **TanStack Start**（两条，其中一条注明 imported from Lovable）
  （https://vercel.com/docs/builds/configure-a-build#framework-preset）。
- 运行时：Node.js（Nitro 编出的 Vercel Functions）。包版本参考：Vercel 官方 TanStack Start 示例仓库里
  `nitro` 钉的是 **3.0.1-alpha.0**
  （https://github.com/vercel/vercel/blob/main/examples/tanstack-start/package.json）。

### 2. 能不能在构建期读仓库里任意目录的 Markdown

**能，且官方给了两条明确路径：**

- **Static Prerendering**：在 `vite.config.ts` 的 `tanstackStart({ prerender: { enabled: true, ... } })` 打开预渲染；
  可 `crawlLinks`、可指定具体 `pages`，产物是静态 HTML
  （https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering）。
  预渲染阶段会跑你的服务端代码，因此可以在那时 `fs` 读 `notes/`。
- **Static Server Functions（实验性）**：文档自带 `[!WARNING] Static Server Functions are experimental!`，
  机制是「构建期预渲染时执行 server function，结果作为静态 JSON 缓存进构建产物，运行时被替换成对静态 JSON 的 fetch」
  （https://tanstack.com/start/latest/docs/framework/react/guide/static-server-functions）。
- 官方 Markdown 指南推荐的方向是**构建期装载**：「Static markdown with `content-collections` for build-time loading」
  （https://tanstack.com/start/latest/docs/framework/react/guide/rendering-markdown）——
  注意这是建议放进框架约定的内容目录，而不是本项目这种「读仓库里任意目录」。

### 3. 请求处理能力

- 定义接口：**Server Routes**，`createFileRoute('/hello')({ server: { handlers: { GET: async ({ request }) => new Response(...) } } })`，
  文件就放在 `src/routes` 里；文档明说 server route 是「给 Start 应用之外调用的 HTTP 端点」，而 server function 是
  「只在应用内部调用的 RPC」（https://tanstack.com/start/latest/docs/framework/react/guide/server-routes）。
- 读写 Cookie：server route 里拿到 `request`（标准 `Request`），出站靠 `Response` 的 `Set-Cookie` 头。
  **未找到官方 cookie/session 工具的文档页**（sitemap 里没有 cookies/session 指南，
  https://tanstack.com/sitemap.xml）——**未能从一手资料确认**有等价于 `createCookieSessionStorage` 的一等 API。
- 发 302：server route 返回 `new Response(null, { status: 302, headers: { Location, 'Set-Cookie' } })` 属可行写法，
  但文档没有 302+Set-Cookie 的现成示例——**未能从一手资料确认**官方示例。
- 拿到浏览器实际访问的 host：server route 的 `request.url` 可用（同 server-routes 文档）。
  **但要注意 server function 自带同源校验**：文档说 server functions 是 same-origin RPC，
  用 `Sec-Fetch-Site` / `Origin` / `Referer` 校验，Start 默认自动装 `createCsrfMiddleware()`，
  且「没有这些头的请求默认被拒绝」（https://tanstack.com/start/latest/docs/framework/react/guide/server-functions）。
  → **GitHub 的 OAuth 回调是跨站跳转，必须做成 server route，不能做成 server function。**

### 4. 数据加载模型

- 官方 Execution Model 的第一句就是「**All code in TanStack Start is isomorphic by default**」，
  并强调「Route `loader`s are isomorphic - they run on both server and client」
  （https://tanstack.com/start/latest/docs/framework/react/guide/execution-model）。
  需要纯服务端时用 `createServerFn()` / `createServerOnlyFn()`
  （https://tanstack.com/start/latest/docs/framework/react/guide/code-execution-patterns）。
- 对本项目「首屏拉元数据、正文按篇取」：**能用但更绕**——默认同构意味着 loader 里的取数逻辑要显式钉到服务端
  （否则会在浏览器里发一次多余的 fetch），比 React Router 的 loader 语义多一层显式边界。

### 5. 与 Neon serverless + Drizzle 的官方集成

- TanStack Start 官方 Databases 指南把 **Neon 列为 vetted partner / 高度推荐的数据库提供方**，
  但同时写明「Documentation for integrating different databases with TanStack Start is coming soon!」
  ——也就是**没有框架级集成文档**，走的是通用 Postgres 方案（
  https://tanstack.com/start/latest/docs/framework/react/guide/databases）。
- Neon 侧有官方 Next.js 与 Drizzle 指南（见 Next.js 第 5 条 URL），但**没有 TanStack Start 的连接指南**
  （Neon 文档索引里只有 Next.js 与 Drizzle 两篇框架相关连接指南：https://neon.com/docs/llms.txt）。
- Drizzle 侧照旧可用 `drizzle-orm/neon-http`（https://orm.drizzle.team/docs/connect-neon）。

### 6. Markdown 渲染 + 消毒在服务端渲染下的注意点

- 官方 guide 推荐的管线是 `unified` + `remark-parse` + `remark-gfm` + `remark-rehype` + **`rehype-raw`** +
  `rehype-stringify`（https://tanstack.com/start/latest/docs/framework/react/guide/rendering-markdown）。
- 关键点：`remarkRehype` 用 `{ allowDangerousHtml: true }`、并接 `rehypeRaw`——即**官方示例是放行原始 HTML**的；
  该页**没有**任何消毒（DOMPurify / sanitize）说明（同上 URL）。
  → 若迁移，消毒责任完全自负；DOMPurify 仍是 DOM-only（见 Next.js 第 6 条）。

### 7. 测试

- **官方文档 sitemap 里没有 testing 指南**（https://tanstack.com/sitemap.xml，2026-09-23 抓取）。
- Vercel 官方 TanStack Start 示例用 **Vitest**（`"test": "vitest run"`，devDependencies 含
  `vitest ^3.0.5`、`@testing-library/react`、`jsdom`）
  （https://github.com/vercel/vercel/blob/main/examples/tanstack-start/package.json）。
- 与现状落差：至少要和 Next.js 一样引入 Vitest 一整套。

### 8. 成熟度 / 状态

- **官方仍标注 Release Candidate**：overview 页顶部 NOTE 原话「TanStack Start is currently in the
  **Release Candidate** stage! ... The road to v1 will likely be a quick one」
  （https://tanstack.com/start/latest/docs/framework/react/overview）。
- npm 版本却是 1.x：`@tanstack/react-start` latest **1.168.57**（发布时间 2026-09-21T20:25:31Z）
  （https://registry.npmjs.org/@tanstack/react-start）。dist-tags 另有
  `pre` 1.168.33-pre.0、`alpha` 1.132.0-alpha.25、`beta` 0.0.1-beta.204（同 URL）。
  → 文档口径（RC）与版本号（1.x）不一致，**以「官方明说 RC + 官方示例钉 alpha 版 Nitro」为准，按未 GA 对待**。
- 两项明确的实验特性：RSC（overview 页「React Server Components are available as an **experimental** feature」，
  同 overview URL）、Static Server Functions（自带 WARNING，见第 2 条 URL）。

### 9. 对本项目最可能的坑（具体）

1. **OAuth 回调不能走 server function。** 触发条件：把 `/api/auth/callback/github` 实现成 `createServerFn()`
   ——默认的 CSRF middleware 会因为缺 `Sec-Fetch-Site`/`Origin`/`Referer` 或跨站来源而拒绝该请求，
   而 GitHub 回调正是从 github.com 跳回来的跨站 GET
   （https://tanstack.com/start/latest/docs/framework/react/guide/server-functions）。
2. **为 Vercel 引入 Nitro，且官方示例钉的是 alpha 版。** 触发条件：按官方文档装 `nitro` 并注册 Vite 插件；
   官方示例里 `nitro` 是 `3.0.1-alpha.0`（第 1 条 URL），意味着多一层第三方构建工具的版本风险。
3. **`/api` 目录名冲突。** 触发条件：沿用现在的 `api/**/*.ts` 命名——Nitro 文档明确
   「Nitro's top-level `/api` directory isn't compatible with Vercel，请改用 `routes/api/`」
   （https://v3.nitro.build/deploy/providers/vercel），与现项目目录约定直接冲突。
4. **loader 默认同构会多打一次请求。** 触发条件：把「按篇取正文」写成普通 route loader 而不加
   `createServerOnlyFn`/server function 边界——首屏在服务端跑一遍、hydration 后在浏览器再跑一遍
   （https://tanstack.com/start/latest/docs/framework/react/guide/execution-model）。
5. **RC 期的 API 漂移。** 触发条件：采用框架的较新特性（prerender 配置项、static server functions、RSC）——
   官方明确 RC 阶段不保证无 bug，且 static server functions 自带 experimental 警告（第 2、8 条 URL）。

---

## 四、对照表

| 维度 | Next.js（App Router） | React Router（framework mode） | TanStack Start |
| --- | --- | --- | --- |
| 部署形态（Vercel 官方） | 零配置；preset 列表含 Next.js（`/docs/frameworks/full-stack/nextjs`） | 零配置；官方维护模板 + `@vercel/react-router` preset「强烈建议」（`/docs/frameworks/frontend/react-router`） | 经 Nitro 部署；自动检测，`vercel.json: framework=tanstack-start`（Vercel KB + TanStack hosting） |
| 运行时 | Route Handler/渲染默认 `nodejs`，`edge` 已 deprecated；区域项目级 `regions`（默认 iad1） | Vercel Functions（Node.js 家族）、支持 Fluid compute | Vercel Functions（Nitro 产物）、默认 Fluid compute |
| 构建期读任意目录 Markdown | 能；Node runtime + `@vercel/nft` tracing，项目根外需 `outputFileTracingRoot`、强制包含用 `outputFileTracingIncludes` | 能且最自然；`react-router.config.ts` 是构建期 Node 脚本，预渲染时 loader 在构建期跑 | 能；`prerender` 配置或（实验性）static server functions；官方建议用 content-collections 而非任意目录 |
| 拿得到访问 host | `headers()`（会 opt 进 dynamic）/ `request.headers.get('x-forwarded-host')`（Vercel：等同 host）/ `VERCEL_URL` | `request.url`（loader/action/server entrypoint 同一签名） | server route 的 `request.url`；**server function 有同源 CSRF 校验，跨站回调不可用** |
| Drizzle + Neon 官方集成 | Neon 有 Next.js 指南 + Drizzle 指南；无三件套专属文档 | 无专属文档；官方模板里有 `node-postgres`（Drizzle + Postgres）档 | Neon 是「vetted partner」；官方明说数据库集成文档 coming soon；无专属文档 |
| 首屏数据模型 | RSC + `use cache`/Cache Components + `generateStaticParams`；对「首屏元数据 + 按篇正文」贴合 | `loader`（服务端）+ resource route；同样贴合，且无新概念 | loader 默认同构（两端都跑）+ server function RPC；贴合但需显式钉服务端 |
| 测试栈 | 官方 Vitest 指南（vitest + RTL + jsdom）；官方声明 Vitest 不支持 async Server Components | 官方 `createRoutesStub` + RTL；默认模板不带测试运行器 | 官方无 testing 指南；Vercel 官方示例用 Vitest |
| 当前版本与成熟度 | **16.3.6**（2026-09-22 release），稳定；App Router 内置 React canary(19) | **8.4.0**（2026-09-15 release），稳定；RSC 标 `unstable` | npm **1.168.57**（2026-09-21），但**官方仍标 Release Candidate**；RSC 与 static server functions 均 experimental |

---

## 五、来源

**Next.js（官方文档 / 官方仓库）**，访问日期均为 2026-09-23
- https://nextjs.org/docs/app/getting-started/installation
- https://nextjs.org/docs/app/getting-started/route-handlers
- https://nextjs.org/docs/app/getting-started/server-and-client-components
- https://nextjs.org/docs/app/getting-started/caching
- https://nextjs.org/docs/app/guides/testing/vitest
- https://nextjs.org/docs/app/api-reference/file-conventions/route
- https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
- https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime
- https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/preferredRegion
- https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- https://nextjs.org/docs/app/api-reference/functions/headers
- https://nextjs.org/docs/app/api-reference/functions/cookies
- https://nextjs.org/docs/app/api-reference/functions/redirect
- https://nextjs.org/docs/app/api-reference/functions/next-request
- https://nextjs.org/docs/app/api-reference/functions/next-response
- https://nextjs.org/docs/app/api-reference/functions/generate-static-params
- https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- https://github.com/vercel/next.js/releases
- https://registry.npmjs.org/next/latest

**React Router（官方文档 / 官方仓库）**，访问日期均为 2026-09-23
- https://reactrouter.com/start/framework/installation
- https://reactrouter.com/start/framework/deploying
- https://reactrouter.com/start/framework/route-module
- https://reactrouter.com/start/framework/rendering
- https://reactrouter.com/start/framework/data-loading
- https://reactrouter.com/start/framework/actions
- https://reactrouter.com/start/framework/testing
- https://reactrouter.com/how-to/pre-rendering
- https://reactrouter.com/how-to/resource-routes
- https://reactrouter.com/how-to/middleware
- https://reactrouter.com/how-to/react-server-components
- https://reactrouter.com/explanation/sessions-and-cookies
- https://github.com/remix-run/react-router/releases
- https://registry.npmjs.org/react-router/latest
- https://registry.npmjs.org/@vercel/react-router/latest
- https://raw.githubusercontent.com/remix-run/react-router-templates/main/default/package.json

**TanStack Start（官方文档 / 官方仓库）**，访问日期均为 2026-09-23
- https://tanstack.com/start/latest/docs/framework/react/overview
- https://tanstack.com/start/latest/docs/framework/react/getting-started
- https://tanstack.com/start/latest/docs/framework/react/guide/hosting
- https://tanstack.com/start/latest/docs/framework/react/guide/execution-model
- https://tanstack.com/start/latest/docs/framework/react/guide/code-execution-patterns
- https://tanstack.com/start/latest/docs/framework/react/guide/server-functions
- https://tanstack.com/start/latest/docs/framework/react/guide/server-routes
- https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering
- https://tanstack.com/start/latest/docs/framework/react/guide/static-server-functions
- https://tanstack.com/start/latest/docs/framework/react/guide/databases
- https://tanstack.com/start/latest/docs/framework/react/guide/rendering-markdown
- https://tanstack.com/start/latest/docs/framework/react/guide/server-components
- https://tanstack.com/sitemap.xml
- https://registry.npmjs.org/@tanstack/react-start
- https://v3.nitro.build/deploy/providers/vercel
- https://github.com/vercel/vercel/blob/main/examples/tanstack-start/package.json
- https://github.com/vercel/vercel/blob/main/examples/tanstack-start/README.md

**Vercel（官方文档）**，访问日期均为 2026-09-23
- https://vercel.com/docs/frameworks
- https://vercel.com/docs/frameworks/more-frameworks
- https://vercel.com/docs/frameworks/full-stack/nextjs
- https://vercel.com/docs/frameworks/frontend/react-router
- https://vercel.com/docs/frameworks/full-stack/tanstack-start
- https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/functions/runtimes
- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- https://vercel.com/docs/functions/runtimes/edge
- https://vercel.com/docs/functions/configuring-functions/region
- https://vercel.com/docs/headers/request-headers
- https://vercel.com/docs/environment-variables/system-environment-variables
- https://vercel.com/docs/builds/configure-a-build
- https://vercel.com/docs/rest-api/reference/endpoints/projects/create-a-new-project
- https://openapi.vercel.sh/vercel.json

**数据库侧（官方文档）**，访问日期均为 2026-09-23
- https://neon.com/docs/guides/nextjs
- https://neon.com/docs/guides/drizzle
- https://neon.com/docs/llms.txt
- https://orm.drizzle.team/docs/connect-neon

**消毒库（官方仓库）**，访问日期 2026-09-23
- https://github.com/cure53/DOMPurify

---

## 六、明确的「未确认」清单

1. **Vercel「Include source files outside of the Root Directory in the Build Step」开关没有面向用户的官方文档**：
   只在 REST API 的 create-project 字段里看到 `sourceFilesOutsideRootDirectory`（boolean，Optional）。
   公开文档的 Root Directory 一节反而写的是「不能访问目录外文件、不能用 `..`」。现项目依赖该能力（内部
   `web/docs/operations.md` 有记录），迁移前必须以项目实际设置为准复核。
2. **Next.js 单函数/中间件在 Vercel 上的确切磁盘产物形态**：官方文档只说明 `.next` 与 tracing 机制，
   未给出可引用的固定目录结构描述。
3. **TanStack Start 的 cookie/session 一等 API**：官方 sitemap 无对应指南页，未确认。
4. **React Router + Neon/Drizzle 的专属官方集成文档**：未找到（只有官方模板档位提到 Drizzle）。
5. **RSC 与 DOMPurify 的官方说明**：框架文档均未直接讨论；「RSC 里不能跑 DOMPurify」是依据
   DOMPurify「DOM-only」声明与 RSC 无 DOM 推出的结论，非文档原文。
