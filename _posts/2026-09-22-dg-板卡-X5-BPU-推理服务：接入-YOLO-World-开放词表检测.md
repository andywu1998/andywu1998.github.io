---
layout: post
title: "dg 板卡 X5 BPU 推理服务：接入 YOLO-World 开放词表检测"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-22 18:24:32 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/06_dg板卡X5_BPU推理服务_开放词表检测YOLO-World接入.md`
# dg 板卡 X5 BPU 推理服务：接入 YOLO-World 开放词表检测

日期：2026-09-21　设备：RDK X5（`dg`，10.71.48.154）　服务：`http://10.71.48.154:8080`

## 一句话结论

把板上的官方 `hobot_yolo_world` 节点接进已有 HTTP 服务，新增 `POST /v1/yolo_world`：**类别由文本给出**，不再受 COCO 80 类锁死——厂商词表里本来就有 `trash bin`、`red bottle` 等 104 个词，所以这次不需要另下 183 MB 的 CLIP 文本编码器就能直接跑通。实测厂商基准图正确检出 `trash bin`（0.339）和 `red bottle`（0.537）。过程中排掉三个坑：节点按工作目录解析模型、`ros2 launch` 把同名可执行文件当成 launch 文件、以及 rosidl 给 `uint8[]` 赋 `bytes` 时逐元素转换导致单帧 6.7 s。

## 1. 为什么做这个

板上 34 个基础模型分两类，都被类别体系锁死：检测只有 COCO 80 类，分类只有 ImageNet 1000 类。`04_dg板卡X5_BPU推理服务_全模型跑测结果.md` 里已经总结过这条天花板——「图里出现体系外的东西，模型只能往最近的类上靠，它不是看不出来，是没有这个词」。

这个限制在一次实际排障里咬到了：地铁站照片里明显有不锈钢垃圾桶，但 COCO 80 类里**没有 trash 类**，所以 `yolov8`/`yolov5s` 结构上就给不出这个框，不是漏检。同期还验证了 SmolVLM2 不能当验证器用（同一张裁剪图重复 5 次给出 4 种答案），所以需要一条真正能扩展类别的检测路径。

## 2. 接入方式：独立 unit + 三条 topic

```text
HTTP 请求（jpg/png + texts）
    -> bpu_service/server.py   /v1/yolo_world
    -> bpu_service/yolo_world.py  桥接层：发图 + 切词表 + 收结果
        /bpu/yw_image   (sensor_msgs/Image, bgr8)        -> hobot_yolo_world
        /bpu/yw_words   (std_msgs/String, 逗号分隔类别)   ->
        /bpu/yw_result  (ai_msgs/PerceptionTargets)      <-
    -> JSON {"count", "detections", "texts", "infer_ms", "perfs", "image"}
```

| 组件 | 作用 |
| --- | --- |
| `bpu_service/yolo_world.py` | 桥接层：发 `sensor_msgs/Image`、按需切换词表、把 `PerceptionTargets` 解析成框、词表预校验、请求串行化 |
| `deploy/yolo-world-service.service` | 节点独立 unit，和 `bpu-service` 解耦：节点挂了 HTTP 服务照常提供其它接口 |
| `deploy/launch/yolo_world_stack.launch.py` | 精简 launch：只起检测节点，去掉官方 launch 里的相机/codec/websocket |
| `deploy/run-yolo-world.sh` | source TROS 环境 + 准备节点要的工作目录 |
| `tests/yolo_world_test.py` | 端到端测试，断言「换词表必须换结果」 |

话题名刻意加了 `/bpu/` 前缀，这样跟官方 `yolo_world.launch.py`（`/image`、`/target_words`、`/hobot_yolo_world`）同时跑也不会串线。

选 `sensor_msgs/Image` 而不是 VLM 那条共享内存路径，是因为节点同时支持两条输入：`is_shared_mem_sub=1` 收 `hbm_img_msgs/HbmMsg1080P`（NV12），`=0` 收普通 `sensor_msgs/Image`（`bgr8`/`rgb8`/`nv12`）。后者不需要 hbmem 零拷贝环境，桥接层能直接用 OpenCV 的输出。

## 3. 三个坑

### 3.1 模型路径又是按工作目录解析的

和 SmolVLM 那次同一类问题：节点打开的是 `config/yolo_world.bin` 和 `config/offline_vocabulary_embeddings.json`，**没有任何 launch 参数可以改这两个路径**，只能靠工作目录。

```text
[hobot_yolo_world]: Read vacabulary file [config/offline_vocabulary_embeddings.json] fail! File is not exit!
[dnn]: Load model: config/yolo_world.bin fail, ret: -6000006
```

修法是启动脚本先 `cd` 到一个只装 `config` 软链的目录（`/opt/yolo-world`）。

### 3.2 不能直接用包自己的 lib 目录

第一反应是把工作目录设成 `/opt/tros/humble/lib/hobot_yolo_world`（那里本来就有 `config/`），结果 `ros2 launch` 直接报：

