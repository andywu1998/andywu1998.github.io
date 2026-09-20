---
layout: post
title: "MonoCloud 客户端 CLI 化：原理、凭据抓取与多节点代理"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-20 18:47:23 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/MonoCloud_客户端CLI化_原理与凭据抓取.md`
# MonoCloud 客户端 CLI 化：原理、凭据抓取与多节点代理

日期：2026-09-20

## 1. 一句话结论

MonoCloud 桌面客户端（Wails 套壳的 mihomo）本身不做代理，真正的内核是它自带的
`monocloud_core`（MetaCubeX mihomo v1.19.27）。我把它的配置渲染链路和内存里的
订阅凭据摸清之后，做成了不依赖 GUI 的独立 CLI `mcli`：自己渲染配置、自己拉起内核、
自己管 controller API，支持多节点热切换。

最终状态：

| 项目 | 结果 |
| --- | --- |
| 节点 | 抓到套餐内全部 **15 个**节点（含 server/port/cipher/password） |
| 可用性实测 | **12 个可用**，3 个台湾节点对端连不通（已在 CLI 里标记为不可用） |
| 本机部署 | `~/.config/monocloud-cli/config.json`，代理端口 7890 |
| 异地部署 | 已在 `dphvm`（Deepin 25 / x86_64，原本没装 mihomo）跑通，全程用户态、未改系统配置 |
| 源码归档 | `notes/sources/projects/monocloud-cli/source_materials/monocloud-cli/` |

## 2. 为什么要做这件事

MonoCloud 只能通过 GUI 使用：登录态在内存里，重启就要重新登录，节点只能一个个手点。
我想把「选节点 + 挂代理」变成脚本能调用的动作，于是先拆清它的运行原理，再从内存里把
凭据取出来，最后用它的内核拼出一个独立 CLI。

## 3. MonoCloud 实际是怎么工作的

`~/Downloads/monocloud-1.0.0.Appimage` 是一个 Wails 应用（Go 后端 + WebKitGTK 前端），
自身不做代理，真正干活的是它附带的内核 `~/.Monocloud/monocloud_core`，也就是
**MetaCubeX mihomo (Clash Meta) v1.19.27**。

运行时是一条四层套娃的链路：

```text
应用           → 127.0.0.1:10801        GUI 转发器A（对外稳定端口）
               → 127.0.0.1:<随机>       mihomo mixed-port
               → Monocloud_SS
               → 127.0.0.1:<随机>       GUI 转发器B
               → <真实节点 IP>:<port>   ← 真实上游
