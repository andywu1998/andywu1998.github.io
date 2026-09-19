---
layout: post
title: "cc-connect /note 链路迁移与 lark-cli 修复记录"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-19 09:22:31 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/01_cc-connect_note链路迁移与lark-cli修复记录.md`
# cc-connect /note 链路迁移与 lark-cli 修复记录

记录时间：2026-09-18 21:28 ~ 22:45 (Asia/Shanghai)
记录者：codex（cc-connect QQ Bot 会话 + 远程排查机 `admin@10.71.48.85`）
用途：cc-connect `/note` 链路从「判定失败」到「修复并验证通过」的完整现场记录、复现步骤与迁移动作

---

## 0. 一句话结论

> **2026-09-18 22:45 更新：已修复并验证通过。**
> 根因是远端未安装 `lark-cli`，`feishu_base` / `feishu_calendar` 阶段失败导致 `gitReady=false`、
> 跳过三个仓库的 commit/push。安装 `@larksuite/cli` 并迁移凭证后，21:26 与 22:38 两条 note
> 均已 commit + push 成功（详见第 10 节）。

以下为 21:28 采集时的原始结论：

本机 cc-connect 的 `/note` 功能**已经可用**（21:26:51 实测命中，`logs/daily_log.md` 已写入），
但**流水线没有完成提交**；另外更早的两条 `/note` 因当时进程仍是「上游 npm 版二进制」而被当普通消息吞掉了。

---

## 1. 待修问题（按优先级）

| 优先级 | 问题 | 证据 | 状态（22:45 更新） |
| --- | --- | --- | --- |
| P0 | 远端缺 `lark-cli`，`feishu_*` 同步阶段全部失败 | `FileNotFoundError: 'lark-cli'`；`sync_to_feishu_base.py:66`、`sync_daily_log_to_feishu_calendar.py:286` | **已解决**（装 CLI + 迁凭证，见 10.2） |
| P0 | 21:26:51 的 `/note` 只写入了 `logs/daily_log.md`，未 commit/push | 仓库无新提交，`git status` 仍显示 `M logs/daily_log.md`；sync 状态文件 mtime 停在 19:03 | **已解决**（随 `d9edd0f` 一起推送） |
| P0 | 两条 `/note` 被旧二进制吞掉，内容未入库 | 会话 JSON 中 20:38:06、21:21:45 两条 user 消息原文 | 未解决 |
| P1 | 20:38 / 21:21 两条 note 需要补录（补录会触发 commit + push 3 个仓库） | 见第 6 节原文 | 未执行（输入已备好，待确认） |
| P1 | worker 路径硬编码在源码里 | `cmd/cc-connect/main.go:42` | 未解决 |
| P1 | `npm install -g cc-connect` 会覆盖 fork 构建产物，无自动重建机制 | 运行的是 `~/.local/lib/node_modules/cc-connect/bin/cc-connect` | 未解决 |
| P2 | 重启 daemon 会杀掉进行中的 agent 回合（21:21 那次把我的回合打断了） | daemon.log 21:21:52 `slow agent send elapsed=7.17s` + 会话中断 | 未解决 |
| P2 | `/note` 流水线缺乏可观测性：worker 的 debug log 默认关闭，结果只发到 QQ，不落盘 | worker `main.go:1147`（`PA_SYNC_DEBUG_LOG` 未设置） | 未解决 |

---

## 2. 环境清单

| 项目 | 值 |
| --- | --- |
| 用户 | `admin` |
| cc-connect 源码仓 | `/home/admin/code/cc-connect-work-space/cc-connect` |
| 源码仓 remote | `origin  git@github.com:andywu1998/cc-connect.git`（fork，无 upstream） |
| 源码仓 HEAD | `8be81f7 feat: add deterministic note pipeline and stock monitor`（工作区干净） |
| 上游仓库 | `chenhg5/cc-connect`（当前 main `757b4df`，fork 基线是 `8071316`，落后若干提交） |
| 运行二进制 | `/home/admin/.local/lib/node_modules/cc-connect/bin/cc-connect`（v1.5.1-beta.1，commit 8be81f7，替换于 21:20） |
| 上游二进制备份 | `/home/admin/.local/share/cc-connect-backup/cc-connect-v1.5.0-upstream` |
| systemd 用户服务 | `cc-connect-qqbot.service`（`~/.config/systemd/user/cc-connect-qqbot.service`） |
| 运行配置 | `/home/admin/.cc-connect-qqbot/config.toml`（0700，含 QQ Bot app_id/app_secret） |
| 运行日志 | `/home/admin/.cc-connect-qqbot/daemon.log`（126 行，10MB x3 轮转） |
| 会话数据 | `/home/admin/.cc-connect-qqbot/sessions/my-project-qqbot_e6c19cbd.json` |
| note worker | `/home/admin/code/cc-connect-work-space/codex_personal_assistant/personal_assistant/plugins/personal-assistant-sync/bin/personal-assistant-sync` |
| worker 源码 | 同目录 `cmd/personal-assistant-sync/main.go` |
| 个人助理仓库 | `/home/admin/code/cc-connect-work-space/codex_personal_assistant`（origin `andywu1998/codex_personal_assistant`） |
| blog 仓库 | `/home/admin/code/cc-connect-work-space/andywu1998.github.io`（origin `andywu1998/andywu1998.github.io`，当前分支 master；22:45 复查工作区已干净） |
| astro 仓库 | `/home/admin/code/cc-connect-work-space/astro_demo`（origin `andywu1998/astro_demo`） |
| 构建工具链（本次新装） | Go 1.25.0 → `~/toolchain/go1.25.0`（系统原本无 Go，无 passwordless sudo） |
| 构建加速 | npm `registry.npmmirror.com`，Go `GOPROXY=https://goproxy.cn,direct` |
| lark-cli（22:30 新装） | `~/.local/bin/lark-cli` → `@larksuite/cli@1.0.96`（npm 全局前缀即 `/home/admin/.local`，无需 sudo） |
| lark-cli 凭证 | `~/.lark-cli/config.json` + `~/.local/share/lark-cli/`（`master.key`、`appsecret_*.enc`、用户 token `.enc`），均由 `10.71.48.85` 迁移 |

