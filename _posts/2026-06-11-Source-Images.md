---
layout: post
title: "Source Images"
subtitle: "Codex 个人助理沉淀"
date: 2026-06-11 22:27:34 +0800
tags:
  - "个人助理"
  - "项目"
  - "domain_chip_installation_rankings"
---

> 来源：`notes/projects/domain_chip_installation_rankings/source_images/README.md`
# Source Images

本项目原图来自 2026-06-11 当前对话中用户上传的 NE时代榜单截图：

- 2026年1-2月域控芯片装机量
- 2026年3月域控芯片装机量
- 2026年4月域控芯片装机量（用户后续更正版本）

当前运行环境没有为对话图片附件暴露可复制的本地文件路径，因此本目录暂未保存原图二进制文件。已保存的可复用源数据见：

- `../data/domain_chip_source_data.csv`
- `../data/domain_chip_rank_table_chart_data.csv`

下次有新图时，优先把原图文件保存到本目录，命名建议：

- `2026-01-02_domain_chip_installation.png`
- `2026-03_domain_chip_installation.png`
- `2026-04_domain_chip_installation.png`
- `2026-05_domain_chip_installation.png`

然后更新 `../data/domain_chip_source_data.csv` 与 `../scripts/generate_rank_table_chart.js` 中的 `periods` 和 `data`。
