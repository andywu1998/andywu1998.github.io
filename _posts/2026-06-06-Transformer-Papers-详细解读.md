---
layout: post
title: "Transformer Papers 详细解读"
subtitle: "Codex 个人助理沉淀"
date: 2026-06-06 19:39:14 +0800
tags:
  - "个人助理"
  - "读书笔记"
  - "Transformer Papers"
---

> 来源：`notes/books/Transformer Papers/01_详细解读.md`
# Transformer Papers 详细解读

## 核心结论

这一组论文讲的是同一条技术主线：Transformer 把序列建模的核心从“按时间递推”改成“基于注意力的全局信息路由”，随后研究重心从架构本身转向预训练、规模化、上下文长度、任务统一和跨模态迁移。

最重要的变化不是某一个模块，而是范式迁移：

1. `Attention Is All You Need` 证明了不用 RNN/CNN，也可以用自注意力加前馈网络完成高质量序列到序列建模。
2. BERT 证明了 Transformer encoder 可以通过大规模自监督预训练，成为通用语言理解底座。
3. GPT-2 证明了 Transformer decoder 只靠语言模型目标和规模，也能产生明显的零样本/弱监督任务能力。
4. Transformer-XL 解决固定长度上下文的问题，把 Transformer 推向更长依赖建模。
5. T5 把 NLP 任务统一为 text-to-text，系统比较预训练目标、数据、模型和迁移策略。
6. ViT 证明 Transformer 不只属于文本；当图像被切成 patch 序列，纯 Transformer 也可以在视觉任务上成立，但它更依赖大规模预训练。

如果要抓住 Transformer 的本质，可以用一句话概括：它是一种可并行、可扩展、可迁移的信息混合架构；后续大模型的成功，主要来自这个架构和大规模自监督数据、算力、任务格式统一之间的配合。

## 论文包范围

本次处理 6 篇论文：

- `Attention Is All You Need`：Transformer 原始架构。
- `BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding`：双向 encoder 预训练与微调。
- `Language Models are Unsupervised Multitask Learners`：GPT-2，decoder-only 语言模型与零样本迁移。
- `Transformer-XL: Attentive Language Models Beyond a Fixed-Length Context`：长上下文、段级循环和相对位置编码。
- `Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer`：T5，统一 text-to-text 框架和系统性迁移学习实验。
- `An Image is Worth 16x16 Words`：ViT，把图像 patch 当作 token 序列。

PDF 原文与全文 Markdown 转换稿保存在 `source_materials/`。

## 技术主线

### 1. Transformer 原始架构：把序列建模变成注意力路由

`Attention Is All You Need` 的关键判断是：序列转导模型不一定需要循环结构。传统 seq2seq 依赖 RNN 或 CNN 建模 token 间关系，注意力通常只是编码器和解码器之间的附加机制。Transformer 直接把注意力放到架构中心，用 multi-head self-attention 让每个 token 在每一层都可以和其他 token 建立关系。

核心模块：

- Scaled dot-product attention：用 query、key、value 计算 token 间相关性。
- Multi-head attention：把注意力拆成多个子空间，允许模型同时关注不同关系。
- Position-wise feed-forward network：每个位置共享的非线性变换。
- Positional encoding：补回自注意力本身不具备的顺序信息。
- Encoder-decoder 堆叠：encoder 表示输入，decoder 自回归生成输出。

真正的工程价值在于并行化。RNN 的时间步依赖限制训练并行度，而 Transformer 可以一次处理整个序列。代价是注意力复杂度随序列长度平方增长，因此后续才会出现大量长上下文优化。

### 2. BERT：把 Transformer encoder 变成语言理解底座

BERT 的核心是“深度双向表示”。它使用 Transformer encoder，不做自回归生成，而是在预训练阶段让模型同时利用左右上下文。

两个预训练任务：

- Masked Language Modeling：随机遮住一部分 token，让模型根据上下文预测。
- Next Sentence Prediction：判断两个句子是否相邻，用于学习句间关系。

BERT 的重要性不只在分数提升，而在工作流变化：下游任务不再需要为每个任务设计复杂架构，通常只需在预训练模型上加一个很小的输出层并微调。这建立了“预训练模型 + 任务微调”的标准范式。

局限也很清楚：

- MLM 的 mask 分布和真实下游输入存在不一致。
- encoder-only 不适合自然自回归生成。
- NSP 后来被一些工作证明并非总是必要。

