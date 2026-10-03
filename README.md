# Naimore3-s-Learning-Notes

A BUPTer studying CS records useful knowledge learned in class and in daily life.

## 给 AI 代理的工作须知

当前正在重构首页前端。开工前必须按顺序阅读以下设计文档：

1. [前端框架与目录耦合规则](.documents/前端框架规则.md)
2. [首页场景设计概述](.documents/首页设计/场景设计概述.md)
3. 涉及具体楼层时，阅读对应的 `.documents/首页设计/第 N 层 * 设计.md`

未读完上述文档前，不要直接修改 `docs/index.md`、`docs/javascripts/`、
`docs/stylesheets/` 或 `mkdocs.yml`。

- 文件放置、模块边界和注册路径以 `前端框架规则.md` 为准。
- 视觉方向、楼层方向、房间解剖式形态以 `场景设计概述.md` 为准。
- 本项目不再使用 `.codex/PROJECT.md`；该文件已删除，不要引用它。
- UI 改动完成后至少执行一次 `conda run -n naimore3-docs mkdocs build`。
