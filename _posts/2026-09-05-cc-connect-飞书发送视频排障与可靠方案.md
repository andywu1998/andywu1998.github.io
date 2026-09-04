---
layout: post
title: "cc-connect 飞书发送视频排障与可靠方案"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-05 00:37:47 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/cc-connect_飞书发送视频排障与可靠方案.md`
# cc-connect 飞书发送视频排障与可靠方案

---
note_id: note_cc_connect_feishu_video_delivery_20260905
content_type: project
---

# cc-connect 飞书发送视频排障与可靠方案

## 问题

通过 `cc-connect send --file` 或 `cc-connect send --video` 向当前飞书会话发送本地视频时，命令行返回成功，但飞书客户端没有收到可见的视频或附件。

## 环境核对

本机同时运行了多个 `cc-connect` 服务：

- 主飞书机器人：项目名为 `my-project`，使用默认数据目录和 API socket。
- 飞书 2 号机器人：项目名为 `飞书2号`，使用独立数据目录和 API socket。
- QQ Bot：使用另一套独立配置。

因此，发送文件时必须同时明确数据目录、项目名和会话，不能只依赖默认路由。

## 排障过程

1. 使用错误的会话字符串时，CLI 返回 `no active session found`。
2. 修正会话后，使用 `--file` 发送 MP4，飞书返回错误：文件上传类型与消息类型不匹配。
3. 改用 `--video` 后，CLI 返回 `Message sent successfully`，但客户端仍未显示。
4. 将主飞书配置设置为 `reply_to_trigger = false`，让媒体消息改走聊天新消息接口，问题仍未稳定解决。
5. 绕过 `cc-connect`，直接调用主飞书机器人的官方 API：
   - 获取 tenant access token。
   - 上传 MP4，文件类型使用 `mp4`。
   - 以 `media` 消息发送到当前聊天。
   - 另外将同一视频按 `stream` 类型重新上传，并以 `file` 消息发送，作为可下载附件兜底。

官方 API 返回 `code=0`，并返回了消息 ID，最终在飞书客户端成功收到文件。

## 根因

问题不是视频文件损坏，也不是简单的多机器人路由错误，而是两类问题叠加：

- 多个机器人服务使用不同的数据目录和 socket，默认 CLI 只连接默认服务，容易误判发送目标。
- 飞书对文件上传类型和消息类型有严格匹配要求。MP4 应使用 `media` 消息；如果希望以普通附件下载，应先按 `stream` 类型上传，再使用 `file` 消息。
- `cc-connect` 的附件发送路径会根据当前回复上下文选择回复接口。该接口对媒体消息的兼容性不如直接创建聊天新消息，命令成功不等于客户端一定能渲染。

## 可靠发送方案

优先确认目标服务：

```bash
cc-connect sessions list \
  --data-dir /home/admin/.cc-connect \
  --project my-project
```

使用 `cc-connect` 发送视频时，显式指定目标：

```bash
cc-connect send \
  --data-dir /home/admin/.cc-connect \
  --project my-project \
  --session '<feishu-session-key>' \
  --video '/absolute/path/to/video.mp4'
```

如果 CLI 返回成功但客户端没有显示，应改用飞书官方 API，直接向 `chat_id` 创建新消息。对 MP4，可靠做法是同时发送：

- `msg_type=media`，用于直接播放。
- `msg_type=file`，对应 `file_type=stream` 上传，用于下载兜底。

## 经验规则

- 多机器人环境必须为每个服务使用独立的 `data_dir`、API socket 和项目名。
- 不要把 App Secret、tenant access token、用户 ID 或聊天 ID 写入公开文档。
- 发送二进制附件后，应检查官方 API 的 `code` 和返回的 `message_id`，不要只依赖 CLI 的本地成功提示。
- 视频优先使用 `--video`，普通文件使用 `--file`；如果平台渲染异常，使用官方 API 的 `media + stream/file` 双通道方案。
