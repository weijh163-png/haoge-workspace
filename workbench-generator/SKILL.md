---
name: workbench-generator
description: 基于《浩哥工作台》v2.2 真实模板的可复用单文件工作台生成器（2.0 版本）。当用户想要"以浩哥工作台为模板生成自己的工作台/从我的版本生成各种版本/换个岗位换套数据/换标题换品牌换存储key但保留同一套界面与 archify 流程图复盘引擎"时使用。输入 JSON 配置，输出可离线双击打开、localStorage 持久化的自包含 HTML；数据与模板一致时逐字节保留原样，仅替换用户改动部分。
---

# workbench-generator（浩哥工作台生成器）

## 定位

以《浩哥工作台》（收入核算版，2520 行单文件，含 7 大模块 + archify 流程图复盘引擎 + 天青烟雨视觉）为**模板基底**，由 JSON 配置驱动生成新的单文件工作台。不是自造简化外壳，而是"从浩哥的版本生成各种版本"：界面、引擎、视觉全部复用，只换配置里写明要换的部分。

## 目录结构

```
workbench-generator/
├── template/浩哥工作台.html       # 模板基底（浩哥原版，勿随意改动）
├── config/
│   ├── haoge-workbench.json       # 默认配置（模板自身，含 _orig 逐字节基线）
│   └── demo-config.json           # 示例配置（换壳 + 换 NOTICES）
├── examples/demo-成本会计工作台.html  # 生成的示例产物
└── scripts/
    ├── extract_defaults.cjs       # 提取模板 14 个数据常量 + meta → 配置基线
    └── generate.py                # 生成器主引擎
```

## 使用流程

### 1. 提取模板基线（改动模板后或首次使用）

```bash
node scripts/extract_defaults.cjs --input template/浩哥工作台.html --output config/haoge-workbench.json
```

生成含 `meta` / `data`（14 个数据常量的真实值）/ `_orig`（各常量的逐字节 JSON 文本）的基线配置。
**不要手工编辑 `_orig`**：它是"与模板一致则保留原文"的比对依据。

### 2. 编写新配置

复制 `config/haoge-workbench.json` 为新文件，改两个部分：

- `meta`（页面文案/品牌/考试/存储 key）：
  - `title` 页面标题、`brand`/`brandSub` 顶部品牌、`periodNote` 副标题
  - `examHomeName`/`examHomeDate`(YYYY-MM-DD)/`examHomeRange` 首页考试倒计时
  - `exams` 弹窗内的考试列表 `[{id,name,date,text}, ...]`
  - `storageKey`/`legacyStorageKey` 业务状态 key（**必须换**，否则多份工作台互相覆盖）
  - `fcReviewKey`/`fcReviewsLegacyKey` 流程图复盘 key、`backupPrefix`/`backupAppId` 备份命名
- `data`（数据常量，只写要改的，未写的保持模板原样）：
  - `MONTHLY_TASKS` 月度任务 `[{day,tasks:[{t,pri}]}]`（pri: high/mid/low）
  - `NOTICES` 注意事项 `[{title,body}]`
  - `TAX_COMPANIES` 税务申报公司、`REPORTS` 报表清单、`DAILY_ROUTINES` 日常例行
  - `CHECK_GROUPS` 复核勾选分组、`PROJECTS` 项目台账、`PROJECT_STATUS` 项目状态字典
  - `ZAKOU_COMPANIES` 扎口公司、`TAX_DIFFS` 税务差异、`UNRESOLVED` 未了事项
  - `FC_DEFAULT_IR` archify 流程图(JSON IR，schema_version 2)、`FC_TYPE_COLORS`/`FC_DARK_COLORS` 泳道配色
  - 字段一律用**单引号**风格无关紧要——生成器按 JSON 值渲染，与模板一致时保留原文

### 3. 生成

```bash
python scripts/generate.py --template template/浩哥工作台.html --config config/你的配置.json --out examples/你的工作台.html
```

输出：单文件 HTML，双击离线可用；业务状态存 localStorage（key 为配置的 storageKey）。

### 4. 验证（交付前必做）

```bash
# JS 语法：抽取 <script> 逐块 node --check
# 标签配平：div/section/details/summary/dialog 开闭计数
# 无头渲染：
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-sandbox \
  --dump-dom --virtual-time-budget=5000 "file:///路径/你的工作台.html" | 检查关键替换与模块渲染
# 默认配置回归：生成结果应与模板逐字节一致（cmp 验证）
```

## 设计约束（继承浩哥工作台）

- **visual / 视觉**：天青烟雨（雾青背景、毛玻璃雨滴、白雾），尊重 `prefers-reduced-motion`；改造生成器时不得剥离视觉层
- **storage**：只存 localStorage，**不得改云端同步**
- **数据红线**：真实业务数据在 `haoge-src/交付/`；对外产出前先与用户确认是否移除
- **界面约束**：不出现"复核：谢苗苗""填报：收入核算科"，"位军浩"显示为"浩哥"；紧凑清爽风
- **archify**：流程图复盘引擎（`fcInitEditor`/`fcInitReviewMonth`/`fcInit`）是模板资产，配置里通过 `FC_DEFAULT_IR` 换数据，不动引擎代码