### 服务单元（当前磁盘版本）

```ini
[Unit]
Description=cc-connect QQ Bot - AI Agent Chat Bridge
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
WorkingDirectory=/home/admin/.cc-connect-qqbot
ExecStart=/home/admin/.local/lib/node_modules/cc-connect/bin/cc-connect --config /home/admin/.cc-connect-qqbot/config.toml
Restart=always
RestartSec=10
Environment=CC_LOG_FILE=/home/admin/.cc-connect-qqbot/daemon.log
Environment=CC_LOG_MAX_SIZE=10485760
Environment=PATH=/home/admin/.local/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
```

注意：`systemctl --user cat cc-connect-qqbot.service` 会提示 “unit changed on disk, the version systemd has loaded is outdated”，
建议先 `systemctl --user daemon-reload`（不影响运行中的进程）。

---

## 3. 当前运行状态（21:28 采集）

```
$ ps -o pid,lstart,etime,cmd -C cc-connect
   PID                  STARTED     ELAPSED CMD
 12580 Fri Sep 18 21:21:52 2026       05:57 /home/admin/.local/lib/node_modules/cc-connect/bin/cc-connect --config /home/admin/.cc-connect-qqbot/config.toml

$ /home/admin/.local/lib/node_modules/cc-connect/bin/cc-connect --version
cc-connect v1.5.1-beta.1
commit:  8be81f7
built:   2026-09-18T13:17:50Z
```

---

## 4. 时间线（含日志证据）

