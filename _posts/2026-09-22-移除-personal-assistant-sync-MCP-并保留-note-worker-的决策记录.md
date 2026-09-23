---
layout: post
title: "移除 personal-assistant-sync MCP 并保留 note worker 的决策记录"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-22 18:24:32 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/移除_personal-assistant-sync_MCP_并保留_note_worker_的决策记录.md`
# 移除 personal-assistant-sync MCP 并保留 note worker 的决策记录

记录时间：2026-09-22
触发：用户要求移除 personal-assistant-sync MCP，理由是 cc-connect 的 `/note` 已经取代它。

## 一句话结论

MCP 注册层已经彻底移除，但 `plugins/personal-assistant-sync/` 目录**必须保留**——因为 `/note` 调用的就是同一个二进制。

## 关键发现：`/note` 与 MCP 共用同一个二进制

用户的判断是「`/note` 是 MCP 的替代实现」，实际上两者是同一个 Go 二进制的两种入口：

- cc-connect 源码 `cmd/cc-connect/main.go:42` 硬编码了 `defaultNoteWorkerPath`，指向 `personal_assistant/plugins/personal-assistant-sync/bin/personal-assistant-sync`
- `main()` 按第一个参数分流：`os.Args[1] == "note"` 走 `runNoteCLI()`，否则走 JSON-RPC `serve()` 循环（即 MCP）
- 运行中的 cc-connect 配置没有覆盖 `note_worker`，走的就是这个默认路径

所以「删掉整个 plugin 目录」会直接打断 `/note`。这是本轮唯一一个与预期不符、且必须先纠正再动手的点。

## 执行内容

移除 MCP：

- `~/.codex/config.toml` 摘掉 `mcp_servers` / `plugins` / `marketplaces` 三段与 plugin 目录信任项（63 → 47 行，改动前已备份）
- 删除 `.mcp.json`、`.codex-plugin/`、repo-local `marketplace.json`
- 删除 `register_as_mcp_server.sh`、`install_plugin.sh`、`update_plugin_cachebuster.py`
- 删除 MCP 安装排障文档 `docs/personal-assistant-sync-install-and-debug.md`
- 删除最后一个 MCP 客户端 `scripts/import_feishu_daily_log_via_mcp.py`（它没有任何引用；每分钟跑的 systemd timer 用的是非 MCP 版 `import_feishu_daily_log.py`）
- 删除只为 MCP 启动服务的 `plugins/personal-assistant-sync/scripts/run.sh`

保留：

- `plugins/personal-assistant-sync/` 整个目录，含预编译二进制
- Go 里的 JSON-RPC transport：删它需要重建二进制，而该二进制是 `/note` 的依赖，不在本轮冒险

skill 与文档：

- skill 的 `references/mcp-capture.md` 换成 `references/event-capture.md`，写清两条路径：用户在 cc-connect 走 `/note`（Codex 不参与、不得补同步）；Codex 自己被要求记录时走 `capture_event.py` + `sync_daily_log_outputs.py` / `sync_all_outputs.sh`
- `AGENTS.md`、根 `README.md`、`personal_assistant/README.md`、skill install 文档同步更新

## 验证

只读校验确认四项全部成立：

1. `~/.codex/config.toml` 已无任何 MCP/plugin/marketplace 残留，且仍是合法 TOML，相邻配置段未被破坏
2. `/note` 链路完好：二进制存在且可执行、路径常量匹配、运行配置未覆盖 `note_worker`
3. skill 内部一致、所有 references 链接可解析
4. 无指向已删除文件的悬空文档引用

## 遗留

- Go 的 JSON-RPC transport 现在是死代码（`serve()` / `handleRequest()` / `toolDefinition()` 等）。清理需要重建二进制，存在碰到 `/note` 的风险
- 目录名 `plugins/` 已名不副实（它不再是 Codex plugin）。改名要同步修改 cc-connect 的 `note_worker` 配置并重启 daemon，而重启会打断进行中的会话

## 下一步动作

1. 决定是否清理 Go 死代码：若要清理，先在测试二进制上验证 `note` 子命令仍可跑，再替换 `bin/`
2. 决定是否重命名目录：改名必须一并设置 cc-connect 的 `note_worker`，并选一个没有进行中会话的时机重启 daemon
3. 若将来还有机器在跑 `import_feishu_daily_log_via_mcp.py`，改用 `import_feishu_daily_log.py`
