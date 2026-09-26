---
layout: post
title: "sensitivity 字段梳理：作用、出处、含义与移除方案"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-26 17:16:45 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/sensitivity_字段梳理与移除方案.md`
# sensitivity 字段梳理：作用、出处、含义与移除方案

> 一句话结论：`sensitivity` 不是内容敏感度分级，而是一个**只表达「本地留档 / 不外发」两态的目的地开关**；它真正生效的地方只有 6 处；而库里这个字段在两张表里其实都是**常量**（事件表 298/298 是 `internal`，笔记表 129 篇里 127 篇是 `private`）——它拦下过的真实数据是零。删掉它是零行为变化，把它换成「每渠道一个开关」才是它本来想做的事。

## 一、字段是什么

取值只有三个（`scripts/event_store.py:24`）：

```python
SENSITIVITY_LEVELS = frozenset({"private", "internal", "public"})
```

代码里没有任何一处读这三个值去做「内容风险」「加密」「访问控制」的判断。它被读取的唯一形态是：

```python
if event.sensitivity == "private":
    ...跳过 / 隐藏...
```

也就是说 `public` 和 `internal` 在代码中**完全等价**——唯一把两者并列取合的地方写的是 `entry.sensitivity === 'internal' || entry.sensitivity === 'public'`（`web/scripts/lib/daily-projection.mjs:64`）。整个字段的实际信息量只剩一个二值问题：「这条算不算 private」。

## 二、定义与默认值从哪来

| 事实 | 位置 |
| --- | --- |
| 枚举常量 | `scripts/event_store.py:24` |
| `events.sensitivity` | `NOT NULL` + `CHECK IN ('private','internal','public')`，无默认值（`scripts/event_store.py:183`） |
| `event_revisions.sensitivity` | 同名字段，快照列（`scripts/event_store.py:212`） |
| `notes.sensitivity` | 同 check，`NOT NULL` 无默认（`scripts/event_store.py:238`） |
| `note_revisions.sensitivity` | `NOT NULL DEFAULT 'private'`（`scripts/event_store.py:262`） |
| 历史增量迁移（老库补列） | `scripts/event_store.py:361` |

各写入路径实际写什么值：

| 写入路径 | 写入值 | 位置 |
| --- | --- | --- |
| `capture_event.py`（Codex / MCP 捕获） | `internal` if `publish_enabled` else `private` | `scripts/capture_event.py:57` |
| `migrate_daily_log_to_sqlite.py`（老 Markdown 迁移） | 一律 `internal` | `scripts/migrate_daily_log_to_sqlite.py:83`、`:108` |
| `import_feishu_daily_log.py`（飞书表格回灌） | 一律 `internal` | `scripts/import_feishu_daily_log.py:82`、`:97` |
| `note_cli.py create` | 默认 `private` | `scripts/note_cli.py:152`、`:219` |
| `note_cli.py sync` | 不传则**沿用现值**（不会被重置） | `scripts/note_cli.py:160`、`:256` |
| cc-connect `/note`（Go worker） | 完全不传该字段 → 落到 `capture_event` 的推导 | `personal_assistant/plugins/personal-assistant-sync/cmd/personal-assistant-sync/main.go:219-232` |
| 从飞书 Base 反向编辑 | 读回 Base 的「敏感级别」列并校验 | `scripts/note_inbound_reconciliation.py:57-61` |

设计初衷写在 `.scratch/personal-assistant-event-model/spec.md:46`：

> As a personal assistant user, I want sensitivity levels, so that private content is not sent to an **inappropriate** destination.

注意原文是「不合适的目的地」，不是后来文档里被简化成的「一律不上网」——这个措辞漂移正是今天语义混乱的起点（见第五节）。

## 三、它长在哪里（完整清单）

按载体分，一共 7 类：

**1. 本地 SQLite · 4 个列**：`events`、`event_revisions`、`notes`、`note_revisions`（`data/daily_log.sqlite3`）。

**2. Python 代码 · 11 个文件**
`scripts/event_store.py`（定义、校验、读写）、`scripts/capture_event.py`、`scripts/daily_log_view.py`、`scripts/sync_to_feishu_base.py`、`scripts/note_base_projection.py`、`scripts/note_inbound_reconciliation.py`、`scripts/note_cli.py`、`scripts/note_docs_projection.py`、`scripts/calendar_entries.py`、`scripts/migrate_daily_log_to_sqlite.py`、`scripts/import_feishu_daily_log.py`。

**3. Go worker · 1 个文件**：`/note` 不传 `sensitivity`，由 `capture_event` 按 `publish_enabled` 推导（`main.go:228-230` 把 `calendar_enabled`/`publish_enabled`/`push_repos` 写死为 `true`）。

**4. 飞书 Base · 一个列名叫「敏感级别」**
两个表都有：日常记录表（`scripts/sync_to_feishu_base.py:573`、`:656`）与「内容资产 V2」笔记表（`scripts/note_base_projection.py:356`）。反向编辑也认这个列名（`scripts/note_inbound_reconciliation.py:13`）。

**5. Web / Neon · 一条完整链路**
`web/backend/src/lib/schema.ts:75`、`web/drizzle/0000_init.sql:11`、`web/scripts/lib/local-daily-events.mjs:35,48,81,93`、`web/scripts/project-calendar-entries.mjs:116,127,148,191`、`web/scripts/lib/daily-projection.mjs:64`。

**6. 文档 · 24 个文件**（ADR / spec / 技能参考）
重点三处：`docs/adr/0006-note-registry-and-projection-ledger.md:26`、`docs/adr/0010-calendar-entries-shared-definition.md:10,55-57`、`web/docs/adr/0011-daily-events-served-from-a-database-projection.md:11,31,42`，外加 `.scratch/` 下 8 个 spec/issue 与 `personal_assistant/skills/personal-assistant-workflow/references/note-cli.md:73`。

**7. 测试 · 14 个文件、53 处**（`tests/` 13 个 + `web/tests/daily-projection.test.mjs`）。

只读历史、不在改动范围：`exports/flomo/`、`migration-artifacts/`（含 `base-consolidation-20260830/old-daily-log-v2.json`）。

## 四、真正生效的过滤点：6 处

| # | 位置 | 行为 |
| --- | --- | --- |
| 1 | `scripts/daily_log_view.py:75` | private 事件在 `logs/daily_log.md` 里渲染成 `[敏感记录已隐藏]` |
| 2 | `scripts/sync_to_feishu_base.py:559` | 事件 Base 的行构建时 `continue` |
| 3 | `scripts/sync_to_feishu_base.py:702` | V2 投影跳过，并写一条 `skipped` 台账（`error="private event"`） |
| 4 | `scripts/sync_to_feishu_base.py:806` | 旧版投影同上 |
| 5 | `scripts/note_base_projection.py:371` | private **事件**不进「内容资产 V2」 |
| 6 | `web/scripts/lib/daily-projection.mjs:64` | 网页日线；笔记线显式不过滤（同文件 `:54-57` 的注释写明） |

**不看这个字段的地方**（比看它的多）：

- **飞书日历**：闸门是 `calendar_enabled`。取合规则只有一份，写在 `scripts/calendar_entries.py` 的 `ELIGIBLE_DAILY_SQL`（`calendar_enabled=1` 且有发生时间）与 `ELIGIBLE_NOTE_SQL`（`status='active'` 且有落点，`scripts/calendar_entries.py:57-62`），两句 SQL 都没有 sensitivity 条件。`sync_daily_log_to_feishu_calendar.py` 与 `note_calendar_projection.py` 全文不含 `sensitivity`。
- **飞书文档（笔记正文）**：`note_docs_projection.py` 只看 `status`。
- **笔记 Base**：`note_base_projection._note_rows()` 不过滤，只把值当一列输出（`scripts/note_base_projection.py:333-357`）。
- **博客**：只认 `publish_enabled`。
- **网页笔记面**：`web/scripts/generate-notes.mjs` 全量遍历 `notes/`，零过滤。
- **cc-connect `/note`**：三个渠道写死 `true`（`main.go:228-230`）。

> 也就是说：库里那 126 篇 `private` 笔记，一直在往飞书文档和 Base 里写。字段值本身没有挡住任何东西。

## 五、它的意义：设计意图 vs 现实

**意图**：一个「这条内容能不能离开本机」的总闸门（`personal-assistant-event-model/spec.md:46`）。

**现实**：它是一个目的地开关的半成品，且只覆盖了 9 个目的地中的 2 个。语义坏掉有三个实证：

1. **`public` 与 `internal` 零行为差异**。三个取值实际只提供两个状态，其中一个还没有任何消费方。
2. **名字与实际用途不符**。名字读作「敏感度」，是内容分级；实际是「目的地可见性」，是路由开关。于是它被当成内容分级来填（`note_cli.py:152` 默认 private、`/note` 路径全 true），而没人知道该按什么标准填。
3. **与既有开关语义重叠**。`calendar_enabled` 才决定日历、`publish_enabled` 才决定博客，但在文档叙事里却变成「private 一律不上网」，两者冲突。

**错误认知（「private 一律不上网」）的源头只有两处，且都是网页日程这一条线的局部口径**：

- `web/docs/adr/0011-daily-events-served-from-a-database-projection.md:11`：「只投影 `status = active` 且 `sensitivity ∈ {internal, public}` 的事件；`private` 不上网。」
- `.scratch/web-multimodule-shell/spec.md:135`：同一句话的转述。

这两处的语境都只是「网页日线的不变量」，不是全仓库契约。`docs/adr/0010:55-57` 里其实明确写了相反的事实（笔记线不做 sensitivity 过滤，真库里 109 篇笔记有 106 篇是 private），`web/scripts/lib/daily-projection.mjs:54-57` 的注释也复述了这一点。

**为什么它该被删而不是被修**：修的方向只有「加第四个值」或「再加一个字段」。目的地已经 9 个，一个三值枚举在结构上不可能表达「这条去 A 不去 B」；而一旦开始加值，就是承认它其实是渠道开关——那不如直接做成渠道开关，一个渠道一个布尔列，语义自解释、可独立演进。

## 六、库里实测（2026-09-26）

```
events:  internal 298 | private 0 | public 0     （共 298）
notes:   private  126 | internal 1 | public 1    （共 128）
```

推论：

- **事件线上 private 分支从未命中过**。第 4 节里 #1~#4 四处过滤、`daily-projection.mjs` 那处，全是从未执行过的死代码。这也意味着迁移是**零行为变化**，可证。
- 笔记线 126/128 标了 private，但笔记线的目的地（Docs、Base、博客、网页笔记面）都不读它，所以这些标记只在 Base 里当一个展示列存在。
- 全库**唯一的** `sensitivity` 语义差异只可能出现在「将来新写一条 private 事件」时，而没有任何现存数据依赖它。
### 补充：这个字段在两张表里都是**常量**

上面那组数字容易被读成「有人刻意标了 private」。真相相反：**两张表里它都是常量，只是常量值不同。**
「库里有没有 private」这个问法本身会骗人——得先问是哪张表。

事件表按来源拆开，没有任何一个来源产出过别的值：

| source | sensitivity | 条数 | 谁写的 | 为什么是这个值 |
| --- | --- | --- | --- | --- |
| `legacy_markdown` | internal | 165 | `migrate_daily_log_to_sqlite.py` | 硬编码 `internal`（`:83`、`:108`） |
| `feishu` | internal | 91 | `import_feishu_daily_log.py` | 硬编码 `internal`（`:82`、`:97`） |
| `feishu_note` | internal | 38 | cc-connect `/note` Go worker | `publish_enabled` 钉死为 `true` → `capture_event.py:57` 推导出 `internal` |
| `mcp_capture` | internal | 4 | `capture_event.py` | 同上，调用时传了 `publish_enabled=true` |

`capture_event.py:57` 是全仓库**唯一**能算出 `private` 的算式（`"internal" if publish_enabled else "private"`），
但它的两个调用方（Go worker 与 CLI）在所有真实路径上都不会传 `publish_enabled=false`。
所以 `private` 事件不是「没人想写」，而是**这条路径根本到不了**。

笔记表则反过来：

- `register_note` 的默认值是 `private`（`scripts/event_store.py:696`、`:712`）。
- 五类调用路径里，`note_migration.py:372,382` 与 `event_store.py:900`（归档回写）**完全不传**该参数 → 落默认 `private`；
  `note_docs_projection.py:102` 传的是 `note.sensitivity`（原样回写）；只有 `note_cli.py:213` 会写一个用户可能显式指定的值，而它的默认同样是 `private`（`note_cli.py:152`）。
- 结果：129 篇里 127 篇 private。仅有的两篇例外都是手工/测试入口留下的——
  `note_cc_connect_feishu`（public）与 `note_15834bd3146341e2`（internal）。

**一边永远是 `internal`、一边永远是 `private`**：这就是「这个字段没有承载任何信息」最直接的证据，
比「0 条 private 事件」更彻底，也说明删掉它不会有任何语义损失。

顺带解释「为什么感觉哪儿都看不到 private」：这个值在任何人类会打开的界面里都不出现——
`note_cli.py status` 不打印它（对比 `note_cli.py:105` 的输出字段），
笔记文件的 front matter 不含它（`assemble_markdown`，`scripts/note_cli.py:555-568`），
生成的 `logs/daily_log.md` 没有这一列，网页也不展示它。
唯一能直接看到它的地方是手查 SQLite，或飞书 Base 的「敏感级别」列。

## 七、删掉有哪些影响

逐处对照（「现在」→「删掉后」）：

| 位置 | 现在 | 删掉后 | 净变化 |
| --- | --- | --- | --- |
| `daily_log_view.py:75` | private 渲染成 `[敏感记录已隐藏]` | 永远渲染全文 | 0 条受影响；规则少一条分支 |
| `sync_to_feishu_base.py:559/702/806` | private 跳过 + `skipped` 台账 | 按渠道开关决定 | 0 条受影响 |
| `note_base_projection.py:371` | private 事件不进 Base | 同上 | 0 条受影响 |
| `daily-projection.mjs:64` | 日线 `internal/public` 才投 | 日线按 `calendar_enabled` 筛 | 0 条受影响 |
| 飞书 Base「敏感级别」列 | 展示一个字符串 | 删列，或原地改成渠道列 | 表结构变更 |
| `note_inbound_reconciliation.py:57-61` | 从 Base 读回并校验 | 去掉这条回写 | **必须同步改，否则远端编辑会抛 `invalid note sensitivity`**（`tests/test_note_inbound_reconciliation.py:113` 就是这条断言） |
| Neon `calendar_entries.sensitivity` | `NOT NULL` | 迁移删列 | 需 drizzle 迁移 + schema-drift 校验 |
| 代码 `Event.sensitivity` / `Note.sensitivity` | dataclass 字段、校验、CLI 参数 | 全删 | 11 个 Python 文件 + Go worker |
| 测试 14 文件 53 处 | 断言 | 改写 | 纯机械 |

**真正的代价只有一条**：失去「一句话把所有外部目的地挡掉」的能力。而这正好就是要用每渠道开关替代的东西——用 `feishu_base_enabled=false / calendar_enabled=false / publish_enabled=false` 表达，比 `private` 更精确，也不会再让人误以为它管全局。

**迁移风险点（都已定位）**：

- SQLite `DROP COLUMN` 本机实测（3.46.1）**可以删除带 CHECK 约束的列**，但**如果该列被视图引用会失败**。`calendar_entries` 视图同时引用了 `e.sensitivity` 与 `n.sensitivity`（`scripts/calendar_entries.py:79,100`），所以必须 `DROP VIEW calendar_entries` → 删列 → 重建视图。
- 删除顺序必须 expand → contract：先加新开关并回填，跑一版观察，再删旧字段。否则中间态无法对照。
- 飞书 Base 的列是远端资源，删列/改列要在代码改动前手工确认（代码里 `available_fields` 是动态读取的，`敏感级别` 不在 `config/feishu_base.json` 里）。
- `note_revisions` / `event_revisions` 是历史快照表，删列意味着放弃「回到旧快照能看出当时的可见性」；由于从未有 private 事件、且笔记线的值也从未生效，这个信息量为零。

## 八、怎么去掉：用渠道开关取代敏感级别

**目标模型**（一个渠道一个布尔，语义自解释）：

| 开关 | 管辖 | 现状 |
| --- | --- | --- |
| `feishu_base_enabled`（**新增**） | 飞书 Base：事件表 + 内容资产 V2 | 目前由 `sensitivity != 'private'` 兼任 |
| `calendar_enabled`（已有） | 飞书日历 + 网页日程 | 不动 |
| `publish_enabled`（已有） | 博客 | 不动 |
| （待定） | 飞书文档 | 方案一：不加开关，跟随 `status='active'`；方案二：加 `feishu_docs_enabled` |

**外加一条规则**：本地日视图不再有任何闸门，永远渲染全文（它是本机文件，脱敏只会让人误判自己的记录）。

**四步走（每步独立可验证）**：

1. **冻结口径（文档先行）**
   - 新增 `.scratch/sensitivity-removal/spec.md`：列全 5 个过滤点与目标规则。
   - 写一篇新 ADR（「渠道开关取代敏感级别」），并 supersede 三处旧表述：`docs/adr/0006:26`（把它列为快照元数据）、`web/docs/adr/0011:11`、`.scratch/web-multimodule-shell/spec.md:135`。
   - 拆 ticket（按 `docs/agents/issue-tracker.md`，每张一个文件，`Status: ready-for-agent`）。

2. **Expand：加新开关，旧字段并存**
   - `events` / `note_revisions` 加 `feishu_base_enabled INTEGER NOT NULL DEFAULT 1`（`scripts/event_store.py` 的建表 + `additions` 迁移两处都要加）。
   - 回填全部为 `1`：事件线本来就没有 private 被挡过；笔记线 Base 从不过滤，所以 1 是等价的。
   - 把第 4 节的 5 个过滤点从 `sensitivity != 'private'` 改成 `feishu_base_enabled = 1`（`daily_log_view.py:75` 这条直接删掉分支）。
   - `note_cli.py` 加 `--feishu-base/--no-feishu-base`，`capture_event.py` 的推导改为写 `feishu_base_enabled`，Go worker 透传。
   - 跑 `python3 -m unittest discover -s tests` 与 `cd web && npm test`。

3. **观察一版**
   - 完整跑一次 `python3 scripts/sync_daily_log_outputs.py`，再等一个 5 分钟 web 投影周期。
   - 对照：Base 行数、网页 `calendar_entries` 条数、本地 `logs/daily_log.md` 行数，应与改动前完全一致（可复用 `scripts/calendar_parity_report.py` 的对账口径）。
   - 任一数字变化即回滚。

4. **Contract：删掉 sensitivity**
   - SQLite：`DROP VIEW calendar_entries` → `ALTER TABLE events DROP COLUMN sensitivity`、`event_revisions`、`notes`、`note_revisions` → 重建视图（`scripts/event_store.py` 的 `_ensure_*` 路径）。
   - 代码：删 `SENSITIVITY_LEVELS`、`_validate_content` 里的校验、`Event`/`Note` 的 dataclass 字段、`note_cli.py` 的 `--sensitivity`、`calendar_entries.py` 的 `ENTRY_COLUMNS` 列、`note_docs_projection.py:109` / `note_inbound_reconciliation.py:57` 的透传。
   - Web：`npm run db:generate` 出 0001 迁移（Neon `ALTER TABLE calendar_entries DROP COLUMN sensitivity`）+ 改 `web/backend/src/lib/schema.ts:75` + `web/scripts/lib/local-daily-events.mjs` + `project-calendar-entries.mjs`，`npm run db:check` 必须过。
   - 飞书 Base：删「敏感级别」列；`note_inbound_reconciliation.py` 去掉读回与校验，`NOTE_OPERATIONAL_FIELDS`（`scripts/note_base_projection.py:24`）同步去掉。
   - 文档：`note-cli.md:73` 去掉 `--sensitivity`；`.scratch/` 旧 spec 不动（历史），只在 ADR 里记一句 supersede。
   - 测试：14 个文件 53 处断言一起改；`tests/test_daily_log_view.py:118` 与 `tests/test_sqlite_projections.py:305` 这两个「private 被隐藏」的测试应改成「渠道开关关闭才被隐藏」。
   - 只读历史（`exports/`、`migration-artifacts/`）不动。

## 九、三个决策（2026-09-26 已拍板）

1. **飞书文档用独立开关**（`feishu_docs_enabled`），不再跟随 `status='active'`。
   `status` 退回纯生命周期语义，`withdrawn` 仍对所有渠道生效。
2. **Base 的列照 SQLite 的形状做**：不做组合值列，一个渠道一个独立布尔列。
   删「敏感级别」，新增「飞书文档」与「Base 同步」；「日历同步」「博客发布」保留。
3. **flomo 短记三个渠道全开**（`Base=true / 日历=true / 博客=true`），
   推翻上一版「日历与博客都 false」的建议。已在 flomo 方案里记录两个后果：
   515 条带时间的短记会一次性进飞书日历；且博客当时根本没有闸门。

落成：

- 决策记录：`docs/adr/0011-channel-switches-replace-sensitivity.md`
  （supersede `docs/adr/0006:26`、`web/docs/adr/0011:11`、`.scratch/web-multimodule-shell/spec.md:135`）
- 实施方案：`.scratch/channel-switches/spec.md`
- 实施 ticket：`.scratch/channel-switches/issues/01` ~ `08`

## 十、核对过程中新发现的一件事：博客渠道根本没有闸门

写这份文档时我又核了一遍 `publish_enabled` 的消费方，结果是：**在两条博客管道上它都不是闸门。**

- `scripts/publish_private_blog_data.js:204` 全量读 `logs/daily_log.md` 加密后写入 `andywu1998.github.io`
  与 `astro_demo` 两个仓库，没有任何过滤。
- `andywu1998.github.io/scripts/import_personal_assistant_notes.py:76` 用 `rglob("*.md")` 全量导入笔记，
  没有任何过滤。

后果：129 篇笔记里 128 篇 `publish_enabled=0`、298 条事件里 246 条是 0，共 374 条，但它们**全部**在博客上。
所以「给博客接上闸门」这一步如果照字段现值回填，等于一次性静默撤回四百多条内容。
正确的做法是按「当前实际到达了什么」回填为 1，之后的关闭才是真实意图——这条已写成
`01-schema-and-backfill.md` 里的硬约束，并进了 ADR 第 6 条。
