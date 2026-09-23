---
layout: post
title: "个人助理笔记投影：front matter 泄漏与本地图片上传修复"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-22 18:24:32 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/个人助理笔记投影：front_matter_泄漏与本地图片上传修复.md`
# 个人助理笔记投影：front matter 泄漏与本地图片上传修复

个人助理的笔记以「本地 Markdown 为源，飞书为投影」：`scripts/note_cli.py` 把 `notes/documents/*.md` 投影到三层目标——Feishu Docs（正文）、Base「内容资产」（结构化元数据 + 摘要）、Calendar（事件描述）。本文记录这次修复的两个缺陷、处理方式和验证结果。

## 1. 缺陷一：YAML front matter 泄漏到飞书

### 现象

- 每篇文档正文顶部多出一个 H2：`note_id: note_xxx` / `content_type: project`
- Base「摘要」字段存的是 `---\nnote_id: ...` 而不是真正的首段
- 日历事件描述里「摘要：」后面同样是元数据块

### 根因

笔记文件头部是本地登记信息，不属于正文：

```yaml
---
note_id: note_d6e36a13252f43bd
content_type: project
---
```

投影时把「整个文件内容」当成正文交给了飞书，于是 `---` 被解析成水平线，`note_id: ...` 被解析成标题。

### 修复

`strip_front_matter()`（`scripts/note_cli.py`）复用已有的 `parse_markdown` 解析头部，在投影入口统一剥离。

推送正文的独立路径一共有 **3 条**，全部覆盖：

| 路径 | 入口 | 状态 |
|---|---|---|
| 常规投影 | `run_note_projection()`（`sync` / `create`） | 本次修复 |
| 项目来源登记 | `sync_project_sources()`（`project-sources`） | 本次修复（此前漏改） |
| 日历描述 | 复用同一份 markdown | 自动受益 |

## 2. 缺陷二：本地图片不会上传

### 现象

飞书 Docs 投影走 Markdown 导入，**相对路径图片会被静默丢弃**；而同步使用 `overwrite` 整篇覆盖，等于每次同步都会抹掉手工插进去的图。

### 修复

分三步：

1. 推送前：`extract_local_images()` 把「本地真实存在」的图片替换成唯一占位符 `FEISHUIMAGEPLACEHOLDER000`；远程 URL 和缺失文件保持原样
2. 主文档写完后：`media-insert` 上传图片
3. `block_move_after` 把图片挪到占位符后面 → `block_delete` 删掉占位符

`media-insert` 在图片所在目录下执行，因为 lark-cli 不接受绝对路径。

## 3. 历史数据清理

全库 83 篇文档正文与 83 条 Base 摘要都带同样的元数据。处理策略分两种，目的是不误伤正文：

| 对象 | 方式 | 原因 |
|---|---|---|
| 11 篇（路径规范） | 重置投影状态后正规重投影 | 顺便端到端验证新流程 |
| 72 篇（legacy 路径） | `block_delete` 精确删除 `<hr/>` + 元数据块 | 正文一个字符不动，零风险 |
| Base 摘要 / 日历描述 | 重投影更新字段 | 只改字段，不改正文 |

## 4. 顺带修掉的三个 bug

1. `read_note_markdown` 用 `ROOT / rel_path` 拼路径，但 71 篇扫描注册的 legacy 笔记在库里存的是相对 `notes/` 的路径（`documents/x.md`），`sync` 会直接 `FileNotFoundError`。改为复用 `read_note_markdown_at`，并让 `resolve_note` 在 `--path` 查不到时回退去掉 `notes/` 前缀再查一次。
2. Base 的 `_summary` 没跳过正文开头的分隔线，会把摘要算成 `"---"`（`伯恩斯坦研报` 就是这种情况）。与 Calendar 的同类实现对齐，跳过整段由 `-`/`*`/`_` 组成的分隔线。
3. `sync_project_sources` 把含 front matter 的全文传给了 Base。

## 5. 验证

- 83 篇文档正文：**0 泄漏**（全库抓取扫描）
- 83 条 Base 摘要：**0 脏、0 空**
- 日历描述：抽查无残留
- 72 篇重投影中只有 1 篇内容变化，是本地新增 6/7 月数据的**纯补写**，无丢失
- 单元测试从 125 增至 **133**，全部通过

## 6. 已知限制

- `docs +update --command overwrite` 对超大文档会服务端超时：实测 105KB 的 `伯恩斯坦研报` 稳定失败（重试两次均超时），需要改成分段写入
- 判断一个文档是否等于「本地 Markdown 的纯投影」缺乏可靠手段。用字符覆盖率区分「格式差异」和「人工改动」并不可靠——拿已修复的笔记做基线也只有 96.8%

## 7. 相关代码

- `scripts/note_cli.py`：`strip_front_matter`、`read_note_markdown`、`resolve_note`
- `scripts/note_remote_adapters.py`：`extract_local_images`、`LarkCliDocsClient._place_images`
- `scripts/note_base_projection.py`：`_summary`
- 测试：`tests/test_note_cli.py`、`tests/test_note_remote_adapters.py`、`tests/test_note_project_sources.py`、`tests/test_note_base_projection.py`