### 3. GPT-2：decoder-only 语言模型的规模化能力

GPT-2 走的是另一条路线：不显式做任务监督，不用任务专用格式，而是把网页文本中的自然任务描述和回答看作隐式监督。模型目标仍然是 next-token prediction，但随着数据和参数规模扩大，模型出现跨任务泛化能力。

关键点：

- 使用 decoder-only Transformer。
- 在 WebText 上训练，数据来自高质量网页文本。
- 通过提示和上下文完成问答、摘要、翻译等任务。
- 论文强调容量对零样本任务迁移很关键，模型越大，跨任务表现越好。

GPT-2 的意义是把“语言建模”从一个基础任务提升为通用接口。后来的 instruction tuning、RLHF、chat model，本质上都是在这个 decoder-only 生成范式上继续增加对齐和交互能力。

### 4. Transformer-XL：突破固定上下文窗口

标准 Transformer 在语言建模时通常把长文本切成固定长度片段，每个片段内部自注意力，但片段之间没有连续状态。这会带来两个问题：

- 长程依赖被截断。
- 片段边界附近的 token 缺少前文上下文，形成 context fragmentation。

Transformer-XL 的解决方案：

- Segment-level recurrence：把前一个片段的 hidden states 缓存为 memory，供当前片段注意力读取。
- Relative positional encoding：避免绝对位置编码在跨片段复用 hidden states 时产生位置混乱。

它让 Transformer 更像有记忆的模型，同时保留比 RNN 更强的并行性。这个方向后来延伸到长上下文 Transformer、缓存 KV、相对位置、旋转位置编码等一系列工作。

### 5. T5：把所有 NLP 任务统一成 text-to-text

T5 的贡献不只是一个模型，而是一套实验框架。它把分类、问答、摘要、翻译等任务都改写成“输入文本到输出文本”的形式，例如输入里加任务前缀，输出统一由文本生成。

关键贡献：

- 统一任务格式：text-to-text。
- 系统比较 encoder-decoder、decoder-only、language modeling、span corruption 等设置。
- 使用 C4 数据集进行大规模预训练。
- 强调模型、数据、目标和迁移策略共同决定效果。

T5 对实践很有指导意义：当任务可以统一成文本生成，工程系统会变得简单。今天很多 LLM 应用把检索、分类、抽取、改写、规划都包装成 prompt，本质上沿用了这种任务统一思想。

### 6. ViT：Transformer 跨入视觉

ViT 的基本做法很直接：把图片切成固定大小 patch，每个 patch 展平成向量后映射成 token，再加位置编码，送入标准 Transformer encoder。

关键判断：

- CNN 的卷积归纳偏置不是视觉建模的绝对必要条件。
- 当预训练数据足够大时，纯 Transformer 可以学到有效视觉表示。
- 在中小数据集上直接训练 ViT 通常不如 CNN，说明它更依赖数据规模。

ViT 的意义是把 Transformer 从 NLP 架构扩展为通用序列建模架构。图片、音频、视频、代码、蛋白质、机器人轨迹，只要能被组织成 token 或 patch 序列，就可以进入类似框架。

## 横向对比

| 论文 | 架构重点 | 训练目标 | 解决的问题 | 后续影响 |
| --- | --- | --- | --- | --- |
| Attention Is All You Need | encoder-decoder self-attention | 监督翻译 | 去掉 RNN/CNN，提高并行化 | Transformer 基础架构 |
| BERT | encoder-only | MLM + NSP | 通用语言理解表示 | 预训练 + 微调范式 |
| GPT-2 | decoder-only | next-token prediction | 零样本/弱监督任务迁移 | 生成式大语言模型路线 |
| Transformer-XL | decoder with memory | language modeling | 长上下文和片段断裂 | 长上下文建模、缓存机制 |
| T5 | encoder-decoder | span corruption + text-to-text | 统一 NLP 任务格式 | text-to-text、prompt 化任务 |
| ViT | encoder-only over image patches | 图像分类预训练/迁移 | Transformer 迁移到视觉 | 多模态 Transformer |

## 学习顺序建议

1. 先读 `Attention Is All You Need` 的第 3 节，理解 self-attention、multi-head attention、position encoding、encoder-decoder。
2. 再读 BERT，重点看为什么 encoder 适合理解任务，以及 MLM 如何构造自监督信号。
3. 再读 GPT-2，重点看 decoder-only、next-token prediction 和零样本迁移之间的关系。
4. 然后读 Transformer-XL，理解标准 Transformer 固定上下文的限制。
5. 读 T5 时不要逐页啃完，优先看任务统一、实验结论和 ablation。
6. 最后读 ViT，把 Transformer 看成通用 token 混合器，而不是 NLP 专用架构。