| 时间 | 事件 | 证据 |
| --- | --- | --- |
| 20:11 | npm 全局安装上游 `cc-connect@1.5.0`（release 二进制，构建于 08-16） | `~/.local/lib/node_modules/cc-connect/install.js:16` 固定从 `chenhg5/cc-connect` 下载 |
| 20:15:49 | daemon 以**上游 1.5.0** 启动 | daemon.log 首行 `acquired instance lock` |
| 20:38:06 | QQ 收到 `/note 今天把天安机器迁移到鹏哥家的机器上了` → 旧二进制无 `/note`，转发给 agent | 会话 JSON s3 第 1 条；daemon.log 20:38 段 `session spawned` |
| 21:05:25 | 一次启动失败退出：DNS 不可达（`dial udp 192.168.110.1:53: network is unreachable`） | daemon.log:68-71 |
| 21:05:36 | systemd 重试成功，PID 2577（仍是上游 1.5.0） | daemon.log + `ps` 历史 |
| 21:14:57 | 用户询问 remote 仓库配置 → agent 排查 | 会话 JSON |
| 21:16:39 | 用户同意构建并切换运行版本 | 会话 JSON |
| 21:17-21:20 | 安装 Go 1.25.0；web 前端构建；`make build` 产出 v1.5.1-beta.1/8be81f7；备份并替换 npm 包内二进制；配置副本 `config format` 校验无差异 | `/home/admin/cc-connect-switch-check.log`、`~/.local/share/cc-connect-backup/` |
| 21:21:0x | 用 `systemd-run --user --on-active=45` 安排延迟重启 | `systemctl --user list-timers` 早已回收，日志见 switch-check.log |
| 21:21:45 | QQ 收到 `/note 我今天把个人助理这一套也部署到了鹏哥家的服务器上`（78 字节）→ **仍是旧二进制（重启前 7 秒）** → 被当普通消息转发给 agent | daemon.log 21:21:45 `message received content_len=78`；会话 JSON |
| 21:21:52 | 旧进程 `shutting down...`，新进程启动（v1.5.1-beta.1，PID 12580），21:21:54 `qqbot: gateway READY` | daemon.log 21:21:52-21:21:54 |
| 21:22:03 | `/stop` 中断上一回合 | daemon.log `audit: command_executed command=stop` |
| 21:22:57 | 用户追问 “`/note` 命令没被识别” → agent 回复：新版本已生效，可重发 | 会话 JSON |
| 21:26:51 | QQ 收到 `/note 今天把个人助理服务迁移到了鹏哥家的服务器`（66 字节）→ 新引擎识别为命令 | daemon.log `audit: command_executed command=note` |
| 21:26:52 | worker 写入 `logs/daily_log.md`（`- 21:26 今天把个人助理服务迁移到了鹏哥家的服务器 <!-- source:feishu_note:ROBOT1.0_... -->`） | 文件 mtime 21:26:52 |
| 21:28:14 | 复查：无流水线进程；个人助理仓库 **无新提交**；`git status` 仍为 `M data/daily_log.sqlite3`、`M logs/daily_log.md`；`config/feishu_*` 状态文件 mtime 停在 19:03 → **推断 sync 阶段失败，`gitReady=false` 跳过提交** | 见第 5 节提交条件 |

---

## 5. `/note` 实现链路（代码引用）

