---
layout: post
title: "通过跳板机把 Deepin 25 虚拟机接入 ZeroTier 网络"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-22 18:24:32 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/通过跳板机把_Deepin_25_虚拟机接入_ZeroTier_网络.md`
# 通过跳板机把 Deepin 25 虚拟机接入 ZeroTier 网络

## 背景

目标是把一台跑在飞牛 fnOS（`10.71.48.167`）上的 libvirt 虚拟机接入 ZeroTier 网络 `166359304eb8bd7a`。

拓扑：

```text
本机 Deepin 23 (ZeroTier 10.71.48.85)
  └── ZeroTier ──> 飞牛 fnOS 10.71.48.167 / 192.168.110.147（跳板机，自带 sshpass）
        └── 局域网 192.168.110.0/24
              └── libvirt 虚拟机 192.168.110.91（Deepin 25）
```

虚拟机没有直接对外通道，需要经 fnOS 跳板机做二次跳转。

## 障碍：Deepin 25 的不可变根目录

标准做法（加 ZeroTier apt 源 → apt 安装）直接失败：

```text
install: cannot create regular file '/usr/share/keyrings/zerotier.gpg': Read-only file system
E: Unable to locate package zerotier-one
```

排查确认 Deepin 25 启用了 ostree 式不可变系统：

```text
usr-overlay on /usr type overlay (ro,...)
deepin-immutable-ctl: Immutable mode:true
```

根因不只是「`/usr` 只读」，更关键的一条是：

```text
$ deepin-immutable-writable status
Enable: false
ClearAfterReboot: true      <-- 关键
```

`ClearAfterReboot: true` 意味着即便用 `deepin-immutable-writable enable` 解锁 `/usr` 把包装进去，**重启后也会被清除**。所以「解锁 + apt 安装」这条路从设计上就不适合做持久化安装。

## 方案：绕开 /usr，独立安装到 /opt

Deepin 25 上 `/etc`、`/opt`、`/var/lib` 都可写。因此把 ZeroTier 完整装在可持久化的位置，完全不碰 `/usr`：

| 内容 | 路径 |
| --- | --- |
| 二进制 | `/opt/zerotier/bin/zerotier-one` |
| CLI 软链 | `/opt/zerotier/bin/{zerotier-cli,zerotier-idtool}` |
| systemd 单元 | `/etc/systemd/system/zerotier-one.service` |
| 运行状态 | `/var/lib/zerotier-one` |
| PATH | `/etc/profile.d/zerotier.sh` |

核心步骤：

```bash
# 1. 取官方 deb（用 bookworm 源，glibc 要求更低，兼容性更好）
curl -fsSL -o /tmp/zt.deb \
  https://download.zerotier.com/debian/bookworm/pool/main/z/zerotier-one/zerotier-one_1.16.2_amd64.deb

# 2. 只解包不安装，避开 dpkg 写 /usr
dpkg-deb -x /tmp/zt.deb /tmp/ztx
install -m 0755 /tmp/ztx/usr/sbin/zerotier-one /opt/zerotier/bin/zerotier-one
ln -sf zerotier-one /opt/zerotier/bin/zerotier-cli
ln -sf zerotier-one /opt/zerotier/bin/zerotier-idtool

# 3. 自建 systemd 单元（/etc 可写且持久），ExecStart 指向 /opt
# 4. 启动并加入网络
systemctl daemon-reload && systemctl enable --now zerotier-one
/opt/zerotier/bin/zerotier-cli join 166359304eb8bd7a
```

这套逻辑已合并进 `join-zerotier.sh`：脚本先用 root 探测 `/usr` 是否可写，只读时自动切到独立安装分支，普通系统仍走标准 apt/yum。

## 结果验证

```text
200 listnetworks 166359304eb8bd7a 123 7a:da:ef:b2:d9:42 OK PRIVATE zteyw6ddju 10.71.48.31/24
```

- Node ID：`6757fce91b`
- 虚拟 IP：`10.71.48.31/24`
- 服务状态：`active (running)` + `enabled`

从本机跨 ZeroTier 测连通性：

```text
10 packets transmitted, 10 received, 0% packet loss
rtt min/avg/max/mdev = 55.418/56.820/58.308/0.933 ms
```

0% 丢包、抖动 <1ms，说明是直连打洞成功。对比到跳板机本身的 457ms，虚拟机这条链路反而更快。

## 中转与执行方式

虚拟机没有对外通道，脚本和命令都经 fnOS 跳板机做二次跳转：

```bash
# 本机 -> fnOS -> 虚拟机
SSHPASS='<密码>' sshpass -e ssh -n \
  -o PreferredAuthentications=password -o PubkeyAuthentication=no \
  admin@192.168.110.91 '<命令>'
```

几个实际操作中踩到的点：

- fnOS 上**自带 `/usr/bin/sshpass`**，不需要额外安装，可直接做二次跳转。
- 用 `sshpass -e`（读 `SSHPASS` 环境变量）而不是 `sshpass -p`，避免密码出现在 `ps` 进程列表里。
- fnOS 的 `ping` 缺少 `cap_net_raw` 能力，普通用户执行直接报 `socket: Operation not permitted`。判断内网主机是否在线改用 TCP 探测：`timeout 5 bash -c "echo > /dev/tcp/192.168.110.91/22"`。
- 远程命令涉及多层 SSH 嵌套引用时，把最内层命令 base64 后再 `base64 -d | bash` 执行，可以彻底绕开引号转义问题。
- 从 fnOS 的 FUSE 共享文件夹复制脚本时，权限位会一并带走，需要落地后显式 `chmod`。

## 复用要点

- **不可变系统要区分「只读」和「重启后重置」**。只看到 `/usr` 只读就去解锁是错的，必须先查 `ClearAfterReboot`；否则装完当次可用、重启即失效，属于最难排查的一类问题。
- **`/opt` + `/etc/systemd/system` 是绕过不可变根目录的通用落点**，不依赖发行版专用开关，重启和系统升级都不受影响。
- **scp 会连权限位一起搬运**。从 fnOS FUSE 共享文件夹（权限显示为 `----------`）复制脚本时，落地文件权限变成 `0000` 直接不可读，需要显式 `chmod`。
- **`zerotier-cli` 不在 sudo 的 `secure_path` 里**，独立安装后要带全路径调用：`sudo /opt/zerotier/bin/zerotier-cli listnetworks`。
- 私有网络 join 后先出现 `REQUESTING_CONFIGURATION` / `ACCESS_DENIED`，需要管理员在 ZeroTier Central 授权对应 Node ID，才会变 `OK` 并分配 IP。

## 下一步

- [ ] 后续在同类不可变系统上装别的服务时，复用「`/opt` + `/etc/systemd/system`」这套落点模式
- [ ] 如需让该虚拟机承担网段转发，再评估开启 `net.ipv4.ip_forward` 与 NAT
