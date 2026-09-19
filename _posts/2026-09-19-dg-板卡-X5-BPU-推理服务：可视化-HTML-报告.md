---
layout: post
title: "dg 板卡 X5 BPU 推理服务：可视化 HTML 报告"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-19 09:22:31 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/02_dg板卡X5_BPU推理服务_可视化HTML.md`
# dg 板卡 X5 BPU 推理服务：可视化 HTML 报告

日期：2026-09-19

这是一篇**原生 Markdown 内嵌 HTML** 的笔记：正文本身是一段自包含的 HTML（纯 `<style>` + `<div>`，无 JavaScript、无外部资源），嵌在 Markdown 里由博客渲染。它用图表的方式把整套 BPU 推理服务讲了什么、原理是什么、实测到什么，一次性呈现出来。

<p class="bpuv-mdnote">说明：飞书文档导入会丢弃 <code>&lt;div&gt;</code> / <code>&lt;style&gt;</code> 这类原生 HTML 标签（已实测确认），所以这篇只在博客侧渲染；文字版原理与代码见 <code>notes/documents/01_dg板卡X5_BPU推理服务_原理_问答_代码.md</code>。</p>

<style>
.bpuv-wrap{
  --ink:#1a2332; --muted:#5b6b82; --line:#e2e8f0; --card:#ffffff; --bg:#f4f7fb;
  --blue:#2b6cb0; --teal:#0f9d8f; --amber:#d97706; --rose:#c5306b; --violet:#6b46c1;
  font-family:-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",Segoe UI,Roboto,sans-serif;
  color:var(--ink); background:var(--bg); border:1px solid var(--line); border-radius:18px;
  padding:28px 26px 34px; margin:26px 0; line-height:1.7; font-size:15px;
  box-shadow:0 10px 30px rgba(26,35,50,.07);
}
.bpuv-wrap *{box-sizing:border-box;}
.bpuv-hero{text-align:center;padding:6px 0 22px;border-bottom:1px dashed var(--line);margin-bottom:26px;}
.bpuv-hero h3{margin:0 0 8px;font-size:27px;letter-spacing:.5px;color:var(--ink);}
.bpuv-hero .bpuv-sub{margin:0 auto;max-width:640px;color:var(--muted);font-size:14.5px;}
.bpuv-tagrow{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:14px;}
.bpuv-tag{font-size:12.5px;padding:4px 11px;border-radius:999px;background:#e8f0fb;color:var(--blue);border:1px solid #cfe0f5;font-weight:600;}
.bpuv-tag.t2{background:#e6f6f3;color:#0b7a70;border-color:#c7eae4;}
.bpuv-tag.t3{background:#fdf1e0;color:#a35c05;border-color:#f6ddb8;}

.bpuv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:30px;}
.bpuv-stat{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:15px 12px;text-align:center;}
.bpuv-stat b{display:block;font-size:24px;line-height:1.2;color:var(--blue);}
.bpuv-stat.s2 b{color:var(--teal);} .bpuv-stat.s3 b{color:var(--amber);} .bpuv-stat.s4 b{color:var(--rose);}
.bpuv-stat span{display:block;font-size:12.5px;color:var(--muted);margin-top:5px;}

.bpuv-sec{margin:34px 0 0;}
.bpuv-sec > h4{display:flex;align-items:center;gap:10px;margin:0 0 14px;font-size:18px;color:var(--ink);border:0;padding:0;}
.bpuv-num{display:inline-flex;align-items:center;justify-content:center;width:27px;height:27px;border-radius:9px;
  background:linear-gradient(135deg,var(--blue),#4299e1);color:#fff;font-size:14px;font-weight:700;flex:0 0 auto;}
.bpuv-sec.t2 .bpuv-num{background:linear-gradient(135deg,var(--teal),#38b2ac);}
.bpuv-sec.t3 .bpuv-num{background:linear-gradient(135deg,var(--amber),#ed8936);}
.bpuv-sec.t4 .bpuv-num{background:linear-gradient(135deg,var(--violet),#9f7aea);}
.bpuv-sec.t5 .bpuv-num{background:linear-gradient(135deg,var(--rose),#ed64a6);}

.bpuv-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:13px;}
.bpuv-card{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:15px 16px;}
.bpuv-card h5{margin:0 0 7px;font-size:14.5px;color:var(--ink);}
.bpuv-card p,.bpuv-card ul{margin:0;font-size:13.5px;color:var(--muted);}
.bpuv-card ul{padding-left:18px;}
.bpuv-card li{margin:3px 0;}
.bpuv-card .bpuv-kbd{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;background:#eef2f7;
  color:#33415c;border:1px solid var(--line);border-radius:5px;padding:1px 5px;}

.bpuv-chain{display:flex;flex-direction:column;gap:0;}
.bpuv-layer{display:flex;gap:13px;align-items:flex-start;background:var(--card);border:1px solid var(--line);
  border-left:5px solid var(--blue);border-radius:11px;padding:12px 15px;}
.bpuv-layer.l2{border-left-color:#4299e1;} .bpuv-layer.l3{border-left-color:var(--teal);}
.bpuv-layer.l4{border-left-color:var(--amber);} .bpuv-layer.l5{border-left-color:var(--rose);}
.bpuv-layer .bpuv-lname{flex:0 0 190px;font-weight:700;font-size:13.5px;color:var(--ink);}
.bpuv-layer .bpuv-ldesc{font-size:13px;color:var(--muted);}
.bpuv-layer code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;background:#eef2f7;border-radius:5px;padding:1px 5px;color:#b83280;}
.bpuv-arrow{text-align:center;color:#a0aec0;font-size:15px;line-height:1;padding:5px 0;}

.bpuv-flow{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;}
.bpuv-step{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:11px 12px;position:relative;}
.bpuv-step b{display:block;font-size:12px;color:#fff;background:var(--blue);border-radius:6px;padding:1px 7px;display:inline-block;margin-bottom:6px;}
.bpuv-step.p2 b{background:#4299e1;} .bpuv-step.p3 b{background:var(--teal);}
.bpuv-step.p4 b{background:#0b7a70;} .bpuv-step.p5 b{background:var(--amber);}
.bpuv-step.p6 b{background:#b45309;} .bpuv-step.p7 b{background:var(--violet);}
.bpuv-step.p8 b{background:var(--rose);} .bpuv-step.p9 b{background:#8a2251;}
.bpuv-step span{font-size:13px;color:var(--muted);}
.bpuv-step em{font-style:normal;display:block;font-size:12px;color:#94a3b8;margin-top:4px;font-family:ui-monospace,Menlo,monospace;}

.bpuv-cnt{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;}
.bpuv-cnt-item{background:var(--card);border:1px solid var(--line);border-top:4px solid var(--blue);border-radius:11px;padding:12px 12px 13px;}
.bpuv-cnt-item:nth-child(2){border-top-color:#4299e1;} .bpuv-cnt-item:nth-child(3){border-top-color:var(--teal);}
.bpuv-cnt-item:nth-child(4){border-top-color:var(--amber);} .bpuv-cnt-item:nth-child(5){border-top-color:var(--rose);}
.bpuv-cnt-item b{display:block;font-size:13px;margin-bottom:6px;color:var(--ink);}
.bpuv-cnt-item p{margin:0;font-size:12.5px;color:var(--muted);}

.bpuv-bars{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:16px 18px;}
.bpuv-bar{display:flex;align-items:center;gap:11px;margin:9px 0;font-size:13px;}
.bpuv-bar .bpuv-bl{flex:0 0 168px;color:var(--muted);}
.bpuv-bar .bpuv-bt{flex:1;background:#edf2f7;border-radius:999px;height:20px;overflow:hidden;}
.bpuv-bar .bpuv-bf{height:100%;border-radius:999px;background:linear-gradient(90deg,#2b6cb0,#63b3ed);}
.bpuv-bar.g2 .bpuv-bf{background:linear-gradient(90deg,#0f9d8f,#4fd1c5);}
.bpuv-bar.g3 .bpuv-bf{background:linear-gradient(90deg,#b45309,#f6ad55);}
.bpuv-bar .bpuv-bv{flex:0 0 96px;text-align:right;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;color:var(--ink);}

.bpuv-table{width:100%;border-collapse:collapse;font-size:13px;background:var(--card);border-radius:11px;overflow:hidden;}
.bpuv-table th{background:#eaf1fa;color:#24476f;text-align:left;padding:9px 11px;font-weight:700;font-size:12.5px;}
.bpuv-table td{padding:8px 11px;border-top:1px solid var(--line);color:var(--muted);}
.bpuv-table td:first-child{color:var(--ink);font-weight:600;}
.bpuv-table tr:nth-child(even) td{background:#fafcff;}

.bpuv-qa{display:grid;grid-template-columns:1fr 1fr;gap:13px;}
.bpuv-q{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:14px 15px;border-left:4px solid var(--violet);}
.bpuv-q h5{margin:0 0 8px;font-size:13.5px;color:#4c3a8f;}
.bpuv-q h5::before{content:"Q";display:inline-block;width:18px;height:18px;line-height:18px;text-align:center;border-radius:5px;
  background:var(--violet);color:#fff;font-size:11px;margin-right:7px;font-weight:700;}
.bpuv-q p{margin:0 0 6px;font-size:13px;color:var(--muted);}
.bpuv-q p:last-child{margin-bottom:0;}
.bpuv-q strong{color:var(--ink);}

.bpuv-pit{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.bpuv-pit div{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 13px;font-size:13px;color:var(--muted);}
.bpuv-pit div b{color:var(--rose);margin-right:6px;}

.bpuv-concl{margin-top:30px;background:linear-gradient(135deg,#1a2332,#2d3f5c);border-radius:14px;padding:20px 22px;color:#e8eefc;}
.bpuv-concl h4{margin:0 0 9px;color:#fff;font-size:16px;}
.bpuv-concl p{margin:0;font-size:13.5px;color:#b9c7e0;}
.bpuv-concl code{background:rgba(255,255,255,.12);border-radius:5px;padding:1px 6px;font-size:12.5px;color:#9ae6d8;}

@media (max-width:760px){
  .bpuv-stats{grid-template-columns:repeat(2,1fr);}
  .bpuv-grid,.bpuv-qa,.bpuv-pit{grid-template-columns:1fr;}
  .bpuv-flow{grid-template-columns:1fr;}
  .bpuv-cnt{grid-template-columns:1fr 1fr;}
  .bpuv-layer{flex-direction:column;gap:4px;}
  .bpuv-layer .bpuv-lname{flex:0 0 auto;}
  .bpuv-bar .bpuv-bl{flex:0 0 104px;font-size:12px;}
  .bpuv-wrap{padding:20px 15px 26px;}
}
</style>

<div class="bpuv-wrap" markdown="0">

  <div class="bpuv-hero">
    <h3>dg 板卡 X5 · BPU 推理服务</h3>
    <p class="bpuv-sub">一台没有摄像头、麦克风、屏幕的地瓜机器人 RDK X5，被我改造成了一台纯算力的 AI 推理服务器：图片从网络进来，检测结果从网络出去。</p>
    <div class="bpuv-tagrow">
      <span class="bpuv-tag">RDK X5 / X5M</span>
      <span class="bpuv-tag t2">BPU 1 GHz</span>
      <span class="bpuv-tag t3">34 个官方模型</span>
      <span class="bpuv-tag">HTTP 推理服务</span>
      <span class="bpuv-tag t2">零第三方依赖</span>
    </div>
  </div>

  <div class="bpuv-stats">
    <div class="bpuv-stat"><b>9.8<small style="font-size:13px"> ms</small></b><span>yolov8 纯 BPU 单帧</span></div>
    <div class="bpuv-stat s2"><b>52<small style="font-size:13px"> ms</small></b><span>板上端到端单请求</span></div>
    <div class="bpuv-stat s3"><b>37.9<small style="font-size:13px"> req/s</small></b><span>板上 4 并发吞吐</span></div>
    <div class="bpuv-stat s4"><b>1731<small style="font-size:13px"> 行</small></b><span>全部 Python 代码</span></div>
  </div>

  <div class="bpuv-sec">
    <h4><span class="bpuv-num">1</span>我做了什么</h4>
    <div class="bpuv-grid">
      <div class="bpuv-card">
        <h5>把 BPU 变成网络服务</h5>
        <p>纯标准库 <span class="bpuv-kbd">ThreadingHTTPServer</span>，零额外依赖。图片 POST 进来，检测框 / 分类结果 JSON 回去，浏览器还能直接拖图上传。</p>
      </div>
      <div class="bpuv-card">
        <h5>直接吃板载模型</h5>
        <p>板子 <span class="bpuv-kbd">/opt/hobot/model/x5/basic</span> 下 34 个官方 <span class="bpuv-kbd">.bin</span> 模型开箱即用，不需要做任何模型转换。</p>
      </div>
      <div class="bpuv-card">
        <h5>三种后处理解码器</h5>
        <p>YOLOv5 锚框解码、YOLOv8 / v10 / v11 / v12 的 DFL 解码、ImageNet 分类 top-k；不认识的模型退回原始张量统计。</p>
      </div>
      <div class="bpuv-card">
        <h5>为摄像头预留了接口</h5>
        <p>除了编码图片，还做了 <span class="bpuv-kbd">/v1/infer/nv12</span>，直接收原始 NV12 帧。以后接上摄像头或 RTSP 解码器，这层不用改。</p>
      </div>
    </div>
  </div>

  <div class="bpuv-sec t2">
    <h4><span class="bpuv-num">2</span>从我的 Python 到 BPU 硬件：完整调用链</h4>
    <div class="bpuv-chain">
      <div class="bpuv-layer l1">
        <div class="bpuv-lname">我的 Python 代码</div>
        <div class="bpuv-ldesc">全部入口只有一行 <code>from hbm_runtime import HB_HBMRuntime</code>，没有任何路径 hack。</div>
      </div>
      <div class="bpuv-arrow">▼</div>
      <div class="bpuv-layer l2">
        <div class="bpuv-lname">HB_HBMRuntime.so</div>
        <div class="bpuv-ldesc">pybind11 编出来的 aarch64 原生扩展，把 C++ 类暴露成 Python 类；只 NEEDED <code>libdnn.so</code>，没有 RPATH。</div>
      </div>
      <div class="bpuv-arrow">▼</div>
      <div class="bpuv-layer l3">
        <div class="bpuv-lname">libdnn.so</div>
        <div class="bpuv-ldesc">地平线 DNN 运行时，提供 <code>hbDNN*</code> C API；往下挂 libcnn_intf / libhbmem（BPU 共享内存）/ libhbrt_bayes（BPU Runtime 3.15.55）。</div>
      </div>
      <div class="bpuv-arrow">▼</div>
      <div class="bpuv-layer l4">
        <div class="bpuv-lname">Linux 内核模块</div>
        <div class="bpuv-ldesc"><code>bpu_framework</code> → <code>bpu_cores</code> → <code>bpu_hw_io_x5</code>，通过字符设备 <code>/dev/bpu_core0</code> (10,84)、<code>/dev/bpu</code> (10,85)、<code>/dev/ion</code> (10,127) 下发任务。</div>
      </div>
      <div class="bpuv-arrow">▼</div>
      <div class="bpuv-layer l5">
        <div class="bpuv-lname">BPU 硬件</div>
        <div class="bpuv-ldesc">地平线自研神经网络加速器，实测运行在 996 MHz，跑满后单帧 yolov8 约 9.8 ms。</div>
      </div>
    </div>
  </div>

  <div class="bpuv-sec t3">
    <h4><span class="bpuv-num">3</span>一张 JPEG 的完整数据流</h4>
    <div class="bpuv-flow">
      <div class="bpuv-step p1"><b>①</b><span>收到 JPEG 字节</span><em>HTTP body · 137 KB</em></div>
      <div class="bpuv-step p2"><b>②</b><span>cv2.imdecode 解码成 BGR</span><em>810 × 1080 × 3</em></div>
      <div class="bpuv-step p3"><b>③</b><span>letterbox 等比缩放 + 填 114</span><em>640 × 640 × 3</em></div>
      <div class="bpuv-step p4"><b>④</b><span>BGR → YUV_I420 → 交错 UV</span><em>packed NV12 · 614400 B</em></div>
      <div class="bpuv-step p5"><b>⑤</b><span>包成运行时要求的嵌套字典</span><em>模型名 → 输入名 → buffer</em></div>
      <div class="bpuv-step p6"><b>⑥</b><span>BPU 前向推理</span><em>HB_HBMRuntime.run()</em></div>
      <div class="bpuv-step p7"><b>⑦</b><span>按 output_quants 反量化</span><em>int32 / int8 → float32</em></div>
      <div class="bpuv-step p8"><b>⑧</b><span>head 解码 + sigmoid + NMS</span><em>DFL / 锚框</em></div>
      <div class="bpuv-step p9"><b>⑨</b><span>逆映射回原图 + JSON 返回</span><em>像素坐标 bbox</em></div>
    </div>
  </div>

  <div class="bpuv-sec t4">
    <h4><span class="bpuv-num">4</span>五个契约点：为什么这样写才能精准命中 BPU</h4>
    <div class="bpuv-cnt">
      <div class="bpuv-cnt-item"><b>① 模型形态</b><p>必须是 OpenExplorer 量化编译后的 <code>.bin</code>，BPU 不认识 .pt / ONNX。</p></div>
      <div class="bpuv-cnt-item"><b>② 张量名</b><p>input/output 名字必须运行时从 runtime 实例读，不能硬编码。</p></div>
      <div class="bpuv-cnt-item"><b>③ 输入排布</b><p><code>input_shape</code> 写 <code>[1,3,640,640]</code>，实际要喂 614400 字节的 packed NV12。</p></div>
      <div class="bpuv-cnt-item"><b>④ 量化还原</b><p>定点输出必须按逐通道 scale / zero_point 反量化，直接转 float 是错的。</p></div>
      <div class="bpuv-cnt-item"><b>⑤ 并发模型</b><p>同一 <code>.bin</code> 重复加载会被 runtime 去重，只能单实例 + 信号量 + 多线程 run。</p></div>
    </div>
  </div>

  <div class="bpuv-sec">
    <h4><span class="bpuv-num">5</span>实测性能</h4>
    <div class="bpuv-bars">
      <div class="bpuv-bar"><span class="bpuv-bl">yolov8 纯 BPU（1 线程）</span><span class="bpuv-bt"><i class="bpuv-bf" style="width:100%"></i></span><span class="bpuv-bv">100 FPS</span></div>
      <div class="bpuv-bar"><span class="bpuv-bl">yolov5s_v6 纯 BPU</span><span class="bpuv-bt"><i class="bpuv-bf" style="width:50%"></i></span><span class="bpuv-bv">49.8 FPS</span></div>
      <div class="bpuv-bar"><span class="bpuv-bl">yolo11m 纯 BPU</span><span class="bpuv-bt"><i class="bpuv-bf" style="width:25%"></i></span><span class="bpuv-bv">25.0 FPS</span></div>
      <div class="bpuv-bar g2"><span class="bpuv-bl">板上端到端 4 并发</span><span class="bpuv-bt"><i class="bpuv-bf" style="width:38%"></i></span><span class="bpuv-bv">37.9 req/s</span></div>
      <div class="bpuv-bar g3"><span class="bpuv-bl">跨 ZeroTier 4 并发</span><span class="bpuv-bt"><i class="bpuv-bf" style="width:14%"></i></span><span class="bpuv-bv">14.2 req/s</span></div>
    </div>
    <p style="font-size:12.5px;color:#5b6b82;margin:11px 0 0">BPU 是单核的：线程数 1 → 4 时吞吐几乎不变（100 → 99.4 FPS），但单帧延迟从 9.8 ms 涨到 30 ms，多出来的线程全在排队。跨 ZeroTier 的差距几乎全部来自网络传输（137 KB 走公网虚拟局域网），不是算力问题。</p>
  </div>

  <div class="bpuv-sec t5">
    <h4><span class="bpuv-num">6</span>两张图的实测结果</h4>
    <div class="bpuv-grid">
      <div class="bpuv-card">
        <h5>bus.jpg · 810×1080 · 官方 COCO 测试图</h5>
        <table class="bpuv-table">
          <tr><th>模型</th><th>主要结果</th><th>耗时</th></tr>
          <tr><td>yolo11m</td><td>bus 0.93 · person 0.90/0.90/0.89/0.78</td><td>43.2 ms</td></tr>
          <tr><td>yolov12n</td><td>bus 0.86 · person 0.82/0.78/0.75</td><td>25.4 ms</td></tr>
          <tr><td>yolov8</td><td>bus 0.82 · person 0.74/0.69/0.67</td><td>10.0 ms</td></tr>
          <tr><td>yolov5s_v6</td><td>person 0.78/0.77/0.72 · bus 0.74</td><td>20.2 ms</td></tr>
          <tr><td>mobilenetv2</td><td>分类 minibus 0.48</td><td>2.6 ms</td></tr>
        </table>
      </div>
      <div class="bpuv-card">
        <h5>扣篮照 · 1279×1920 竖图</h5>
        <table class="bpuv-table">
          <tr><th>设置</th><th>主要结果</th><th>耗时</th></tr>
          <tr><td>yolo11m + stretch</td><td>扣篮者 0.86 · 篮下球员 0.77 · 场边 4 人 0.68/0.56/0.54/0.45</td><td>38.5 ms</td></tr>
          <tr><td>yolo11m + letterbox</td><td>最高只有 0.65（竖图被压小）</td><td>38.1 ms</td></tr>
          <tr><td>mobilenetv2</td><td>分类 scoreboard 0.54</td><td>2.4 ms</td></tr>
          <tr><td>googlenet</td><td>scoreboard 0.12 · ballplayer 0.08</td><td>3.1 ms</td></tr>
        </table>
        <p style="margin-top:9px;font-size:12.5px;color:#5b6b82">关键教训：竖图必须用 <span class="bpuv-kbd">resize=stretch</span>，letterbox 会把它缩成 640×426、上下填黑边，目标置信度从 0.86 掉到 0.65。</p>
      </div>
    </div>
  </div>

  <div class="bpuv-sec t4">
    <h4><span class="bpuv-num">7</span>你问过的问题，一次说清</h4>
    <div class="bpuv-qa">
      <div class="bpuv-q">
        <h5>X5 的 BPU 可以拿来做什么？</h5>
        <p>四类事：<strong>目标检测</strong>（YOLO 全家族、SSD、FCOS、CenterNet）、<strong>图像分类</strong>（MobileNet / ResNet / GoogLeNet / EfficientNet）、<strong>语义分割</strong>（DeepLabv3+、STDC）、<strong>多模态大模型</strong>（CLIP 文本编码、LLaMA.cpp）。核心优势是比 CPU 高一个量级的算力、只有几瓦功耗。</p>
      </div>
      <div class="bpuv-q">
        <h5>没有摄像头、麦克风、扩音器，还能做什么？</h5>
        <p>实测确认 <code>/dev/video*</code> 不存在、采集到的音频是饱和噪声、也没有显示设备，所以"感知输入"这条腿断了。但可以当<strong>纯算力服务器</strong>：网络推理服务、离线批量处理、边缘计算节点，以及 GPIO/I2C/SPI/UART 的传感器控制类项目。</p>
      </div>
      <div class="bpuv-q">
        <h5>代码是怎么精准调用到 BPU 的？</h5>
        <p>不是猜路径，是<strong>分层调用 + 五个契约点</strong>：Python 只 import 官方 <code>hbm_runtime</code>，它用 pybind11 包住 <code>libdnn.so</code>，再往下是 hbrt、内核模块、<code>/dev/bpu_core0</code>。真正难的不是调用，是让输入排布、张量名、量化参数都符合运行时约定。</p>
      </div>
      <div class="bpuv-q">
        <h5>是地平线封装了官方 Python 库吗？</h5>
        <p>是。<code>hobot-dnn</code> 提供底层 <code>libdnn</code> / <code>libhbrt</code>；<code>hobot-spdev</code> 提供 Python wheel（<code>hbm_runtime-3.0.9-py3-none-any.whl</code>），安装时由 postinst 自动 <code>pip3 install</code> 到 dist-packages。不是我写的，也不是第三方。</p>
      </div>
      <div class="bpuv-q">
        <h5>代码怎么找到官方封装的库的？</h5>
        <p>没有任何路径 hack。<strong>Python 层</strong>靠 dist-packages 本来就在 <code>sys.path</code> 里；<strong>原生库层</strong>靠 <code>/etc/ld.so.conf.d/</code> 下地平线装的配置 + ldconfig 缓存，而 <code>HB_HBMRuntime.so</code> 自己不写 RPATH。我代码里只有一行懒加载 import。</p>
      </div>
      <div class="bpuv-q">
        <h5>代码在哪里？量大吗？</h5>
        <p>开发副本在 <code>dg-bpu-service/</code>，部署在 <code>dg:/opt/bpu-service/</code>，systemd 托管。服务本体 <strong>1430 行</strong>，加测试与工具共 <strong>1731 行</strong>；没有 Web 框架、没有数据库、没有前端构建链。</p>
      </div>
    </div>
  </div>

  <div class="bpuv-sec t5">
    <h4><span class="bpuv-num">8</span>踩过的坑</h4>
    <div class="bpuv-pit">
      <div><b>01</b>input_shape 写 [1,3,640,640]，实际要喂 packed NV12。</div>
      <div><b>02</b>同一 .bin 重复加载被 runtime 去重，拿不到第二个句柄。</div>
      <div><b>03</b>YOLOv5 head 是 255 = 3×(5+80)，类别数要除以 3。</div>
      <div><b>04</b>板载分类模型输出已过 softmax，再算一次置信度塌到 0.002。</div>
      <div><b>05</b>竖图 letterbox 掉点，改 stretch 后 0.65 → 0.86。</div>
      <div><b>06</b>全量 sigmoid 后处理 35 ms，用单调性预筛降到 5 ms。</div>
      <div><b>07</b>YOLOv8 box 分支是 int32 + 逐通道 scale，不反量化框全乱。</div>
      <div><b>08</b>板端 hbrt 3.15.55 与部分模型 build 版本不一致，只告警不影响结果。</div>
    </div>
  </div>

  <div class="bpuv-concl">
    <h4>结论</h4>
    <p>X5 的 BPU 在没有摄像头、麦克风、屏幕的情况下，依然可以作为一个高性价比的边缘 AI 算力节点：<code>图片进、结果出</code>。整套服务 1430 行纯标准库 Python，把 CPU（预处理 + 后处理）和 BPU（前向推理）的分工划清楚，就能稳定跑出 yolov8 单帧 9.8 ms、端到端 52 ms 的成绩。真正的门槛不在"调用 BPU"，而在理解它的五个数据契约。</p>
  </div>

</div>

## 附：原生 Markdown 嵌入 HTML 的实测结论

这次实验的目标是搞清楚「怎么把 HTML 放进 Markdown 里，并真的让别人看到」。

**做法**：把一整段自包含 HTML（`<style>` + `<div>`，无 JavaScript、无外部图片/字体/CDN）直接写在 Markdown 正文里。块级 HTML 标签必须顶格起行，中间不要用 Markdown 语法包裹它。

**结论一：博客侧可以渲染（可用）。**
博客是 Jekyll，`_config.yml` 里 `markdown: kramdown` + `kramdown.input: GFM`。kramdown 在 GFM 模式下会把块级原生 HTML 原样透传，不做转义。导入脚本 `import_personal_assistant_notes.py` 也只是把笔记原文照搬进 `_posts/`，没有任何 HTML 转义逻辑，所以内嵌 HTML 能一路走到最终页面。

**结论二：飞书文档侧不能渲染（会丢）。**
`lark-cli docs +create --doc-format markdown` 走的是飞书的 Markdown → 文档块转换，实测结果是：

| 写法 | 飞书导入后 |
| --- | --- |
| `<div style="...">...</div>` | 标签被丢弃，只剩里面的纯文本 |
| `<b>` / `<p>` | 被当作飞书 XML 富文本节点处理 |
| `<style>.x{...}</style>` | 样式被当成普通文字原样保留（很难看） |
| `<table><tr><td>` | 被识别并转成 Markdown 表格 |

所以**同一篇笔记里混大量原生 HTML，会让飞书那边的文档变得很乱**。这次的做法是拆成两篇：文字版走飞书 + 博客，HTML 可视化版只在博客。

**结论三：Jekyll 的 Liquid 是隐藏地雷。**
Jekyll 在 Markdown 渲染**之前**会先跑一遍 Liquid 模板引擎，所以正文里任何成对的双花括号（Liquid 的输出语法）或「花括号 + 百分号」（Liquid 的标签语法）都会在渲染前被当成模板求值，轻则内容消失、重则整站构建失败。写代码示例（尤其是嵌套字典字面量）或 CSS 时特别容易踩到。规避方式有两种：一是内容里干脆不出现这两个序列；二是用 Liquid 自带的 raw / endraw 标签把整段包起来，标签只对博客侧生效，飞书侧会看到标签本身。

**结论四：必须无 JavaScript。**
kramdown 对 `<script>` 的处理不稳定，而且博客正文里塞脚本既没必要也不安全。这次的可视化全部用纯 CSS 实现：分层图用带色边框的卡片 + `<div>▼</div>`，条形图用百分比宽度的 `<i>`，响应式用 `@media`。这样任何 Markdown 渲染器都不会把它拆坏。

**可复用的模板骨架**：

```html
<style>
.viz-wrap{ /* 所有样式必须自带命名空间前缀，避免和博客主题冲突 */ }
</style>

<div class="viz-wrap" markdown="0">
  <h3>标题</h3>
  <p>正文……</p>
</div>
```

三个要点：样式类名加统一前缀（这次用 `bpuv-`）、`markdown="0"` 提示渲染器不要解析内部内容、整段 HTML 里不要出现成对的双花括号或 Liquid 标签语法。
