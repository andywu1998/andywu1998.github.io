---
layout: post
title: "网页版前端装备六个 agent skill：来源、用法与已知缺口"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-22 18:24:32 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/网页版前端装备六个_agent_skill：来源、用法与已知缺口.md`
# 网页版前端装备六个 agent skill：来源、用法与已知缺口

## 背景

2026-09-22，为「优化个人助理网页版（Folio）的前端」这件事先备齐 agent 侧的工具。
从 OpenAI 的 `openai/plugins` 和 Anthropic 的 `anthropics/skills` 里挑了六个前端方向的
skill，装进 `web/.agents/skills/`，与既有的 `neon`、`neon-postgres`、
`personal-assistant-web` 同处一地，工作区 `.codex/skills/` 里有对应软链。

本机 GitHub 直连不通，安装与推送都走 `monocloud-cli` 的代理；`git clone` 直连会卡在
`git-remote-https` 上不动，这个坑记在下面。

## 装了什么

| skill | 来源 | 触发 | 作用 |
| --- | --- | --- | --- |
| `audit` | `openai/plugins` → `product-design` | 要审、评、检查某个流程或屏幕 | 先截图，再出 UX 与无障碍结论 |
| `frontend-design` | `anthropics/skills` | 新建或重塑 UI 的审美方向 | 设计判断与「AI 味」自检表 |
| `frontend-app-builder` | `openai/plugins` → `build-web-apps` | 从零做界面，或明确要求 redesign | 概念图到实现的 10/10 一致性 |
| `frontend-testing-debugging` | 同上 | 改到渲染出来的界面 | 强制验证闭环与 QA 报告 |
| `webapp-testing` | `anthropics/skills` | 用 Playwright 测本地页面 | 起服务、截图、看 console |
| `react-best-practices` | `openai/plugins` → `build-web-apps` | 写、审、重构 React | Vercel 的 64 条性能规则 |

## 各自站在流程的哪一格

- 动手前 —— `audit`：现在这个界面哪里不行
- 定方向 —— `frontend-design`：它该长成什么样
- 真动手 —— `frontend-app-builder`：概念图到实现
- 改完验证 —— `frontend-testing-debugging`（纪律）加 `webapp-testing`（工具）
- 收尾 —— `react-best-practices`：React 性能与写法过一遍

## 每条最值得记住的一点

- `audit`：结论必须长在截图上，只用本次运行里抓到的截图，不许拿记忆或缓存图当证据；
  不许只凭截图宣称符合无障碍标准。浏览器里已经打开目标页面就用当前 tab 不要重新导航，
  这条正好绕开 Folio 需要 GitHub 登录的问题。
- `frontend-design`：先出设计计划，再拿计划回头问「这是不是我对任何类似页面都会产出的东西」，
  是就改。它点名了一串「AI 味」特征（米白配高对比衬线、近黑底配单一荧光色、所有内容切成
  同样的圆角卡片、全大写 eyebrow、`·` 连接的中缀），当自检表用。
- `frontend-app-builder`：流程很重，概念一经确认就是生产级规格，实现期不许改布局、文案、层级、
  密度；交付前必须同时看概念图和最新截图。只想改 CSS 别用它。
- `frontend-testing-debugging`：先把目标流程写成一句话，再最小改动、渲染验证、出 QA 报告；
  Browser 插件在就优先用它。
- `webapp-testing`：脚本当黑盒用，先跑 `--help` 不要读源码；动态页面必须在
  `wait_for_load_state('networkidle')` 之后再读 DOM。
- `react-best-practices`：它出身 Next.js 与 RSC，Folio 是纯客户端 Vite SPA，
  真正对口的是 `rerender-`、`client-`、`rendering-`、`js-` 四类，照搬 Next 专有条款是唯一的坑。

## 已知缺口

- `audit/SKILL.md` 引用了插件的 `../index/SKILL.md`、`../user-context/SKILL.md`、
  `../../references/critical-overrides.md`，三者都在 `product-design` 插件里、当前没装，是死链。
- 本机没有 Browser 插件，`frontend-testing-debugging` 与 `frontend-app-builder` 会走 Playwright
  回退并记录原因。
- `audit` 所在的 `product-design` 插件 license 是 Proprietary。
- `skills-lock.json` 只覆盖 `neon` 与 `neon-postgres`，其 `computedHash` 算法无从考据，
  这批没有往里加。

## 安装与升级

必须带代理，否则会卡在 `git-remote-https` 上。

```bash
export http_proxy=http://127.0.0.1:7890 https_proxy=$http_proxy
python3 ~/.cc-connect-qqbot/codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo openai/plugins \
  --path plugins/build-web-apps/skills/frontend-app-builder \
  plugins/build-web-apps/skills/frontend-testing-debugging \
  plugins/build-web-apps/skills/react-best-practices \
  plugins/product-design/skills/audit \
  --dest .agents/skills
```

目标目录已存在时脚本会直接报错退出，升级要先删对应目录。装完在工作区 `.codex/skills/` 里
补一条同名软链，指向 `codex_personal_assistant/web/.agents/skills/<name>`。

## 相关产物

- `web/docs/frontend-skills.md` —— 逐个 skill 的来源、触发、机制、硬规则、在本站点上的用法、
  已知缺口与安装命令，是这件事的正式文档。
- 提交：`816164c feat(web): 装上前端方向的六个 agent skill`、
  `0ecde51 docs(web): 沉淀前端 agent skills 说明文档`。