```
QQ 消息 "/note xxx"
  └─ core/engine.go:6520   命令表注册 {[]string{"note"}, "note"}
  └─ core/engine.go:6743   case "note" → e.cmdNote(p, msg, raw)
  └─ core/engine.go:6832   cmdNote()
         ├─ 内容为空 → 回复用法
         ├─ 构造 core.NoteRequest（core/interfaces.go:348）
         └─ 异步调用 e.noteExecutor
  └─ cmd/cc-connect/main.go:442 / :1829   engine.SetNoteExecutor(makeNoteExecutor(resolveNoteWorkerPath(proj.NoteWorker)))
         ├─ main.go:2095 resolveNoteWorkerPath：配置项 `note_worker` 为空则回落到
         └─ main.go:42   const defaultNoteWorkerPath = "/home/admin/code/cc-connect-work-space/codex_personal_assistant/personal_assistant/plugins/personal-assistant-sync/bin/personal-assistant-sync"
         └─ main.go:2102 makeNoteExecutor：exec.CommandContext(worker, "note")，stdin 传 JSON，stdout 收 core.NoteResult
  └─ worker main.go:143/195 runNoteCLI()
         ├─ 读 stdin 的 noteRequest JSON
         └─ runCaptureAndSync({ title: 首行截断 60 字, detail: 原文, source: "feishu_note",
                                event_type: "note", time: received_at,
                                calendar_enabled: true, publish_enabled: true,
                                push_repos: true,   ← 写死，每条 note 都会 push
                                timeout_seconds: 900 })
```

### worker 流水线阶段与提交条件（`plugins/personal-assistant-sync/cmd/personal-assistant-sync/main.go:400-465`）

1. 写入 `codex_personal_assistant/logs/daily_log.md`（+ 可选 `inbox/capture.md`）
2. 并行同步：`feishu_base`（python3 `scripts/sync_to_feishu_base.py`）、
   `feishu_calendar`（python3 `scripts/sync_daily_log_to_feishu_calendar.py`）、
   `blog_sync`（python3 `andywu1998.github.io/scripts/import_personal_assistant_notes.py`）
3. **只有上面 3 个 sync 全部成功才 `gitReady=true`**，才会依次 commit / push：
   - 个人助理仓库：`logs/daily_log.md`、`inbox/capture.md`、`config/feishu_base_sync_state.json`、`config/feishu_calendar_sync.json`、`config/feishu_base.json`
   - blog 仓库：`_posts`、`private.html`、`assets/css/private-assistant.css`、`assets/js/private-assistant.js`、`assets/private`
   - astro 仓库：`public/assets/private/personal-assistant.encrypted.json`
4. 任一步失败 → `FailureSummary` 记录、`git` 阶段标记 `跳过 (sync step failed)`，**不提交**，QQ 回复 `⚠️ /note 部分失败`

> 21:26:51 那次正是走到了第 1 步成功、第 2/3 步失败（或未完成）的状态，因此没有提交。

---

## 6. 现场证据原文

### 6.1 被吞掉的两条 note（会话 `sessions/my-project-qqbot_e6c19cbd.json`）

```
2026-09-18T20:38:06.604+08:00  user  /note 今天把天安机器迁移到鹏哥家的机器上了
2026-09-18T21:21:45.590+08:00  user  /note 我今天把个人助理这一套也部署到了鹏哥家的服务器上
```

时间线里对应：两条都发生在运行二进制为上游 1.5.0 期间，故未命中命令分支（旧二进制里根本没有 `note` 命令）。

### 6.2 daemon.log 关键片段

```
time=2026-09-18T21:21:45.357+08:00 level=INFO msg="message received" platform=qqbot ... content_len=78 ...
time=2026-09-18T21:21:45.590+08:00 level=INFO msg="processing message" platform=qqbot ... session=s3
time=2026-09-18T21:21:52.778+08:00 level=INFO msg="shutting down..."
time=2026-09-18T21:21:52.781+08:00 level=WARN msg="slow agent send" elapsed=7.17511207s ... content_len=78
time=2026-09-18T21:21:52.817+08:00 level=INFO msg="acquired instance lock" path=/home/admin/.cc-connect-qqbot/.config.toml.lock
time=2026-09-18T21:21:52.818+08:00 level=INFO msg="config loaded" path=/home/admin/.cc-connect-qqbot/config.toml
time=2026-09-18T21:21:52.818+08:00 level=INFO msg="session: loaded from disk" path=/home/admin/.cc-connect-qqbot/sessions/my-project-qqbot_e6c19cbd.json sessions=3
time=2026-09-18T21:21:54.683+08:00 level=INFO msg="qqbot: gateway READY" session_id=7790ef94-a6b6-4289-bda2-40b93e4c5a45
time=2026-09-18T21:21:54.684+08:00 level=INFO msg="api server started" socket=/home/admin/.cc-connect-qqbot/run/api.sock
time=2026-09-18T21:21:54.684+08:00 level=INFO msg="cc-connect is running" projects=1
time=2026-09-18T21:22:03.226+08:00 level=INFO msg="audit: command_executed" ... command=stop
time=2026-09-18T21:26:51.595+08:00 level=INFO msg="message received" platform=qqbot ... content_len=66 ...
time=2026-09-18T21:26:51.596+08:00 level=INFO msg="audit: command_executed" ... command=note
```

