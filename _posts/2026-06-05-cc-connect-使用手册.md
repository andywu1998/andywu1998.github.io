---
layout: post
title: "cc-connect 使用手册"
subtitle: "Codex 个人助理沉淀"
date: 2026-06-05 12:14:15 +0800
tags:
  - "个人助理"
  - "项目"
  - "cc-connect"
---

> 来源：`notes/projects/cc-connect/01_cc_connect_使用手册.md`
# cc-connect 使用手册

## 1. 这个项目是什么

`cc-connect` 是一个把本地 AI Agent 接到即时通讯工具里的桥接服务。

它的核心作用是：

- 你在飞书、钉钉、Telegram、Slack、Discord、企业微信、微信、QQ 等聊天工具里发消息。
- `cc-connect` 收到消息后，把内容转给本机运行的 AI Agent，例如 Claude Code、Codex、Cursor Agent、Gemini CLI、Qoder CLI、OpenCode、iFlow CLI。
- Agent 在本地项目目录执行任务，结果再由 `cc-connect` 发回聊天窗口。

一句话：它让你可以用手机里的聊天软件远程操作本机代码助手。

## 2. 项目位置和本机状态

本机源码目录：

```bash
/home/admin/code/cc-connect
```

当前目录里已经有编译好的二进制：

```bash
/home/admin/code/cc-connect/cc-connect
```

这个仓库当前有未提交的本地改动，我这次只阅读和整理文档，没有修改 `cc-connect` 项目本身。

## 3. 基本执行链路

```text
聊天平台用户消息
  -> 平台连接器（feishu / telegram / qq / weixin 等）
  -> cc-connect Engine
  -> 对应 project 的 Agent
  -> Agent 在 work_dir 中执行
  -> cc-connect 把结果发回聊天平台
```

关键配置在 `config.toml`：

```toml
[[projects]]
name = "my-project"

[projects.agent]
type = "codex" # 或 claudecode / cursor / gemini / qoder / opencode / iflow

[projects.agent.options]
work_dir = "/absolute/path/to/project"
mode = "default"

[[projects.platforms]]
type = "feishu"

[projects.platforms.options]
app_id = "cli_xxx"
app_secret = "xxx"
```

一个 `cc-connect` 进程可以同时管理多个 `[[projects]]`。每个 project 可以绑定自己的 Agent、工作目录和一个或多个聊天平台。

## 4. 安装方式

### 4.1 npm 安装

稳定版：

```bash
npm install -g cc-connect
```

Beta 版：

```bash
npm install -g cc-connect@beta
```

如果需要个人微信 `weixin ilink` 能力，当前文档说明应使用 beta / pre-release 版本。

### 4.2 GitHub Release 二进制

Linux 示例：

```bash
curl -L -o cc-connect https://github.com/chenhg5/cc-connect/releases/latest/download/cc-connect-linux-amd64
chmod +x cc-connect
sudo mv cc-connect /usr/local/bin/
```

### 4.3 源码编译

```bash
git clone https://github.com/chenhg5/cc-connect.git
cd cc-connect
make build
```

本机源码目录已经存在，可直接在 `/home/admin/code/cc-connect` 下构建或运行已有二进制。

## 5. 配置文件位置

`cc-connect` 查找配置文件的顺序：

1. 命令行 `-config <path>` 指定的配置。
2. 当前目录下的 `./config.toml`。
3. 全局配置 `~/.cc-connect/config.toml`。

推荐使用全局配置：

```bash
mkdir -p ~/.cc-connect
cp /home/admin/code/cc-connect/config.example.toml ~/.cc-connect/config.toml
vim ~/.cc-connect/config.toml
```

如果没有配置文件，直接运行 `cc-connect` 会自动创建 starter config 到 `~/.cc-connect/config.toml`。

## 6. 最小可用配置

以 Codex + 飞书为例：

