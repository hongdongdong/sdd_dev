# AGENTS.md — 本仓库的 Agent 规则

给所有在本仓库工作的 AI Agent（Codex CLI 等）。遵循 OpenSpec 流程。

## SDD 流程（强制）

1. 需求先落 OpenSpec change：`openspec new change <kebab-case 名称>`，再写 proposal / specs / design / tasks。
2. 只有拿到明确变更需求时才写代码；实现前先读 `openspec/changes/<当前 change>/` 下的全部产物。
3. 产物语言：中文；OpenSpec 结构标题与 SHALL / MUST 关键字保留英文。

## 分流规则

- 中等以上新功能、跨文件改动：必须走 OpenSpec。
- 简单 Bug 修复：可以不建 change，直接在分支上修复并说明原因。

## 验收标准写法

- 用 EARS 句式：`当 <条件> 时，系统必须 <行为>`。
- 每条验收标准可被自动化测试覆盖；E2E 用例由本仓库流水线根据验收标准生成。

## 产物生命周期

- 当前 change 与代码仓库共存；完成后归档到 `openspec/changes/archive/`。
- 已经失效的 Spec 标记过期，不要依据它改代码。
- 反复出现的约定沉淀回本文件。

## 实现约束

- 前端实现到 `app/` 目录，纯静态页面 + 浏览器本地存储，不引入后端。
- 提交信息格式：`<change 名>: 简述`。
