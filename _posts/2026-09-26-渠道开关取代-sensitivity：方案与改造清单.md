---
layout: post
title: "渠道开关取代 sensitivity：方案与改造清单"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-26 17:16:45 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/渠道开关取代_sensitivity_方案与改造清单.md`
# 渠道开关取代 sensitivity：方案与改造清单

> 追踪副本：`.scratch/channel-switches/spec.md`（tickets 与后续修订以那份为准，本笔记是同步快照）。
> 配套决策记录：`docs/adr/0011-channel-switches-replace-sensitivity.md`。
> 当前状态：本方案**尚未过审**。只有 ticket 01（schema 加开关 + 按实测回填）已落地，
> 且它是零行为变化的——新列全部回填成与今天实际到达一致，没有任何读点被切换。
> ticket 02~08 仍处于挂起，等方案确认后放行。

---

**Status**: needs-triage（方案待用户过审；02~08 已挂起）

## Problem Statement

`sensitivity`（`private` / `internal` / `public`）名义上是内容敏感度分级，实际是「这条记录允许被哪些目的地看见」的开关，
而且只是一个半成品：全库 9 个目的地里它只覆盖 2 个，`public` 与 `internal` 行为完全一致，且它在两张表里都是常量——
事件表 298 条 100% `internal`（唯一能算出 `private` 的算式在真实路径上到不了），笔记表 129 篇里 127 篇 `private`
（`register_note` 的默认值刷出来的，不是判断出来的）。详见
`notes/documents/sensitivity_字段梳理与移除方案.md`（note_41fb5cfa22d34bed）。

要表达「这条内容去哪些渠道」需要的是**每个渠道一个布尔**，不是三个互不相关的等级值。

本轮核对还发现一个更严重的事实：**另外两个「渠道开关」里有一个是装饰品。**

| 渠道 | 今天真正的闸门 | 结论 |
| --- | --- | --- |
| 飞书日历 | `calendar_enabled`（`scripts/calendar_entries.py` 的 `ELIGIBLE_DAILY_SQL` / `ELIGIBLE_NOTE_SQL`） | 真闸门，工作正常 |
| 飞书 Base（事件） | `sensitivity != 'private'`（`scripts/sync_to_feishu_base.py:559/702/806`） | 待换成渠道开关 |
| 飞书 Base（笔记） | **没有闸门**（`scripts/note_base_projection.py:333` 全量输出） | 待补 |
| 飞书文档 | `status = 'active'`（`scripts/note_docs_projection.py`） | 待独立成开关 |
| 博客 | **没有闸门**。`scripts/publish_private_blog_data.js:204` 全量读 `logs/daily_log.md` 加密；
`andywu1998.github.io/scripts/import_personal_assistant_notes.py:76` `rglob("*.md")` 全量导入 | 待补（见下「回填」） |
| 网页日程（Neon） | `sensitivity`（`web/scripts/lib/daily-projection.mjs:64`） | 待换成渠道开关 |
| 网页笔记面 | 构建产物全量（`web/scripts/generate-notes.mjs`） | 不在本轮范围 |

`publish_enabled` 目前唯一的可见效果是飞书 Base 里的一个展示列（「博客发布」）。
**374 条内容标着 `publish_enabled=0`，却全部躺在博客上**（129 篇笔记里 128 篇是 0；298 条事件里 246 条是 0）。
所以「给博客加上闸门」这一步如果照字段现值回填，等于一次性静默撤回几百条内容 —— 这是本 spec 最关键的一条约束。

## Solution

### 目标模型：四个渠道开关，一个渠道一个布尔

| 开关 | 管辖 | 取值来源 |
| --- | --- | --- |
| `feishu_docs_enabled`（新增） | 飞书文档（笔记正文） | 每篇笔记独立 |
| `feishu_base_enabled`（新增） | 飞书 Base：日常事件表 + 内容资产表 | 每条记录独立 |
| `calendar_enabled`（已有） | 飞书日历 + 网页日程 | 每条记录独立 |
| `publish_enabled`（已有，本轮接上） | 博客：加密 payload + 笔记导入 | 每条记录独立 |

外加一条规则：**本地日视图不做任何闸门**，`logs/daily_log.md` 永远渲染全文
（它是本机文件，脱敏只会让人误判自己的记录）。删掉 `scripts/daily_log_view.py:75` 的 `[敏感记录已隐藏]` 分支。

`notes.status` 保留既有含义（`active` / `archived` / `withdrawn`，生命周期），不再兼任 Docs 闸门；
`withdrawn` 仍然对所有渠道生效（撤回语义不变）。

### 关键约束：闸门上线必须按「当前实际到达了什么」回填

新开关的初值 = 该条记录**今天是否真的到达了那个目的地**，而不是照旧字段的值抄。
否则一次上线就等于静默撤回。实测回填表（2026-09-26）：

| 表 | 渠道 | 今天实际到达 | 旧字段现值 | 新开关回填 |
| --- | --- | --- | --- | --- |
| events（298） | Base | 298 条全部 | —— | `feishu_base_enabled = 1` |
| events（298） | 日历 | 52 条 | `calendar_enabled=1` 52 条 | 不变（已一致） |
| events（298） | 博客 | 298 条全部 | `publish_enabled=1` 42 条 | `publish_enabled = 1`（**全量**） |
| notes（129） | 文档 | 除 archived 外全部 | `status` | `feishu_docs_enabled = 1`（**全量**） |
| notes（129） | Base | 129 条全部 | —— | `feishu_base_enabled = 1` |
| notes（129） | 日历 | 129 条全部 | `calendar_enabled=1` 129 条 | 不变 |
| notes（129） | 博客 | 129 条全部 | `publish_enabled=1` 1 条 | `publish_enabled = 1`（**全量**） |

### 飞书 Base 的列

按用户裁决「尽量和 SQLite 一样」：**不做组合值列**（不要「渠道 = Base/日历/博客」），
而是照 SQLite 的模型，一个渠道一个独立布尔列：

- 删「敏感级别」。
- 「日历同步」「博客发布」保留（已经是布尔列，模型正确）。
- 新增「飞书文档」（对应 `feishu_docs_enabled`）与「Base 同步」（对应 `feishu_base_enabled`）。
- 「Base 同步」看着自指，但它有真实用途：Base 的行是从 SQLite 投影出来的，直接删行会被下一次投影重建；
  只有 `feishu_base_enabled=0` 才能表达「本地留着、但别放进 Base」。因此投影必须实现**退出**语义：
  开关翻成 0 时把已投影的行删除（或置为撤回），而不是像今天 `sensitivity == 'private'` 那样只是 `continue`。

## 实施步骤

### 阶段一：expand（新旧并存，可独立验证）

1. `scripts/event_store.py`：`events` / `event_revisions` 加 `feishu_base_enabled`；
   `notes` / `note_revisions` 加 `feishu_docs_enabled` 与 `feishu_base_enabled`（`INTEGER NOT NULL DEFAULT 1`）。
   建表语句与增量迁移两处都加；dataclass、`create_event`、`update_event`、`register_note`、
   `update_note_operational`、`_insert_note_revision` 同步带上。
2. 按上面的回填表写入初值（events 与 notes 的 `publish_enabled` 一律置 1；`feishu_*` 一律 1）。
3. 读点切换：
   - `scripts/sync_to_feishu_base.py:559/702/806`：`sensitivity != 'private'` → `feishu_base_enabled`
   - `scripts/note_base_projection.py:371`：同上；`_note_rows()`（`:333`）补上 `feishu_base_enabled` 过滤
   - `web/scripts/lib/daily-projection.mjs:64`：日线改读 `feishu_base_enabled`（笔记线保持不看）
   - `scripts/daily_log_view.py:75`：删除脱敏分支
   - `scripts/note_docs_projection.py`：Docs 闸门从 `status` 改成 `status='active' AND feishu_docs_enabled`
4. 写点带上参数：`scripts/note_cli.py` 加 `--feishu-docs/--no-feishu-docs`、`--feishu-base/--no-feishu-base`、
   `--publish-enabled/--no-publish-enabled`（今天只有打开没有关闭）、`--no-calendar`；
   `scripts/capture_event.py` 的推导改为写 `feishu_base_enabled`；
   Go worker（`main.go:219-232`）透传。
5. 博客闸门接上：`scripts/publish_private_blog_data.js` 与
   `andywu1998.github.io/scripts/import_personal_assistant_notes.py` 按 `publish_enabled` 过滤。
   因为第 2 步已全量回填为 1，这一步的行为变化必须为零（用博客 diff 验证）。

### 阶段二：观察

完整跑一次 `python3 scripts/sync_daily_log_outputs.py` + `scripts/sync_all_outputs.sh`，再等一个 5 分钟 web 投影周期。
对照 Base 行数、飞书日历条数、`logs/daily_log.md` 行数、博客生成物 diff，必须与改动前一致。

### 阶段三：contract（删除 sensitivity）

1. SQLite：`DROP VIEW calendar_entries` → `ALTER TABLE events/event_revisions/notes/note_revisions DROP COLUMN sensitivity`
   → 重建视图。**注意**：本机 SQLite 3.46.1 实测可删带 CHECK 约束的列，但列被视图引用时会失败，所以顺序不能反。
2. 代码：删 `SENSITIVITY_LEVELS`、`_validate_content` 的校验、dataclass 字段、`--sensitivity`、
   `calendar_entries.py` 的 `ENTRY_COLUMNS` 列、`note_docs_projection.py:109`、`note_inbound_reconciliation.py:57`。
3. 飞书 Base：删「敏感级别」列，加「飞书文档」与「Base 同步」。
4. Web：drizzle 迁移删 `calendar_entries.sensitivity`（`ALTER TABLE ... DROP COLUMN`），
   同步 `web/backend/src/lib/schema.ts:75`、`web/scripts/lib/local-daily-events.mjs`、
   `web/scripts/project-calendar-entries.mjs`；`npm run db:check` 必须过。
   需要 `web/.env.local` 里的 `DATABASE_URL`（本机当前缺失，需先 `neon env pull`）。
5. 文档：`personal_assistant/skills/personal-assistant-workflow/references/note-cli.md:73`、
   `docs/adr/0006:26`、`web/docs/adr/0011:11`、`.scratch/web-multimodule-shell/spec.md:135`。
6. 测试：14 个文件 53 处断言改写；`tests/test_daily_log_view.py:118` 与 `tests/test_sqlite_projections.py:305`
   两个「private 被隐藏」的用例改成「渠道开关关闭才被隐藏」。

## 验收

- `python3 -m unittest discover -s tests` 与 `cd web && npm test` 全绿。
- Base 行数、日历条数、日视图行数、博客 payload diff 在 expand 前后完全一致。
- `grep -rn sensitivity scripts/ web/ tests/` 只剩历史快照（`exports/`、`migration-artifacts/`）。
- 反向链路仍可用：在 Base 里改「状态 / 主题 / 日历同步 / 博客发布 / 飞书文档 / Base 同步 / 用户备注」，
  `note_inbound_reconciliation.py` 能回写；非法值仍报错。

## 非目标

- 不改 `notes/status` 的生命周期语义。
- 不给网页笔记面加闸门（它服务的是构建产物，ADR-0008）。
- 不动 `exports/`、`migration-artifacts/` 里的历史快照。
- 事件线不做反向编辑（只有笔记线有 Base 回写链路）。

## 回滚

`data/daily_log.sqlite3` 与代码都在 git 里，按提交逐个 revert 即可；
唯二不可自动回滚的是远端飞书 Base 的列与 Neon 的表结构，两者都只涉及这一个字段，重跑迁移可恢复。