```toml
[log]
level = "info"

[[projects]]
name = "personal-assistant"
admin_from = "你的飞书用户ID"

[projects.agent]
type = "codex"

[projects.agent.options]
work_dir = "/home/admin/code/cc-connect-work-space/codex_personal_assistant"
mode = "yolo"

[[projects.platforms]]
type = "feishu"

[projects.platforms.options]
app_id = "cli_xxxxxxxxxxxx"
app_secret = "xxxxxxxxxxxxxxxx"
allow_from = "*"
```

注意：

- `work_dir` 必须是绝对路径。
- `admin_from` 用于限制 `/dir`、`/shell` 等高权限命令。
- `mode` 决定 Agent 权限策略。Codex 支持 `suggest`、`auto-edit`、`full-auto`、`yolo`。
- 如果希望执行命令时不频繁请求审批，通常要把 Agent 模式设成更自动化的模式，例如 Codex 的 `yolo` 或 Claude Code 的 `bypassPermissions`。

## 7. 飞书接入

推荐使用内置 CLI：

```bash
cc-connect feishu setup --project my-project
```

如果已经有 App ID 和 App Secret：

```bash
cc-connect feishu setup --project my-project --app cli_xxx:sec_xxx
```

也可以显式使用：

```bash
cc-connect feishu new --project my-project
cc-connect feishu bind --project my-project --app cli_xxx:sec_xxx
```

飞书开放平台手动配置时需要：

- 创建企业自建应用。
- 启用机器人能力。
- 获取 `App ID` 和 `App Secret`。
- 开启 WebSocket 长连接事件订阅。
- 订阅 `im.message.receive_v1`。
- 添加并发布消息相关权限，例如接收消息、读取消息、以机器人身份发消息。

飞书平台配置示例：

```toml
[[projects.platforms]]
type = "feishu"

[projects.platforms.options]
app_id = "cli_axxxxxxxxxxxx"
app_secret = "QhkMpxxxxxxxxxxxxxxxxxxxx"
# enable_feishu_card = true
# thread_isolation = true
# progress_style = "compact" # legacy | compact | card
```

## 8. QQ 接入

`cc-connect` 的 QQ 平台通过 OneBot v11 协议接入，常见搭配是 NapCat。

架构：

```text
QQ Client -> NapCat OneBot v11 -> WebSocket -> cc-connect -> Agent
```

Docker 启动 NapCat 示例：

```bash
docker run -d \
  --name napcat \
  -e ACCOUNT=<你的QQ号> \
  -p 3001:3001 \
  -p 6099:6099 \
  mlikiowa/napcat-docker:latest
```

首次启动看日志扫码：

```bash
docker logs -f napcat
```

NapCat WebUI：

```text
http://localhost:6099
```

启用正向 WebSocket，端口通常是 `3001`。

`cc-connect` 配置：

```toml
[[projects.platforms]]
type = "qq"

[projects.platforms.options]
ws_url = "ws://127.0.0.1:3001"
token = ""
allow_from = "*"
```

启动后看到类似日志表示正常：

```text
qq: connected to OneBot url=ws://127.0.0.1:3001
qq: logged in qq=123456789 nickname=MyBot
```

## 9. 启动服务

前台启动：

```bash
cc-connect
```

指定配置：

```bash
cc-connect -config ~/.cc-connect/config.toml
```

源码目录中运行已有二进制：

```bash
cd /home/admin/code/cc-connect
./cc-connect -config ~/.cc-connect/config.toml
```

启动成功后会看到：

```text
config loaded
platform started
cc-connect is running
```

## 10. 守护进程模式

安装为后台服务：

```bash
cc-connect daemon install --config ~/.cc-connect/config.toml
```

常用命令：

```bash
cc-connect daemon status
cc-connect daemon logs -f
cc-connect daemon restart
cc-connect daemon stop
cc-connect daemon start
cc-connect daemon uninstall
```

安装守护进程时，代码会检查配置文件所在目录是否存在 `config.toml`。如果传入 `--config ~/.cc-connect/config.toml`，它会把 `~/.cc-connect` 作为服务工作目录。

## 11. 聊天内常用命令

会话管理：

```text
/new [名称]       创建新会话
/list             列出会话
/switch <id>      切换会话
/current          查看当前会话
/history [n]      查看最近 n 条消息
/stop             停止当前执行
/help             查看命令
```

