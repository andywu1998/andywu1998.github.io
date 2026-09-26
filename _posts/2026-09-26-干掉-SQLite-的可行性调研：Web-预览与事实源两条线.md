---
layout: post
title: "干掉 SQLite 的可行性调研：Web 预览与事实源两条线"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-26 10:31:50 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/干掉_SQLite_的可行性调研：Web_预览与事实源两条线.md`
# 干掉 SQLite 的可行性调研：Web 预览与事实源两条线

## 结论

**分两条线看，可行性完全不同。**

| 线 | 指的是什么 | 可行性 | 建议 |
| --- | --- | --- | --- |
| Web 侧 | 本地预览的日程读接口去读 SQLite | 可行，且是**删代码**（约 40 行） | 先做 |
| 工作区事实源 | `data/daily_log.sqlite3` 整个干掉，Neon 当权威源 | 技术上做得到，但推翻两条已定 ADR，涉及 71 个文件 | 现在不做 |

一句话：SQLite 不是历史包袱，它现在是「离线采集」与「不可重建台账」这两件事的唯一载体。
Neon 能替代读取面，替代不了这两件。

## 现状：SQLite 到底在扛什么

2026-09-26 实测 `data/daily_log.sqlite3`，2.0 MB，13 个表/视图：

| 表/视图 | 行数 | 性质 |
| --- | --- | --- |
| `events` / `event_revisions` / `event_tags` | 298 / 299 / 766 | 事件线与它的历史 |
| `notes` / `note_revisions` | 125 / 317 | 笔记注册表（正文不落库） |
| `note_path_aliases` | 71 | 改名过的旧链接 |
| `note_topics` / `note_sources` / `sources` | 83 / 4 / 39 | 笔记与来源的关联 |
| `projection_state` / `entity_projection_state` | 789 / 1709 | 各目的地台账（远端 target_id、projected revision、失败原因） |
| `calendar_entries`（视图） | 400 | 日历取合规则的唯一实现，DDL 在 `scripts/calendar_entries.py` |

代码面：

- **71 个文件**引用 `event_store` 或 `daily_log.sqlite3`。`scripts/event_store.py` 1133 行是唯一的写入实现
  （`SQLiteEventStore`）；`scripts/sync_to_feishu_base.py` 1380 行、`scripts/note_cli.py` 651 行、26 个测试文件。
- **采集是硬依赖**：cc-connect `/note` → Go worker
  → `personal_assistant/plugins/personal-assistant-sync/cmd/personal-assistant-sync/main.go:503`
  直接 `exec python3 scripts/capture_event.py --database data/daily_log.sqlite3`。
- **线上不依赖它**：笔记走构建产物（`web/docs/adr/0008`），日程走 Neon 投影（`web/docs/adr/0011`）。
  SQLite 只出现在本机与本地预览两处。

真正不可重建的只有三类：笔记身份（`note_id` 与路径别名）、各目的地台账、revisions 历史。
事件正文与笔记正文都不在库里。

## 方案 A：Web 预览不再读 SQLite（建议先做）

现状里有一处已经和文档不符：`web/scripts/lib/ts-alias-hook.mjs:31` 只要在本地预览进程里，就把
`backend/src/lib/daily-store.ts` 换成 `preview-daily-store.mjs`——于是**预览的日程接口无条件读本地
SQLite，跟 `DATABASE_URL` 配没配无关**；而 `web/scripts/local-preview.mjs:167` 仍按 `DATABASE_URL`
打印 `daily api: live / unavailable`，这句话已经不成立。

改动三处：

- 删 `web/scripts/lib/preview-daily-store.mjs`（35 行）。
- 删 `ts-alias-hook.mjs` 里的那条 swap 分支，预览直接跑真实的 `daily-store.ts`。
- 更新 `web/docs/operations.md` 的「本地预览」一节，并删掉「投影时别让本地预览开着」那个坑：
  预览不再持有数据库文件，就不会再撞 `database is locked`。

代价：预览的日程模块从此需要 `DATABASE_URL`（`.env.local` 里已有）与网络。
收益：Web 侧对 SQLite 的依赖清零（`local-daily-events.mjs` 只服务投影，仍是必需），
预览看到的就是线上真正读的那份数据。

## 方案 B：Neon 当权威源（不建议现在做）

四条具体阻碍：

1. **采集会变成联网写。** `docs/adr/0011` 当初否掉这条路，理由就是「捕获从此依赖网络」——
   断网或 Neon 抖动等于记不下来。
2. **隐私边界要重新划。** ADR 0011 只投影 `internal` / `public`，`private` 不上网。Neon 当源之后，
   `private` 要么也进第三方库，要么另留一份本地存储，那就等于没干掉。当前库里 298 条事件全是
   `internal`，但这条规则是写死过的。
3. **工具链有缺口。** 本机 Python 3.12.4 没有 Postgres 驱动（`psycopg` / `psycopg2` 都 import 失败），
   而写入路径全在 Python；26 个测试现在跑 `InMemoryEventStore`（`sqlite :memory:`），
   换引擎需要一个本地 docker 或 Neon 分支。
4. **备份语义要重做。** 现在数据库跟着代码进 git，迁移前备份就是 `cp`；搬走要重建 PITR，
   以及 `AGENTS.md`「Storage Principle」里「迁移前先备份」那条流程。

真搬过去能得到的好处也是真的：灭掉 git 里的 2 MB 二进制与 `AGENTS.md` 里那段「SQLite 冲突按 union
merge」的人工规则；灭掉两台机器靠 commit 同步数据库、以及持锁那类并发坑；台账本来就是
「不可重建的状态进数据库」说的那种状态，进 Postgres 是顺的。

要做就分档：

| 档 | 做什么 | 保留什么 |
| --- | --- | --- |
| 一档 | 只搬台账（`projection_state` / `entity_projection_state`）与笔记注册表（`notes` / `note_path_aliases` / `note_revisions`） | 事件与 revisions 留本地 |
| 二档 | 全搬，并给采集加重试队列 + 本地降级（离线先落本地队列，联网补写） | 这才谈得上「干掉」 |

## 下一步动作

- [ ] 方案 A：删 swap 与 `preview-daily-store.mjs`，改 `operations.md` 两处。约 40 行删除，风险低。
- [ ] 先决定两台机器同步 `data/daily_log.sqlite3` 的方式是否还要保留——它决定方案 B 走一档还是二档。
- [ ] 真要做方案 B 之前先出一份 spec：把 71 个文件按「必须联网 / 可留本地」分档再估工期，
      本文「现状」一节可直接当输入。

## 参考

- 工作区：`docs/adr/0003`（SQLite 作为每日记录事实源）、`docs/adr/0004`（revision 化的增量投影与台账）
- 网页版：`web/docs/adr/0008`（不可重建的进数据库，可重建的进构建产物）、`web/docs/adr/0011`（日程走数据库投影）
- 网页版：`web/docs/operations.md` 的「日程投影」与「本地预览」两节