```text
malformed launch argument 'yolo_world.launch.py', expected format '<name>:=<value>'
```

原因是 `ros2 launch` 会先做 `os.path.isfile(package_name)`：那个目录里**正好有个同名可执行文件** `hobot_yolo_world`，于是包名被当成 launch 文件路径，真正的 launch 文件反而被当成位置参数。所以必须用一个不含同名文件的目录。

### 3.3 给 `uint8[]` 赋 `bytes` 会逐元素转换

接完之后端到端 7.6 s，而 `infer_ms` 只有 183 ms。加分段计时后定位到 `build` 阶段：

```text
yw phases: decode 87 ms, build 6687 ms, round-trip 583 ms
```

`build` 就是把 numpy 图片塞进 `sensor_msgs/Image.data`。实测同一帧三种赋值方式（1440×1920，8.3 MB）：

| 赋值方式 | 耗时 |
| --- | ---: |
| `msg.data = bgr.tobytes()` | 6655 ms |
| `msg.data = array.array("B", bgr.tobytes())` | **1.9 ms** |

rosidl 的 `uint8[]` setter 对 `bytes` 是逐元素走的，对 `array.array` 走缓冲区快路径。改完 `build` 降到 17 ms，端到端 **7.6 s → 0.96 s**。

## 4. 能力边界：开放词表 ≠ 任意词

节点拿的是**预先算好的 CLIP 文本嵌入**，不是在线的文本编码器。官方词表 `offline_vocabulary_embeddings.json` 有 **104 项**：COCO 80 加上 `trash bin`、`red bottle`、`blue bottle`、`white chair`、`black chair`、`bucket`、`box`、`pen`、`camera`、`battery`、`magnet`、`usb` 等 39 个扩展词。

- 词表里的词直接可用；要加新类别得跑官方 `tool/main.py`（需另下 183 MB 的 `huggingclip_text_encode.onnx`）重新生成词表。
- **发一个词表里没有的词，节点不报错、只是永远不出结果**，桥接层只会看到超时。所以桥接层启动时读词表并预校验，拼错直接返回 400 并给出 `difflib` 最接近的候选。

另一个边界是尺度：输入会被 letterbox 到模型的固定 640×640，小目标/远目标会漏。

| 测试图 | 词表 | 结果 |
| --- | --- | --- |
| 官方 `yolo_world_test.jpg`（2362×1723，垃圾桶+可乐瓶居中） | `trash bin,red bottle` | ✅ trash bin 0.339、red bottle 0.537 |
| 地铁站照片（1440×1920） | `person,trash bin,bench,suitcase,backpack` | 6 person + 1 backpack 0.059；❌ 垃圾桶、长椅都没检出 |

地铁图里垃圾桶在 640×640 下只剩约 27×27 像素。把它裁出来单独发（`crop=290:370:1150:450`）也**没有**检出——同一区域放大约 27 倍仍不触发，说明这个 256M 级开放词表模型对「不锈钢双联垃圾桶」这种外观的召回本身就不强，不是单纯的尺度问题。所以结论要保守：**开放词表能力成立，但只对厂商词表里外观典型的类别可靠**。

## 5. 顺手修掉的两个既有问题

### 5.1 服务的 INFO 日志一直被吞掉

`cli.main()` 先调用 `logging.basicConfig(level=WARNING)`，而 `logging.basicConfig` 只在 root logger 没有 handler 时生效，所以 `serve()` 里的 `basicConfig(level=INFO)` 是空操作——**`preloaded ...`、`VLM bridge ready` 这些生命周期日志从来没进过 journal**，只有 `LOG.error` 能看到。这也是本次定位耗时偏长的原因之一。修法是在 `serve()` 里显式 `logging.getLogger().setLevel(logging.INFO)`。

### 5.2 `/help` 被 `rsync --delete` 删掉了

`http://10.71.48.154:8080/help` 之前能返回一份 12 KB 的纯文本 API 参考，但**那份实现只存在于板子上**（板端 `server.py` 有 `/help` 路由、仓库里没有），一次 `deploy/sync.sh` 就把它删成了 404——和 `05_...VLM接入与运维加固.md` 里记的 `bpu-healthcheck.sh` 被删是同一个失败模式，第二次踩。

修法不是在仓库里补一份静态文本，而是新增 `bpu_service/help_text.py`，把 `/help` 做成**由实时状态渲染**的路由：模型表来自 `engine.models_info()`，VLM / YOLO-World 状态来自各自桥接层。这样它既进仓库不会被删，也不可能再和实际构建漂移。

> 同一个模式在本次归档时**第三次**出现：把 `dg-bpu-service/` 用 `rsync -a --delete` 镜像进 `source_materials/bpu-service/` 时，删掉了归档里独有、仓库里没有的 `tools/run_model_zoo.py`、`tools/render_outputs.py`、`tools/build_zoo_report.py` 和 `deploy/bpu-healthcheck.{service,timer}`——其中前两个正是 `04_...全模型跑测结果.md` 引用的工具。已从 git 恢复。教训：`source_materials/` 是**归档**，只应追加/覆盖，永远不要对它用 `--delete`。

