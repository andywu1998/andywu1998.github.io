---
layout: post
title: "Source Images"
subtitle: "Codex 个人助理沉淀"
date: 2026-09-08 22:42:21 +0800
tags:
  - "个人助理"
  - "项目"
  - "domain_chip_installation_rankings"
---

> 来源：`notes/projects/domain_chip_installation_rankings/source_images/README.md`
# Source Images

本项目原图为 NE时代榜单截图（2026 年 1-2 月至 7 月），已归档为本地文件：

- `2026-01-02_domain_chip_installation.jpg`：2026年1-2月域控芯片装机量
- `2026-03_domain_chip_installation.jpg`：2026年3月域控芯片装机量
- `2026-04_domain_chip_installation.jpg`：2026年4月域控芯片装机量（用户更正后版本，数据采用此图）
- `2026-05_domain_chip_installation.jpg`：2026年5月域控芯片装机量
- `2026-06_domain_chip_installation.jpg`：2026年6月域控芯片装机量
- `2026-07_domain_chip_installation.jpg`：2026年7月域控芯片装机量

可复用的结构化源数据见：

- `../data/domain_chip_source_data.csv`
- `../data/domain_chip_rank_table_chart_data.csv`

下次有新图时，优先把原图保存到本目录，命名格式：

- `YYYY-MM_domain_chip_installation.jpg`（两个月合计用 `YYYY-01-02`）

然后更新 `../data/domain_chip_source_data.csv` 与 `../scripts/generate_rank_table_chart.js` 中的 `periods` 和 `data`。
