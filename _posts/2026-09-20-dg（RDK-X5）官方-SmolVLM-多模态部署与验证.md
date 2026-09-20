---
layout: post
title: "dg（RDK X5）官方 SmolVLM 多模态部署与验证"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-20 08:59:58 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/dg_RDK_X5_官方_SmolVLM_多模态部署与验证.md`
# dg（RDK X5）官方 SmolVLM 多模态部署与验证

日期：2026-09-19  
设备：RDK X5，主机名 `dg`  
网络：ZeroTier / SSH  
部署方案：地平线 TROS Humble 官方 `hobot_llamacpp` VLM launch

## 1. 结论

`dg` 已经按照官方 ROS 2 launch 方案完成 SmolVLM 图像理解验证。实际使用的是：

```text
/opt/tros/humble/share/hobot_llamacpp/launch/llama_vlm.launch.py
```

模型能够接收图片并返回自然语言描述。历史实测输出为：

```text
The image shows a close-up of a person's face with a white fluffy cat lying on a piece of fabric.
```

单次图像理解耗时约 6.8 秒，生成速度约 27 tokens/s。该结论来自 `dg` 当时开机状态下的现场测试；当前 `dg` 已关机，本次文档编写没有重新连接设备，也没有重新执行验证。

## 2. 硬件与软件环境

| 项目 | 记录 |
| --- | --- |
| 设备 | RDK X5，主机名 `dg` |
| CPU | 8 核 Cortex-A55 |
| 可用内存 | 约 3 GiB |
| 操作系统/软件栈 | TROS Humble |
| 官方运行组件 | `hobot_llamacpp` |
| 官方启动文件 | `/opt/tros/humble/share/hobot_llamacpp/launch/llama_vlm.launch.py` |
| 服务访问方式 | ZeroTier 网络 + SSH |
| 当前状态 | `dg` 已关机，无法现场复核 |

## 3. 部署组成及作用

### 3.1 `hobot_llamacpp`

路径：

```text
/opt/tros/humble/share/hobot_llamacpp/
```

作用：提供地平线 TROS 环境下的 Llama.cpp/视觉语言模型 ROS 2 组件，包括官方 launch 文件、节点配置和推理运行链路。

验证方式：

```bash
ls -l /opt/tros/humble/share/hobot_llamacpp/launch/llama_vlm.launch.py
```

### 3.2 SmolVLM GGUF 模型

路径：

```text
/opt/vlm-models/SmolVLM2-256M-Video-Instruct-Q8_0.gguf
```

作用：提供语言模型和视觉语言推理的 GGUF 权重。

来源：`hf-mirror.net`。

SHA256：

```text
af7ce9951a2f46c4f6e5def253e5b896ca5e417010e7a9949fdc9e5175c27767
```

验证方式：

```bash
sha256sum /opt/vlm-models/SmolVLM2-256M-Video-Instruct-Q8_0.gguf
```

### 3.3 SigLip 视觉编码器

路径：

```text
/opt/vlm-models/SigLip_int16_SmolVLM2_256M_Instruct_MLP_C1_UP_X5.bin
```

作用：把图片转换为视觉特征，再交给 SmolVLM 的语言模型生成描述。没有该视觉编码器时，语言模型不能完成真正的图片理解。

来源：`hf-mirror.net`。

SHA256：

```text
5dc1302cb7de5598488f09923e445201a2d7b545ff3490dd3323f3bbfe20c9e2
```

验证方式：

```bash
sha256sum /opt/vlm-models/SigLip_int16_SmolVLM2_256M_Instruct_MLP_C1_UP_X5.bin
```

## 4. 依赖安装清单

### 4.1 `tros-humble-sensevoice-ros2`

版本：

```text
1.1.0
```

作用：提供 TROS 语音识别相关 ROS 2 依赖。它不是图片理解的核心模型，但属于该官方 launch 方案运行环境中的已安装依赖。

安装方式（历史现场使用的 Debian 包管理方式）：

```bash
sudo apt install tros-humble-sensevoice-ros2
```

验证方式：

```bash
dpkg -l | grep tros-humble-sensevoice-ros2
```

### 4.2 `tros-humble-hobot-tts`

版本：

```text
2.0.6
```

作用：提供文本转语音 ROS 2 节点，使视觉语言模型的文字结果可以进一步转换为语音。

安装方式：

```bash
sudo apt install tros-humble-hobot-tts
```

验证方式：

```bash
dpkg -l | grep tros-humble-hobot-tts
```

已知限制：历史测试中 `hobot_tts` 节点因为缺少以下文件退出：

```text
/opt/tros/humble/lib/hobot_tts/tts_model/tts.flags
```

同时缺少对应 TTS 模型文件。因此本次验证证明了 VLM 图像理解链路可用，但没有证明 TTS 播放链路完整可用。TTS 缺失不影响图片输入和文字输出。

## 5. 模型下载、目录和校验

历史下载来源使用 `hf-mirror.net`，目标目录为：

```bash
sudo mkdir -p /opt/vlm-models
```

下载完成后应确认两个文件都位于 `/opt/vlm-models/`，并执行：

```bash
sha256sum /opt/vlm-models/SmolVLM2-256M-Video-Instruct-Q8_0.gguf
sha256sum /opt/vlm-models/SigLip_int16_SmolVLM2_256M_Instruct_MLP_C1_UP_X5.bin
```

只有 SHA256 与本文记录一致时，才可以把模型文件视为与历史测试相同的版本。由于 `dg` 当前关机，本次没有再次下载或校验。

## 6. BPU 服务资源处理

### 6.1 为什么要处理 BPU 服务

VLM 推理需要占用板端 BPU/ION 等资源。历史部署过程中，为避免已有服务和 VLM 节点争用硬件资源，曾临时暂停：

```text
bpu-service
bpu-healthcheck.timer
```

这属于资源协调措施，不是模型安装步骤。长期部署时应先确认官方 launch 是否与现有 BPU 服务兼容，再决定是否需要暂停服务。

### 6.2 恢复方式

历史测试结束后已经恢复：

```bash
sudo systemctl start bpu-service
sudo systemctl start bpu-healthcheck.timer
```

当时最终状态：

```text
bpu-service: active
bpu-healthcheck.timer: active
/healthz: status=ok
```

验证命令：

```bash
systemctl is-active bpu-service
systemctl is-active bpu-healthcheck.timer
curl http://127.0.0.1:8080/healthz
```

## 7. 官方 VLM 启动方案

官方启动文件：

```bash
source /opt/ros/humble/setup.bash
source /opt/tros/humble/setup.bash
ros2 launch \
  /opt/tros/humble/share/hobot_llamacpp/launch/llama_vlm.launch.py
