# Design

## Context

仓库当前只有流水线骨架，`app/` 目录为空；E2E 通过 `node e2e/server.mjs` 把 `app/` 作为静态站点托管在 `http://127.0.0.1:4173`，Playwright 用 `page.goto('/')` 访问。约束是纯静态页面 + 浏览器本地存储，不引入后端。动机见 `proposal.md - Why`，可观测行为见三个 delta spec。

## Goals / Non-Goals

**Goals:**
- 用最少的原生前端技术（HTML/CSS/JavaScript，`localStorage`）交付可交互的单页应用。
- 三个模块各自独立存储键，互不干扰。
- 每个模块的增删改查都有稳定的 DOM 标识，便于 E2E 选择器定位。

**Non-Goals:**
- 不引入前端框架、构建工具、CSS 预处理器或第三方运行时依赖。
- 不实现账号、同步、导出、搜索、拖拽排序等超出需求的功能。
- 不做服务端数据备份或跨设备同步。

## Decisions

- **单文件或多文件结构**：采用 `app/index.html` + `app/styles.css` + `app/app.js` 的分离结构，页面结构、样式、逻辑各司其职；不采用内联单文件，便于阅读与维护。
- **数据存储**：使用 `localStorage` 分别以 `todos`、`notes`、`quickLinks` 三个键保存 JSON 数组；不采用 `sessionStorage` 或 IndexedDB，因为需求是跨会话本地持久化且数据量小。
- **数据模型**：待办用 `{ id, text, done }`；笔记用 `{ id, content, updatedAt }`；快捷链接用 `{ id, name, url }`；`id` 用 `crypto.randomUUID()`（不支持时回退到时间戳 + 随机数）。
- **渲染方式**：每次状态变更后重渲染对应模块列表，数据以内存数组为唯一数据源，先更新内存再写 `localStorage` 再渲染；不采用细粒度 DOM 操作，降低状态不一致风险。
- **安全与链接打开**：快捷链接打开使用 `<a target="_blank" rel="noopener noreferrer">`，避免 `window.opener` 风险；新链接仅对空白/格式做基础校验，不要求严格 URL 规范化。
- **可测试性**：为每个操作控件设置稳定的 `data-testid`（如 `todo-input`、`todo-add`、`note-add`、`link-add`），E2E 用例据此定位；不依赖易变的中文文案作为唯一选择器。
- **无障碍与错误反馈**：空输入不做静默失败，用简单提示文本给出反馈；不引入弹窗/组件库。

## Risks / Trade-offs

- [localStorage 容量限制（通常约 5MB）] → 当前单用户文本数据量远低于限制；仅在数据无法写入时给出提示，不做容量扩展。
- [多标签页不同步] → 本需求按单页单标签使用设计，暂不监听 `storage` 事件；如后续需要可再加。
- [E2E 依赖 DOM 标识] → 在实现任务中把 `data-testid` 与验收场景一一对应，避免选择器漂移导致测试脆弱。
- [无构建步骤可能让 JS 随规模增大难以维护] → 当前三个模块规模小，保持原生脚本；规模增长后再引入模块化或构建。