```

GUI 会把配置里的 `server` 改写成 `127.0.0.1`，由自己的转发器B 再去连真实节点。所以
mihomo 的 controller API（`/proxies`、`/configs`）里**永远看不到真实凭据**。

三条由实测得到、决定方案走向的结论：

1. **配置不落盘。** 完整配置由 `renderClashConfigForController` 通过 unix socket
   （`~/.Monocloud/monocloud-core-api.sock`）内联 `PUT /configs` 下发，随后即从内存消失。
   用覆盖 4732 个目录的全盘 inotify 监听重放连接流程，磁盘上只出现无凭据的 `init.yaml`。
2. **替换内核二进制无效。** GUI 的 `ensureWorkDirResources` 会从内置副本自我修复
   `monocloud_core`，换上去的包装器 1 秒内被覆盖。
3. **controller socket 无鉴权**，权限 `srw-rw-rw-`，本机任何用户都能读写。

## 4. 凭据是怎么抓到的

### 4.1 为什么常规抓法不行

`/proc/<pid>/mem` 在 yama `ptrace_scope=1` 下只允许**祖先进程**读取。我的 shell 既不是 GUI
的祖先，也看不到它的子进程，直接读内存会被拒绝。而按 JSON 键（`node_id`、`nodes`、`plans`）
截窗口的做法也全落空：Go 侧早就 GC 掉了响应体，JS 里的对象键不带引号，JSON 文本只是瞬时字符串。

### 4.2 第一版：`harvest.py`（当祖先 + 结构化判据）

思路是先停掉 systemd 实例，再由脚本亲自把 AppImage 拉起来当自己的子进程，于是 GUI 及其
所有后代的内存都变成可读，随后周期性扫描内存中的渲染结果。

判据必须是**结构化**的：Go 会把 `mixed-port`、`proxy-groups`、`"password"` 这些字面量紧挨着
放在只读段里，任何关键字匹配都会命中误报。真实配置必须同时具备 `password: "<真实值>"` 与
`port: "<数字>"`，且不含 `monoCloud_password/cipher/hostname` 占位符。抓到后
`captured/runtime-config.yaml` 就是渲染完的完整配置。

这一版只能拿到「当前正在用的那一个」节点。

### 4.3 第二版：`harvest2.py`（整堆转储）

节点列表真正待的地方是 WebKit 渲染进程（`WebKitWebProcess`）和网络进程的响应缓冲区。
`harvest2.py` 改成整堆转储：

1. 由本进程亲自拉起 AppImage，让整棵进程树都是自己的后代；
2. 解析每个进程的 `/proc/<pid>/smaps` 拿到每个 VMA 的 Rss；
3. VMA 太大就查 `/proc/<pid>/pagemap`，只挑 present 的 4K 页落盘（JSC 会 reserve 几十 GB
   地址空间，但 RSS 只有几百 MB）；
4. 收到 `touch /tmp/harvest2-snap` 触发一次，之后完全离线分析。

实测一次转储 2.2 GB，拿到套餐内全部 15 个节点。

### 4.4 关键细节：内存里有「脱敏副本」和「原文」两份

节点列表在内存里同时存在两种形态，这是最容易踩的坑：

- GUI 的 `sanitizePublicText` 会把副本写成 `"password": "\u003credacted\u003e"`；
- 只有 `fetchNodesForPlan` 的 API 响应原文里带真实密码。

第一轮提取拿到的就是脱敏副本，看起来「有列表但没密码」。正确做法是按
`{"id":"<plan>-shadowsocks-..."` 的对象结构提取，并**过滤掉 `password == "<redacted>"` 的记录**。

顺带确认的两点：

- API 主机是 `https://api.bluecloudworks.com/`，DoH 走 `/monoquery`；
- 出口 IP 区分不了节点（`hk1` 和 `sg2` 出口都是同一个地址），只有真实 `server:port` 才能区分。

## 5. `mcli` 用法

```bash
./mcli init
./mcli up                  # 渲染配置 + 拉起内核（复用 Clash_ss 模板，7486 条规则）
./mcli status              # 内核版本 / 当前节点 / 出口 IP / 累计流量
./mcli nodes               # 列出全部节点，* 标记当前
./mcli use 3               # 按序号或名字热切换（走 controller API，不掉连接）
./mcli exec -- curl https://api.ipify.org
./mcli env                 # 打印代理环境变量
./mcli add-node NAME --type ss --server <host> --port <port> --cipher <c> --password '<p>'
./mcli reload              # 手动热重载配置
./mcli logs -f
./mcli systemd-install     # 装成开机自启的 user service
```

配置在 `~/.config/monocloud-cli/config.json`，运行时目录 `~/.local/share/monocloud-cli/`
（`runtime.yaml` / `core.pid` / `core.log`）。`core` 字段可指向任意 mihomo；没有模板时会退回
内置最小配置；`up` 会自动把 `Country.mmdb` 等地理数据链接进数据目录，否则内核会去 GitHub
下载而卡住。

## 6. 多节点管理与实测结果

15 个节点全部导入后逐个实测，出口归属如下：

| 区域 | 节点 | 出口 IP |
| --- | --- | --- |
| HK | `Relay-HK1` | 45.138.210.185 |
| HK | `Relay-HK2`、`Relay-HK3` | 45.138.210.171 |
| HK | `Relay-HK4` | 45.138.210.160 |
| JP | `Relay-JP1` | 103.181.1.61 |
| JP | `Relay-JP2` | 103.181.1.121 |
| JP | `JP3` | 103.181.1.81 |
| SG | `Relay-SG1` | 103.230.68.82 |
| SG | `Relay-SG2` | 103.230.68.112 |
| US | `Relay-US1` | 45.8.204.62 |
| US | `Relay-US2` | 45.8.204.93 |
| TR | `TR1` | 185.93.68.106 |
| TW | `Relay-TW1`、`Relay-TW2`、`TW1` | 连不通（`kevin.mydarkcloud.info:2100/2200`、`tw1.mydarkcloud.info:995` TCP 直接失败） |

三个台湾节点在配置里加了 `"disabled": true`：`mcli nodes` 会显示「不可用」，`mcli use`
会拒绝切换（确要切加 `--force`），自动兜底选节点也会跳过它们。

## 7. 过程中修掉的一个坑：冷启动切组

内核冷启动时，mihomo 的 select 组会默认选**列表里第一个**节点，而不是配置里的 `current`。
在 `dphvm` 上第一次拉起来时撞到：配置写 `Relay-HK1`，实际走的是 `JP3`，`status` 里
「当前节点」和「内核在用的」对不上。修法是 `up` 在 `wait_ready` 之后显式
`PUT /proxies/Proxy` 切回 `current`。

## 8. 换一台机器用（`dphvm` 实测）

整套是用户态可搬迁的，不需要动目标机器的系统配置：

1. 拷 `mcli`、`bin/monocloud_core`、`share/Clash_ss`；
2. 把 `config.json` 里的 `core` / `template` 改成新路径；
3. `Country.mmdb` 放到 `~/.config/mihomo/`，`up` 时会自动链接。

实测环境：`dphvm`（Deepin 25、x86_64、6 核、8 GB，原本没装 mihomo）。

| 测试 | 结果 |
| --- | --- |
| 直连 `https://www.google.com/generate_204` | 超时（`000`，8 s） |
| 走代理访问同一地址 | `204`，0.84 s |
| 走代理访问 `https://github.com` | `200` |
| 切节点后出口 IP | `Relay-HK1` 45.138.210.185 → `Relay-US1` 45.8.204.62 |
| 端口冲突自愈 | controller 端口 19090 被占，自动改用 44035 |

跑起来的方式（脱离 SSH 会话，避免进程被回收）：

```bash
cd ~/monocloud-cli && setsid ./mcli up < /dev/null > /tmp/mcli-up.log 2>&1
./mcli status && ./mcli exec -- curl -s https://api.ipify.org
```

测试结束后已 `mcli down`，端口释放、无残留进程，程序文件保留。

## 9. 限制、边界与风险

- **凭据会轮换**：服务端换密码或重新登录后旧凭据失效，需要重跑 `harvest2.py` 重新提取。
- **只适用于自己的订阅**：这是给自己账号做的本地自动化。如果要做成给他人使用的客户端，
  就属于重实现厂商鉴权客户端，需要先看服务条款。
- **凭据不随源码归档**：本次归档只放代码和说明，`captured/`、`dumps/`（含 2.2 GB 转储）
  和 `config.json`（含明文密码）都没有进仓库；`dphvm` 上的配置也提示用户可随时清理。
- **节点可用性会变**：本次「不可用」是 2026-09-20 的实测结论，不是永久属性。

## 10. 源码归档说明

代码与说明归档在：

```text
notes/sources/projects/monocloud-cli/source_materials/monocloud-cli/
├── mcli                     # 独立 CLI（含 disabled 标记与冷启动切组修复）
├── harvest.py               # 第一版：祖先进程 + 结构化判据抓当前节点配置
├── harvest2.py              # 第二版：整堆转储，用于提取全量节点列表
├── capture-runtime-config.py
└── README.md
```

笔记与源码的关系是「目录级来源」：`notes/sources/projects/monocloud-cli/` 在飞书 Base
`来源资料` 中以单条 `dir` 来源登记，并通过 `note_sources` 以 `based-on` 关联到本篇笔记。

## 11. 复现清单

1. 确认本机有 MonoCloud（AppImage 与 `~/.Monocloud/`）。
2. 需要全量节点时：跑 `harvest2.py`，在 GUI 里登录并打开节点列表页，然后
   `touch /tmp/harvest2-snap` 触发转储。
3. 离线从 dump 里按 `{"id":"<plan>-shadowsocks-..."` 提取节点对象，过滤 `password == "<redacted>"`。
4. 把结果写进 `~/.config/monocloud-cli/config.json`（`mcli add-node` 或直接改配置后 `reload`）。
5. `mcli up` → `mcli status` → `mcli exec -- curl -s https://api.ipify.org` 验证。
6. 逐个 `mcli use <节点>` + `mcli ip` 做可用性巡检，把连不通的标记为 `disabled`。

## 12. 下一步动作

- 过一段时间重跑一次可用性巡检，确认三个台湾节点是否恢复。
- 如果要做成常驻服务，用 `mcli systemd-install` 装成 user service（本机可以，`dphvm` 未安装）。
- 需要换订阅或换账号时，重跑第 11 节的第 2-4 步刷新凭据。
