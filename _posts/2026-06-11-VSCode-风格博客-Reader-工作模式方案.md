---
layout: post
title: "VSCode 风格博客 Reader 工作模式方案"
subtitle: "Codex 个人助理沉淀"
date: 2026-06-11 16:20:07 +0800
tags:
  - "个人助理"
  - "项目"
  - "github_pages_sync"
---

> 来源：`notes/projects/github_pages_sync/02_VSCode风格博客Reader工作模式方案.md`
# VSCode 风格博客 Reader 工作模式方案

## 背景

2026-06-11 对 `andywu1998.github.io` 做了一轮博客阅读体验改造。目标不是把博客做得更像媒体站，而是新增一个适合上班阅读的低调工作模式：页面看起来像 VSCode 在打开 Markdown 文件，左侧是 Explorer，右侧是带行号的 Markdown 原文。

这个模式的核心诉求有三个：

- 降低博客感：减少大标题、白底文章流、社交和媒体化视觉。
- 提高工作伪装度：视觉上接近代码编辑器、内部文档和项目资料。
- 保持可用性：能按 tag、timeline、搜索快速找到文章，并支持多标签页阅读。

## 最终形态

新增页面：

```text
https://andywu1998.github.io/reader/
```

页面结构：

```text
左侧 Explorer
  - SEARCH
  - TAGS
  - TIMELINE

右侧 Editor
  - 顶部多标签页
  - 当前 Markdown 文件路径
  - open original 原博客链接
  - 带行号的 Markdown 原文
```

## 关键设计决策

### 1. 不替换原文章详情页

原博客文章页继续保留，避免影响历史链接、SEO 和 GitHub Pages 生成逻辑。Reader 是一个新增入口，作为“工作模式”使用。

导航新增：

```yaml
Reader: "reader/"
```

### 2. Reader 数据由 Jekyll 构建时内嵌

第一版 Reader 使用过静态 JSON：

```text
assets/data/reader-posts.json
```

但这引入了额外数据生成依赖：同步 `_posts` 后还要刷新 JSON，否则 `/reader/` 可能看不到最新文章。

后续改为由 Jekyll 在构建首页和 `/reader/` 时直接遍历：

```text
site.posts
```

并把 metadata 和文章 HTML 内嵌到页面里：

```liquid
{% raw %}{% for post in site.posts %}{% endraw %}
```

前端不再 fetch 外部 JSON，而是读取页面内的 `reader-posts-data`，点击文章后从隐藏的 HTML 内容区取出文章 HTML，再转换成伪 Markdown 展示。

### 3. 前端全部静态实现

Reader 页面由三部分组成：

```text
reader.html
assets/css/reader.css
assets/js/reader.js
```

不引入 React/Vue，不增加构建链路，保持 GitHub Pages 可直接构建。

### 4. 左右区域独立滚动

上线后发现原始版本仍保留顶部白色博客导航，而且左右滚动会受整页滚动影响。随后修正为：

- Reader 主区域高度使用 `100vh`
- `body` 禁止滚动
- 左侧 Explorer 独立滚动
- 右侧 Markdown 编辑区独立滚动
- 顶部白色导航改成左下角的小型 VSCode 风格菜单

这样鼠标在左侧时只滚 Explorer，在右侧时只滚正文。

## 已完成改动

### Reader 第一版

提交：

```text
385e323 Add VSCode style reader
```

文件：

```text
_config.yml
reader.html
assets/css/reader.css
assets/js/reader.js
_includes/reader-app.html
```

实现能力：

- `/reader/` 页面
- 左侧 `SEARCH` / `TAGS` / `TIMELINE` 三个视图
- 搜索标题、tag、路径、Markdown 正文
- 点击文章打开右侧内容
- 多标签页打开、切换、关闭
- URL hash 同步当前文章
- `localStorage` 恢复已打开 tabs 和当前文章
- 由渲染 HTML 转换得到的伪 Markdown 展示
- 行号展示
- `open original` 跳转原博客文章页

### Reader 布局修正

提交：

```text
f03855c Refine reader workspace layout
```

修正内容：

- 去掉 Reader 顶部白色大导航条的视觉干扰
- 把导航按钮放到左下角
- Reader 页面改成全屏工作台
- 左右滚动区域独立
- 避免整页滚动影响阅读

## 使用方式

### 访问 Reader

```text
https://andywu1998.github.io/reader/
```

### 搜索文章

进入 `SEARCH` 视图，输入关键词。搜索范围包括：

- 标题
- 副标题
- tag
- 本地路径
- Markdown 原文

### 按 tag 浏览

进入 `TAGS` 视图，每个 tag 是一个目录，文章是目录下的文件。

### 按时间线浏览

进入 `TIMELINE` 视图，按年份分组，文章按日期倒序展示。

### 多标签页

点击左侧文章：

- 如果 tab 已存在，切换到对应 tab。
- 如果 tab 不存在，新开 tab。
- 点击 tab 右侧 `×` 可关闭。

## 维护流程

新增或修改博客文章后，只需要更新 `_posts` 并推送。Reader 首页和 `/reader/` 会在 GitHub Pages 的 Jekyll 构建阶段自动从 `site.posts` 读取最新文章。

不再需要：

```text
assets/data/reader-posts.json
scripts/build_reader_data.py
```

如果本轮是“帮我记一下”这类个人助理记录，推荐直接运行：

```bash
cd /home/admin/code/cc-connect-work-space/codex_personal_assistant
scripts/sync_feishu_and_blog.sh
```

这个脚本会串联飞书同步、个人助理仓库 commit/push、博客同步和博客仓库 commit/push。Reader 数据由 Jekyll 构建自动内嵌，不再需要额外刷新。

## 验证记录

本地环境没有 Ruby、Bundler 和 Docker，因此不能在本机完整复现 Jekyll 构建。

已经做过的可用检查：

```bash
node --check assets/js/reader.js
git diff --check
```

线上页面已可访问，说明 GitHub Pages 构建和部署成功。

## 后续动作

1. 给 Reader 增加快捷键：
   - `Ctrl+P` 搜索文章
   - `Ctrl+W` 关闭当前 tab
   - `Ctrl+Tab` 切换 tab
2. 增加“只看个人助理 / 读书笔记 / 投资研究”的快速筛选。
3. 根据实际上班阅读体验，继续压缩字号和行距。