```

启动文件的作用是按照 TROS 官方配置启动视觉语言模型节点，并连接 GGUF 语言模型、SigLip 视觉编码器和 ROS 2 通信接口。实际参数应以板端 launch 文件内容和对应版本文档为准，不能把其他版本的参数名直接套用。

启动后验证重点：

```bash
ros2 node list
ros2 topic list
```

然后向官方节点使用的图像输入接口发送图片，检查是否返回包含图片语义的文本结果。

## 8. 测试图片与结果

### 8.1 测试图片记录

现场测试输入文件名：

```text
image2.jpg
```

本地归档状态：未找到并确认保存的原始 `image2.jpg`。随后 `dg` 关机，SSH 访问失败，因此无法重新从设备取回原图。

因此，本正式文档**没有嵌入未经确认的本地图片，也没有用其他图片冒充测试图片**。这意味着当前文档保存了测试输入文件名和结果文字，但没有保存测试图片本体。待 `dg` 下次开机后，应优先把 `image2.jpg` 复制到：

```text
notes/sources/dg_smolvlm/image2.jpg
```

并在本文补充正式图片引用。

### 8.2 历史实测输出

```text
The image shows a close-up of a person's face with a white fluffy cat lying on a piece of fabric.
```

结果判断：模型识别出了人物面部、白色毛茸茸的猫以及承载物，说明图片已经进入视觉编码器并参与语言生成，不是单纯的文本模型空跑。

### 8.3 性能记录

| 指标 | 历史结果 |
| --- | ---: |
| 单次图像理解耗时 | 约 6.8 秒 |
| 生成速度 | 约 27 tokens/s |
| 测试状态 | 成功返回自然语言描述 |

以上数值是历史现场记录，不是当前在线测量值。

## 9. TTS 状态

VLM 输出文字后理论上可以交给 `hobot_tts` 播放，但历史测试发现 TTS 节点缺少：

```text
/opt/tros/humble/lib/hobot_tts/tts_model/tts.flags
```

以及对应 TTS 模型文件，导致 TTS 节点退出。

因此当前部署结论应写成：

```text
图片输入 -> SigLip -> SmolVLM -> 文字输出：已验证
文字输出 -> hobot_tts -> 语音播放：依赖缺失，未完成验证
```

## 10. 是否编写过代码

本次 SmolVLM 官方方案部署中：

- 没有新增 dg 侧业务代码。
- 没有新增 VLM 推理代码。
- 没有修改官方 `llama_vlm.launch.py`。
- 使用了官方 launch 文件、系统安装包、模型文件、Shell/服务命令和测试命令。
- 只做了部署、配置核对、服务启停、模型下载校验和结果验证。

个人助理仓库中已有的其他 `dg` BPU 文档和工具代码属于此前独立的 BPU 推理服务项目，不能把那些代码描述成这次官方 SmolVLM 部署新增的代码。

## 11. 复现清单

`dg` 重新开机后，建议按以下顺序复现：

1. 确认 ZeroTier 地址和 SSH 可达。
2. 确认 `/opt/tros/humble/share/hobot_llamacpp/launch/llama_vlm.launch.py` 存在。
3. 确认两个模型文件存在并校验 SHA256。
4. 确认 `tros-humble-sensevoice-ros2=1.1.0` 和 `tros-humble-hobot-tts=2.0.6`。
5. 检查 `bpu-service` 和 `bpu-healthcheck.timer` 状态。
6. 按官方 launch 启动 VLM。
7. 使用归档后的 `image2.jpg` 重新测试。
8. 记录完整终端输出、耗时和 ROS 2 节点状态。
9. 单独补齐 TTS flags 和模型，再验证语音链路。
10. 测试结束后确认 BPU 服务恢复，并重新检查 `/healthz`。

## 12. 当前限制与待办

- `dg` 已关机，本次不能重新执行命令。
- 原始测试图片 `image2.jpg` 当前未在本地确认归档，本文暂不嵌入图片。
- TTS 模型和 `tts.flags` 缺失，语音播放链路未完成。
- BPU 服务与 VLM 长期共存关系尚需在设备开机后重新验证。
- 当前性能数据是一次历史测试结果，不能视为持续运行基准。

## 13. 文档归档说明

本文件是正式项目文档，路径为：

```text
notes/documents/dg_RDK_X5_官方_SmolVLM_多模态部署与验证.md
```

它不写入 `logs/daily_log.md`，也不把 `daily_log.md` 作为本文档来源。本次已注册 SQLite 笔记、创建 Feishu Docs、投影到内容资产，并让正式笔记日历描述包含 Feishu Docs 链接。