### 6.3 个人助理仓库状态（21:28）

```
$ git -C .../codex_personal_assistant log --oneline -1
3cf01a3 2026-09-18 20:29:58 +0800 docs: 把环境备份方案并入个人助理笔记
$ git -C .../codex_personal_assistant status -sb
## main...origin/main
 M data/daily_log.sqlite3
 M logs/daily_log.md

$ tail -1 logs/daily_log.md
- 21:26 今天把个人助理服务迁移到了鹏哥家的服务器 <!-- source:feishu_note:ROBOT1.0_uts4-... -->
```

其他仓库当前也有脏改动（可能是历史遗留）：
- `andywu1998.github.io`：`master` 下有 `_posts/2026-08-30-*.md` 处于已删除未提交状态
- `astro_demo`：`public/assets/private/personal-assistant.encrypted.json` 已修改

---

## 7. 复现 / 验证步骤（远程机器可直接用）

```bash
# 1) 看服务与版本
systemctl --user status cc-connect-qqbot.service
ps -o pid,lstart,etime,cmd -C cc-connect
/home/admin/.local/lib/node_modules/cc-connect/bin/cc-connect --version   # 期望 v1.5.1-beta.1 / commit 8be81f7

# 2) 看日志（含命令审计）
tail -f ~/.cc-connect-qqbot/daemon.log
#   期望在发 /note 后出现：audit: command_executed ... command=note

# 3) 手动跑一次 worker（等价于引擎的调用，注意会产生真实 commit/push）
cd ~/code/cc-connect-work-space/codex_personal_assistant/personal_assistant/plugins/personal-assistant-sync
printf '%s' '{"message_id":"manual-test","session_key":"manual","platform":"qqbot","user_id":"manual","user_name":"manual","chat_name":"manual","content":"手动链路测试","received_at":"2026-09-18T21:30:00+08:00"}' \
  | PA_SYNC_DEBUG_LOG=/tmp/pa-sync-debug.log ./bin/personal-assistant-sync note | tee /tmp/pa-note-result.json

# 4) 看阶段结果（哪个 sync 失败会在 stages/failure_summary 里）
python3 -m json.tool /tmp/pa-note-result.json | head -40
tail -50 /tmp/pa-sync-debug.log
```

### 建议的修复动作

1. **拿到失败阶段细节**：在 unit 里加 `Environment=PA_SYNC_DEBUG_LOG=/home/admin/.cc-connect-qqbot/pa-sync-debug.log`，
   再 `systemctl --user daemon-reload && systemctl --user restart cc-connect-qqbot.service`，然后重发 `/note`。
   （worker 的 debug 开关：`plugins/personal-assistant-sync/cmd/personal-assistant-sync/main.go:1147`，读环境变量 `PA_SYNC_DEBUG_LOG`；引擎侧目前不会记录 note 结果，只回 QQ。）
   注意：重启会掐断当前正在进行的 agent 回合。
2. **补录两条被吞的 note**（可选，会 commit + push 3 个仓库）：
   用第 7 节第 3 步的方式，把 `content` 换成 6.1 的原文，`received_at` 用当时时间。
