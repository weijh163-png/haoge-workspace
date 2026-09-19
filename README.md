# 浩哥工作台 · 在线版部署包

单文件 HTML 工作管理系统，专为餐饮成本会计月度工作设计。

## 功能模块

- **Dashboard**：今日待办、月度节奏、考试倒计时、本月重点
- **月度工作流程**：1–4日交报表 / 5–10日统计申报 / 11–25日跟进 / 26–月底收口
- **报表 & AI**：七份月报进度追踪、提交前检查、AI 辅助注意事项
- **项目台账**：21 个项目收入进度管理，支持自定义增删项目
- **流程图与复盘**：Archify 风格月度流程图、复盘记录
- **扎口与未了**：月末平账、资金核对

## 数据持久化

- 默认使用浏览器 `localStorage`（`haoge_workspace_v3`）
- 换设备/浏览器数据不共享，建议每月导出 JSON 备份
- 如需跨设备同步，需接入后端数据库（见进阶方案）

## 快速部署

### 方案一：GitHub Pages（推荐 · 免费公网）

1. 登录 [github.com](https://github.com)，新建仓库（如 `haoge-workspace`）
2. 上传本目录的 `index.html`
3. 进入仓库 Settings → Pages → Source 选择 `main` 分支
4. 等待 1–2 分钟，访问 `https://你的用户名.github.io/haoge-workspace/`

### 方案二：Vercel（推荐 · 自动部署）

1. 登录 [vercel.com](https://vercel.com)，导入 GitHub 仓库
2. 框架预设选 `Other`，默认即可
3. 自动获得 `https://haoge-workspace.vercel.app`

### 方案三：Cloudflare Pages（推荐 · 国内访问快）

1. 登录 [dash.cloudflare.com](https://dash.cloudflare.com)
2. Pages → 创建项目 → 上传 `index.html`
3. 自动获得 `https://haoge-workspace.pages.dev`

### 方案四：局域网预览（本地快速体验）

```bash
# 在本目录执行
python -m http.server 8080
# 浏览器访问 http://localhost:8080
```

## 进阶：跨设备数据同步

如需多设备共享数据，需接入后端。推荐轻量方案：

- **Supabase**（免费 PostgreSQL + 实时订阅）
- **Cloudflare Workers + D1**（边缘函数 + SQLite）
- **Firebase Firestore**（Google 免费额度）

> 注意：财务数据敏感，启用云同步前务必配置访问控制（如密码保护、IP 白名单）。

## 版本

- 当前版本：v2.1
- 最后更新：2026-09-16
- Git commit：`c183251`