工作目录：

```text
/dir                    查看当前目录和历史
/dir <路径>             切换工作目录
/dir <序号>             按历史序号切换
/dir -                  返回上一个目录
/cd <路径>              /dir 的别名
```

权限和模型：

```text
/mode                   查看当前权限模式
/mode yolo              切换到自动批准模式
/mode default           切回默认模式
/reasoning [等级]       Codex 推理强度
/model                  查看模型
/model switch <alias>   切换模型
/provider               查看 Provider
/provider switch <名称> 切换 Provider
```

飞书/附件/定时任务相关：

```text
/quiet                  开关思考和工具进度消息
/cron                   列出定时任务
/cron add ...           创建定时任务
/cron del <id>          删除任务
/bind setup             写入 Agent 附件回传和绑定说明
/web setup              启用 Web 管理后台和 Bridge
```

## 12. 定时任务 Cron

聊天里创建：

```text
/cron add 0 6 * * * 帮我收集 GitHub trending 并总结
```

CLI 创建：

```bash
cc-connect cron add \
  --cron "0 6 * * *" \
  --prompt "总结 GitHub trending" \
  --desc "每日趋势"
```

执行 shell 命令型任务：

```bash
cc-connect cron add \
  --cron "*/10 * * * *" \
  --exec "bash /path/to/script.sh" \
  --desc "每10分钟执行脚本"
```

查看和删除：

```bash
cc-connect cron list
cc-connect cron del <job-id>
```

可选参数：

```bash
--session-mode new_per_run
--timeout-mins 30
--data-dir ~/.cc-connect
```

说明：

- `session_mode = reuse` 表示复用当前会话。
- `new_per_run` 表示每次触发创建新 Agent 会话。
- `timeout_mins` 控制单次任务最长执行时间。

## 13. 文件和图片回传

当 Agent 在本机生成了图片、PDF、日志、Markdown 等文件，可以通过 `cc-connect send` 发回当前聊天。

发送文本：

```bash
cc-connect send --message "任务完成"
```

发送图片：

```bash
cc-connect send --image /absolute/path/to/chart.png
```

发送文件：

```bash
cc-connect send --file /absolute/path/to/report.pdf
```

同时发送说明和附件：

```bash
cc-connect send \
  --message "这是生成的报告" \
  --file /absolute/path/to/report.md \
  --image /absolute/path/to/chart.png
```

注意：

- 建议使用绝对路径。
- 附件大小限制约 50 MB。
- 当前文档显示附件回传支持飞书和 Telegram。
- 如果配置 `attachment_send = "off"`，附件回传会被禁用。

## 14. 多机器人中继

在群聊里可以绑定多个项目机器人：

```text
/bind              查看绑定
/bind claudecode   添加 claudecode 项目
/bind gemini       添加 gemini 项目
/bind -claudecode  移除 claudecode
```

CLI 让一个机器人询问另一个机器人：

```bash
cc-connect relay send --to gemini "你觉得这个架构怎么样？"
```

指定来源和会话：

```bash
cc-connect relay send \
  --from codex \
  --to gemini \
  --session-key '<session-key>' \
  --message '请给这个方案做反方审查'
```

## 15. 会话文件查看

`cc-connect sessions` 可以查看本地保存的会话。

```bash
cc-connect sessions list
cc-connect sessions show <session-id> -n 20
```

默认数据目录是：

```bash
~/.cc-connect/sessions
```

也可以指定：

```bash
cc-connect sessions --data-dir /path/to/data list
```

## 16. Provider 和模型配置

Provider 用于在运行时切换 API Key、base_url、模型。

配置示例：

```toml
[projects.agent.options]
provider = "openai"

[[projects.agent.providers]]
name = "openai"
api_key = "sk-xxx"
base_url = "https://api.openai.com/v1"
model = "gpt-5.3-codex"

[[projects.agent.providers.models]]
model = "gpt-5.3-codex"
alias = "codex"

[[projects.agent.providers.models]]
model = "gpt-5.4"
alias = "gpt"
```

CLI 管理：