## 6. 实测与验证

- `tests/yolo_world_test.py`：7 项断言全 PASS（bridge 已起、`person,bus` 出框、返回的 label 只来自 prompt、**换词表必须换结果**、未知类别被拒、`annotate=1` 返回图、请求计数递增）。
- 回归 `tests/smoke_test.py`：`FAILURES: 0`，32 并发 43.5 req/s，与既有基线（43 req/s）一致；预加载模型集合未变。
- 耗时：地铁图 0.96 s、厂商图 1.05 s（其中 BPU 前向 `perfs` 报 122–125 ms，`infer_ms` 183–373 ms）。
- `bpu_service/help_text.py` 渲染出的 `/help` 为 14.5 KB，第 6 节为 yolo-world，第 8 节列出 35 个模型。

## 7. 复现清单

```bash
# 1. 同步并起节点
sh deploy/sync.sh dg /opt/bpu-service
cp /opt/bpu-service/deploy/yolo-world-service.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now yolo-world-service

# 2. 重启 HTTP 服务（会加载新的 /v1/yolo_world 路由）
systemctl restart bpu-service

# 3. 端到端
python3 tests/yolo_world_test.py --http http://127.0.0.1:8080
curl -s -X POST --data-binary @pic.jpg \
  'http://127.0.0.1:8080/v1/yolo_world?texts=trash%20bin,red%20bottle&annotate=1'
```

浏览器展示页新增「开放词表检测」tab。板子掉线后改用 `page_check.js --file` 对从 `server.py` 抽出的 `INDEX_HTML` 做本地自检（结果见下节），不必连板子也能验证页面。

## 8. 相关文件

| 位置 | 说明 |
| --- | --- |
| `dg-bpu-service/bpu_service/yolo_world.py` | YOLO-World 桥接层 |
| `dg-bpu-service/bpu_service/help_text.py` | `/help` 正文，由实时状态渲染 |
| `dg-bpu-service/bpu_service/server.py` | `/v1/yolo_world`、`/v1/yolo_world/status`、`/help`、画框 |
| `dg-bpu-service/deploy/launch/yolo_world_stack.launch.py` | 精简 launch |
| `dg-bpu-service/deploy/run-yolo-world.sh`、`yolo-world-service.service` | 启动脚本与 unit |
| `dg-bpu-service/tests/yolo_world_test.py` | 端到端测试 |
| `notes/sources/projects/dg板卡X5_BPU推理服务/source_materials/` | 源码归档 |

板子上：节点模型与词表在 `/opt/tros/humble/lib/hobot_yolo_world/config/`，节点工作目录 `/opt/yolo-world`。

## 9. 尚未验证 / 待办

- **本次收尾时板子掉线**（`No route to host`，持续 >5 分钟），最后一项改动没能在板上复核：词表预校验对未收录类别应返回 400（此前未校验时表现为 30 s 超时后 503，已实测确认；400 分支只在本地代码复核过）。恢复后需要补跑 `tests/yolo_world_test.py`。
- 展示页新 tab 已用本地方式验证：

  ```text
  $ node tools/page_check.js --file /tmp/index_local.html
  inline scripts: 1
  PASS: inline JavaScript compiles (7683 bytes)
  PASS click "概览" -> overview   PASS click "检测 / 分类" -> detect
  PASS click "VLM 图像理解" -> vlm  PASS click "开放词表检测" -> yolo
  PASS click "性能压测" -> perf    PASS click "指标" -> metrics
  RESULT: PASS
  ```
- 板子掉线的根因未定位。可疑方向是资源压力：现在同一块 3 GB / 8 核 A55 上同时跑 `bpu-service`（预加载 3 个 BPU 模型）、`vlm-service`（SmolVLM2）、`yolo-world-service`（YOLO-World）三套 ROS 2 / BPU 栈，且启动过程中出现过约 50 s 无输出的空档和明显变慢的模型加载。需要查 journal/dmesg 确认是否 OOM。
- 词表扩展：想覆盖地铁站那类场景（escalator、display screen、pillar），得补跑 `tool/main.py` 生成含这些词的词表。
- 小目标召回：可以考虑滑窗/裁切后再送检，或者评估 `hobot_dosod`（同板的另一套开放集检测，`dosod_mlp3x_l_rep-int8.bin`）作为对照。

## 10. 与既有笔记的关系

- `01_dg板卡X5_BPU推理服务_原理_问答_代码.md`：HTTP 服务与 BPU 调用链本体；
- `04_dg板卡X5_BPU推理服务_全模型跑测结果.md`：34 个基础模型的跑测，也是本问题的来源——「类别体系决定天花板」；
- `05_dg板卡X5_BPU推理服务_VLM接入与运维加固.md`：VLM 服务化，本文的桥接层结构照它写，`/help` 被 rsync 删也是它先记过的坑；
- 本篇补上第三条路：固定类别（`/v1/infer`）、自然语言描述（`/v1/vlm`）、文本指定类别（`/v1/yolo_world`）。
