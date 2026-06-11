---
layout: post
title: "个人助理笔记同步到 GitHub Pages 博客流程"
subtitle: "Codex 个人助理沉淀"
date: 2026-06-11 17:38:43 +0800
tags:
  - "个人助理"
  - "项目"
  - "github_pages_sync"
---

> 来源：`notes/projects/github_pages_sync/01_个人助理笔记同步到博客流程.md`
# 个人助理笔记同步到 GitHub Pages 博客流程

## 背景

2026-06-09，将 `andywu1998.github.io` 仓库中已有的个人助理笔记导入脚本封装成一键同步脚本，便于后续把 `codex_personal_assistant/notes` 下的正式 Markdown 笔记发布到 GitHub Pages 博客。

## 仓库位置

- 博客仓库：`/home/admin/code/cc-connect-work-space/andywu1998.github.io`
- 个人助理仓库：`/home/admin/code/cc-connect-work-space/codex_personal_assistant`
- 导入脚本：`andywu1998.github.io/scripts/import_personal_assistant_notes.py`
- 一键同步脚本：`andywu1998.github.io/scripts/sync_personal_assistant_notes.sh`
- 端到端总同步脚本：`codex_personal_assistant/scripts/sync_all_outputs.sh`
- 兼容入口：`codex_personal_assistant/scripts/sync_feishu_and_blog.sh`，内部转发到 `sync_all_outputs.sh`

## 一键同步命令

如果本轮是“帮我记一下”这类个人助理记录，推荐使用总同步脚本：

```bash
cd /home/admin/code/cc-connect-work-space/codex_personal_assistant
scripts/sync_all_outputs.sh
```

它会先同步飞书多维表格和飞书日历，再提交并推送个人助理仓库，然后调用博客同步脚本发布笔记到 GitHub Pages。

如果只想同步博客，可以直接运行博客仓库脚本：

```bash
cd /home/admin/code/cc-connect-work-space/andywu1998.github.io
scripts/sync_personal_assistant_notes.sh
```

脚本支持把参数透传给 Python 导入脚本，例如：

```bash
scripts/sync_personal_assistant_notes.sh --days 3
```

## 执行流程

### 博客同步脚本

1. 切到 `andywu1998.github.io` 仓库根目录。
2. 执行 `python3 scripts/import_personal_assistant_notes.py --clean "$@"`。
3. Python 脚本扫描 `../codex_personal_assistant/notes` 下的 Markdown 笔记。
4. 排除 `.tmp`、`.venv`、`.venv_mobi_tools`、`source_materials`、`__pycache__`。
5. 为每篇笔记生成 Jekyll front matter，并写入博客 `_posts/`。
6. Reader 首页在 Jekyll 构建时直接通过 Liquid 遍历 `site.posts` 获取文章列表和内容，不再需要额外生成 `reader-posts.json`。
7. 如果工作区没有变化，输出 `No changes to commit.` 并退出。
8. 如果有变化，执行 `git add _posts`。
9. 使用 `$(date +%F) sync` 作为 commit message，例如 `2026-06-09 sync`。
10. 执行 `git push` 推送到 `origin/master`。
11. GitHub Pages 仓库的 CI 在 push 后运行 Jekyll build。

### 飞书 + 博客总同步脚本

`codex_personal_assistant/scripts/sync_all_outputs.sh` 的执行流程：

1. 显示个人助理仓库状态。
2. 执行 `python3 scripts/sync_daily_log_outputs.py`，同步飞书多维表格和飞书日历。
3. 如果个人助理仓库有变更，执行 `git add -A`、commit、push。
4. 切到博客仓库，执行 `scripts/sync_personal_assistant_notes.sh`。
5. 博客脚本负责导入 `_posts`、commit、push。
6. 最后显示个人助理仓库和博客仓库状态。

常用参数：

```bash
scripts/sync_all_outputs.sh --dry-run
scripts/sync_all_outputs.sh --skip-feishu
scripts/sync_all_outputs.sh --skip-blog
scripts/sync_all_outputs.sh --skip-personal-git
scripts/sync_all_outputs.sh -m "2026-06-11 personal assistant sync"
```

## 已验证结果

2026-06-09 已执行：

```bash
chmod +x scripts/sync_personal_assistant_notes.sh
scripts/sync_personal_assistant_notes.sh
```

执行结果：

- 导入 34 篇个人助理笔记到 `_posts/`。
- 生成提交：`c996d4b 2026-06-09 sync`。
- 推送成功：`a95ea9c..c996d4b master -> master`。

## 注意事项

- 该脚本只提交 `_posts` 目录，不会自动提交脚本自身或其他博客配置改动。
- 2026-06-11 起，Reader 已改为 Jekyll 构建时直接内嵌 `site.posts` 数据，不再依赖 `assets/data/reader-posts.json`。
- 新增或修改同步脚本后，需要单独 `git add scripts/sync_personal_assistant_notes.sh`、commit、push。
- 新增或修改总同步脚本后，需要在个人助理仓库提交 `scripts/sync_all_outputs.sh`；兼容入口 `scripts/sync_feishu_and_blog.sh` 会转发到新脚本。
- 默认使用 `--clean` 重建个人助理生成的文章，文章日期取源 Markdown 的最后修改时间，因此旧文章文件名可能随源文件 mtime 改变而发生重命名。
- 如果只想同步最近几天修改的笔记，可传 `--days N`，但默认流程仍会先清理旧生成文章；谨慎使用。

## 后续动作

- 如需一键同时提交脚本自身，可扩展 `git add _posts scripts/sync_personal_assistant_notes.sh`。
- 如需避免旧文章重命名，可在导入脚本中改为读取源文件内固定日期或维护路径到文章文件名的映射。