3. **修硬编码路径**：改用配置项 `note_worker`（`config.toml` 里当前没有该项，故落到 `cmd/cc-connect/main.go:42` 的硬编码绝对路径）；
   换机器/换目录就会失效，建议把它做成配置项默认值或相对工作区路径。
4. **防止 npm 覆盖**：把构建产物放到稳定路径（如 `~/.local/share/cc-connect-fork/bin/cc-connect`），
   让 unit 的 `ExecStart` 指向它，而不是 `node_modules` 内部；或在 `npm -g` 升级后跑一次重建脚本。
   重建命令：
   ```bash
   cd ~/code/cc-connect-work-space/cc-connect
   export PATH="$HOME/toolchain/go1.25.0/bin:$PATH"
   make build     # 需要 web/node_modules（npm install --registry=https://registry.npmmirror.com）
   install -m755 cc-connect ~/.local/lib/node_modules/cc-connect/bin/cc-connect
   systemctl --user restart cc-connect-qqbot.service
   ```
5. **升级 fork 基线**：`git remote add upstream https://github.com/chenhg5/cc-connect.git && git fetch upstream && git rebase upstream/main`（fork 落后上游若干提交）。

---

## 8. 回滚方案

```bash
install -m755 ~/.local/share/cc-connect-backup/cc-connect-v1.5.0-upstream \
  ~/.local/lib/node_modules/cc-connect/bin/cc-connect
systemctl --user restart cc-connect-qqbot.service
```
（回滚后 `/note` 会再次失效，因为它回到上游 1.5.0。）

---

## 9. 其他注意事项

- 21:05:25 出现过一次 DNS/网络不可达导致引擎启动失败退出；网络抖动会让 note 的 `feishu_*` / `blog_sync` 阶段失败并整体不提交。
- `config.toml` 含 QQ Bot `app_secret`（0600 权限），交接/传输时注意脱敏。
- 会话文件 `sessions/my-project-qqbot_e6c19cbd.json` 里保存着用户消息原文，可用于核对被吞掉的 note 内容。
- 本机没有 passwordless sudo，安装工具链都放在 `~` 下。

---

## 10. 修复记录（2026-09-18 22:45，由 `admin@10.71.48.85` 执行）

### 10.1 根因

远端（`10.71.48.31`，主机名 `admin-PC`）**没有安装 `lark-cli`**。
个人助理仓库里所有飞书投影脚本都以 `subprocess.run(["lark-cli", ...])` 走 PATH 调用：

- `scripts/sync_to_feishu_base.py`（`LarkBaseClient.run`，第 66 行）
- `scripts/sync_daily_log_to_feishu_calendar.py`（`run_lark_cli`，第 286 行）
- `scripts/note_remote_adapters.py`、`import_feishu_daily_log.py`、`export_feishu_daily_log_csv.py` 同样依赖

缺二进制时直接抛 `FileNotFoundError: [Errno 2] No such file or directory: 'lark-cli'`（22:33 已复现）。
于是 `feishu_base`、`feishu_calendar` 两个阶段失败，worker
`cmd/personal-assistant-sync/main.go:426-432` 据此置 `gitReady=false`，
跳过 `personal_git` / `blog_git` / `astro_git` 三个提交动作 —— 与第 5 节推断完全一致。

### 10.2 修复动作

1. 安装 CLI（远端 npm 全局前缀就是 `/home/admin/.local`，无需 sudo）：
   ```bash
   npm install -g @larksuite/cli --registry=https://registry.npmmirror.com
   ```
   结果：`@larksuite/cli@1.0.96`，`~/.local/bin/lark-cli`（`lark-cli --version` 已核对）。