## 关键概念卡片

### Self-Attention

每个 token 根据自身 query 去匹配其他 token 的 key，再加权汇总 value。它解决的是“当前位置应该从哪些位置取信息”的问题。

### Multi-Head Attention

多个注意力头并行工作，每个头学习不同关系。例如一个头关注局部语法，一个头关注长程指代，一个头关注结构边界。注意这只是直觉解释，实际头的语义不总是稳定可解释。

### Positional Encoding

自注意力对输入顺序天然不敏感，所以必须注入位置信息。早期用 sinusoidal 或 learned absolute position，后续长上下文模型大量使用相对位置、RoPE 等变体。

### Encoder-Only / Decoder-Only / Encoder-Decoder

- Encoder-only：适合理解、分类、检索、抽取，代表 BERT。
- Decoder-only：适合自回归生成和开放式任务接口，代表 GPT 系列。
- Encoder-decoder：适合输入输出都较复杂的转换任务，代表 T5、翻译模型。

### Pretraining and Fine-tuning

先用大规模无标注数据学通用表示，再用小规模标注数据适配任务。BERT 把这个范式推成主流，T5 系统化比较了多种迁移学习设置。

### Scaling

GPT-2 和后续 GPT-3 路线表明，模型容量、数据规模和训练计算量会显著影响泛化能力。Transformer 架构的并行性是 scaling 能跑起来的重要前提。

## 对今天大模型的启发

1. 架构只是起点。Transformer 原始论文解决了并行序列建模，真正释放能力的是后续预训练数据、目标函数、规模化和任务接口。
2. 任务格式会改变系统复杂度。BERT 统一成微调，T5 统一成 text-to-text，GPT 统一成 prompt + next-token generation。
3. 长上下文不是简单扩大窗口。Transformer-XL 提醒我们，位置编码、memory 复用、片段边界和推理效率都要一起处理。
4. 跨模态的关键是 token 化。ViT 的启发是，只要能把输入变成序列，Transformer 就能作为通用混合器。
5. 归纳偏置和数据规模互相替代。CNN 在小数据上更强，是因为视觉归纳偏置更合适；ViT 在大数据上更强，是因为模型可以从数据中学习这些结构。

## 可执行学习计划

### 第 1 天：架构

- 精读 `Attention Is All You Need` 第 3 节。
- 手画一遍 Q/K/V、multi-head attention、encoder layer、decoder layer。
- 输出一个问题：为什么 attention 复杂度是 O(n^2)？

### 第 2 天：语言理解与生成

- 对比 BERT 和 GPT-2。
- 写出 encoder-only 和 decoder-only 的差异表。
- 用一个例子说明 MLM 和 next-token prediction 的训练信号差异。

### 第 3 天：长上下文

- 阅读 Transformer-XL 的 segment recurrence 和 relative positional encoding。
- 总结标准 Transformer 为什么不能直接复用上一段 hidden states。

### 第 4 天：任务统一

- 阅读 T5 的 text-to-text 框架。
- 选 5 个任务，把它们改写成 text-to-text 输入输出格式。

### 第 5 天：跨模态

- 阅读 ViT 的 patch embedding。
- 用一句话解释为什么图像 patch 可以类比文本 token。
- 思考：如果是音频、视频、时间序列，应如何 token 化？

## 待验证问题

- 这一组只覆盖主线论文，没有覆盖 GPT-3、RoPE、FlashAttention、PaLM、LLaMA、MoE、LoRA、RAG 等后续关键工作。
- T5 论文较长，本笔记先抽取主线结论；如果要做研究级复现，需要单独拆解实验设置。
- ViT 的结论强依赖预训练数据规模，不应简单理解为“Transformer 总是优于 CNN”。

## 下一步动作

- 继续补一组“现代 LLM 工程论文”：GPT-3、Chinchilla、InstructGPT、LoRA、FlashAttention、RoPE、LLaMA、RAG。
- 如果目标是工程实现，下一步应做一个最小 Transformer notebook：从 Q/K/V attention 到 decoder-only 语言模型。
- 如果目标是读论文，应把本论文包拆成 6 张方法卡，每篇论文一张。