```bash
cc-connect provider add --project my-project --name relay --api-key sk-xxx --base-url https://api.example.com
cc-connect provider list --project my-project
cc-connect provider remove --project my-project --name relay
cc-connect provider import --project my-project
```

聊天内切换：

```text
/provider list
/provider switch openai
/model
/model switch codex
```

## 17. Web 管理后台和 Bridge

聊天里启用：

```text
/web setup
```

它会写入：

```toml
[management]
enabled = true
port = 9820
token = "your-secret-token"

[bridge]
enabled = true
port = 9810
token = "your-bridge-secret"
path = "/bridge/ws"
```

启用后需要重启 `cc-connect`。

默认端口：

| 功能 | 端口 | 配置块 |
|---|---:|---|
| Web 管理后台 / Management API | 9820 | `[management]` |
| Bridge WebSocket / REST | 9810 | `[bridge]` |

## 18. 常见排障

### 18.1 启动后没有收到消息

检查：

- 平台凭证是否正确。
- 飞书应用是否发布。
- 飞书事件订阅是否是 WebSocket 长连接。
- `allow_from` 是否限制了用户 ID。
- `cc-connect daemon logs -f` 或前台日志是否有平台启动错误。

### 18.2 Agent 没有在预期目录执行

检查：

```text
/dir
```

必要时执行：

```text
/dir /absolute/path/to/project
/dir reset
```

配置里的默认目录是：

```toml
[projects.agent.options]
work_dir = "/absolute/path/to/project"
```

### 18.3 命令总是请求审批

检查当前模式：

```text
/mode
```

切换更自动化的模式：

```text
/mode yolo
```

或者在配置里设置：

```toml
[projects.agent.options]
mode = "yolo"
```

不同 Agent 的模式名称不完全一样：

| Agent | 自动模式示例 |
|---|---|
| Claude Code | `bypassPermissions` / `yolo` |
| Codex | `full-auto` / `yolo` |
| Cursor Agent | `force` / `yolo` |
| Gemini CLI | `yolo` |
| Qoder / OpenCode / iFlow | `yolo` |

### 18.4 定时任务不执行

检查：

```bash
cc-connect cron list
cc-connect daemon status
cc-connect daemon logs -f
```

注意：`cc-connect cron add` 需要正在运行的 `cc-connect`，因为 CLI 通过本地 Unix socket 写入任务。

### 18.5 文件发不回聊天

检查：

- 是否存在活跃聊天会话。
- 文件路径是否为绝对路径。
- 文件是否超过大小限制。
- 配置中是否有 `attachment_send = "off"`。
- 当前平台是否支持附件回传。

## 19. 我在本机看到的关键文件

```text
/home/admin/code/cc-connect/README.zh-CN.md
/home/admin/code/cc-connect/INSTALL.md
/home/admin/code/cc-connect/docs/usage.zh-CN.md
/home/admin/code/cc-connect/docs/feishu.md
/home/admin/code/cc-connect/docs/qq.md
/home/admin/code/cc-connect/config.example.toml
/home/admin/code/cc-connect/cmd/cc-connect/main.go
/home/admin/code/cc-connect/cmd/cc-connect/cron.go
/home/admin/code/cc-connect/cmd/cc-connect/send.go
/home/admin/code/cc-connect/cmd/cc-connect/relay.go
/home/admin/code/cc-connect/cmd/cc-connect/daemon.go
```

## 20. 推荐日常使用方式

如果把它作为个人远程助理入口，建议：

1. 用 `~/.cc-connect/config.toml` 管理所有项目。
2. 每个常用工作目录建一个 `[[projects]]`。
3. Agent 默认模式根据风险选择：日常个人仓库可用 `yolo`，生产高风险仓库用 `default` 或 `auto-edit`。
4. 飞书作为主入口，QQ/微信等作为备用入口。
5. 长任务用 `/cron` 或 `cc-connect cron add`，并设置 `--timeout-mins`。
6. 需要交付文件时，让 Agent 使用 `cc-connect send --file` 或 `--image`。
7. 服务用 `cc-connect daemon install --config ~/.cc-connect/config.toml` 常驻。