2. 从 `admin@10.71.48.85` 迁移凭证（Linux 上 lark-cli 的 keychain 层即本地文件）：
   - `~/.lark-cli/config.json`
   - `~/.local/share/lark-cli/master.key`
   - `~/.local/share/lark-cli/appsecret_<app_id>.enc`
   - `~/.local/share/lark-cli/appsecret_<company_app_id>.enc`
   - `~/.local/share/lark-cli/<app_id>_<open_id>.enc`

   目录 `0700`、文件 `0600`；迁移后已清理中转载具目录。
3. **无需重启服务**：unit 的 `PATH` 已包含 `/home/admin/.local/bin`，
   worker 子进程能直接解析到 `lark-cli`，因此没有触发服务重启（也不会掐断 agent 回合）。

### 10.3 验证

远端 `lark-cli whoami`：

```json
{ "identity": "user", "tokenStatus": "ready",
  "onBehalfOf": { "userName": "吴礼尉",
                  "openId": "<open_id>" } }
```

三个 sync 阶段 dry-run（无副作用）全部 exit 0：

| 阶段 | 命令 | 结果 |
| --- | --- | --- |
| feishu_base | `python3 scripts/sync_to_feishu_base.py --dry-run` | exit 0 |
| feishu_calendar | `python3 scripts/sync_daily_log_to_feishu_calendar.py --dry-run` | exit 0（synced=1 failed=0 skipped=281） |
| blog_sync | `node scripts/publish_private_blog_data.js --dry-run && python3 .../import_personal_assistant_notes.py --clean --dry-run` | exit 0 |

> 注意：必须在带 `PATH=/home/admin/.local/bin:...` 的环境下复现（`ssh` 非登录 shell 默认不含该路径）。
> systemd 服务本身已配置好该 PATH，无需额外处理。

### 10.4 端到端结果

22:38:08 手动触发的 `/note 把个人助理迁移到鹏哥家服务器的虚拟机` 已完整跑完（耗时约 1.3 分钟），
21:26 那条此前滞留的 note 一并被提交：

| 仓库 | commit | 推送状态 |
| --- | --- | --- |
| codex_personal_assistant | `d9edd0f 2026-09-18 note sync`（`logs/daily_log.md` 含 21:26 + 22:38 两条） | 已推送（`ls-remote` == 本地 HEAD） |
| andywu1998.github.io | `b0e1ece 2026-09-18 note sync` | 已推送 |
| astro_demo | `5144387 2026-09-18 note sync` | 已推送 |

`logs/daily_log.md` 新增两条：

```
- 21:26 今天把个人助理服务迁移到了鹏哥家的服务器
- 22:38 把个人助理迁移到鹏哥家服务器的虚拟机
```

blog 仓库此前 `_posts/2026-08-30-*.md` 的“已删除未提交”状态，
在 `import_personal_assistant_notes.py --clean` 重新生成后变为少量内容修改并被一并提交，
**未丢数据**，工作区复查已干净。

### 10.5 遗留 / 未解决

- **两条被吞的 note 仍未补录**（20:38、21:21，原文见 6.1）。输入 JSON 已备好，但未执行
  （每条会触发一次真实 commit + push）。
- **凭证共用风险**：远端与本机 `10.71.48.85` 现共用同一份 OAuth 凭证，而本机有 cron 每 2 小时刷新一次 token；
  飞书 refresh token 是轮换的，两台机器同时刷新可能互相顶掉。若服务整体迁到远端，
  建议停掉本机刷新任务，或在远端用 `lark-cli auth login` 单独走一次设备码授权。
- **观感问题**：`/note` 单次约 1.3 分钟且中途无任何反馈，容易被误判成“卡住”。
  引擎不记录 note 结果、只回 QQ，是当前盲区；要改善需给 unit 加
  `Environment=PA_SYNC_DEBUG_LOG=/home/admin/.cc-connect-qqbot/pa-sync-debug.log` 并重启服务
  （重启会掐断进行中的 agent 回合）。
- 第 1 节其余 P1/P2 项（硬编码 worker 路径、npm 覆盖 fork 产物、重启杀回合）均未处理。
