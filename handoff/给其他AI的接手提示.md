# 给其他 AI 的接手提示

请维护公开仓库 `https://github.com/weijh163-png/haoge-workspace`，默认发布分支为 `main`，线上页面为 `https://weijh163-png.github.io/haoge-workspace/`。

开始前请先阅读：

- `handoff/从这里开始.md`
- `handoff/项目状态与架构.md`
- `handoff/测试与部署清单.md`
- `docs/superpowers/specs/` 下三份税务学习相关设计文档

工作原则：

1. 保持现有工作台结构和已有业务功能，不用旧备份覆盖根目录 `index.html`。
2. 税务师三科为税法一、税法二、涉税服务实务；三科在工作台内部打开，并可通过学习页固定顶部栏直接切换。
3. 每科保留今日学习、完整知识树、5 道练习题、错题本、四阶段计划、大纲说明和备查资料。
4. 三科进度使用独立浏览器存储键：`tax1state`、`tax2state`、`taxPracticeState`。
5. 用户提供的四份辅导 PDF 不在交接包中。不得自行上传 PDF、二维码、营销页或版权资料到 GitHub。
6. 第三方政策目录仅作线索，学习内容与备查链接应优先核验协会、税务总局、财政部、中国政府网等官方来源。
7. 不要把 Personal Access Token、密码、授权头、浏览器记录或本地绝对路径写入源码、文档、日志或提交历史。
8. 修改后运行全部回归；需要推送时使用环境已有的 GitHub 登录状态。若未认证，请让用户在本机完成认证，不要让用户在对话中发送令牌。

当前实现是纯静态站点，无构建步骤。新增文件必须使用相对路径，确保 GitHub Pages 子路径 `/haoge-workspace/` 下可用。

