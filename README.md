# SDD 研发流水线 · 最小版本

把一条飞书需求走完端到端：**需求卡 → 开分支 → OpenSpec 产物 → Codex 编码 → MR → E2E 报告 → 回写需求卡**。

灵感来源：汇智云《SDD 与 AI 研发协作实践》培训（网易 CodeMaker 团队分享），本仓库是其「流程篇 1.17 AutoDev」的最小可运行实现。

## 组件（6）

| 组件 | 实现 |
| --- | --- |
| 需求卡 | 飞书多维表格（1 条记录 = 1 个需求） |
| SDD 流程 | OpenSpec（`openspec/` 目录，spec-driven schema） |
| 执行 Agent | Codex CLI headless + DeepSeek（v4-pro） |
| 代码托管 | GitHub 仓库 + 分支 + MR |
| E2E 验收 | Playwright + Chromium（用例由 AI 按验收标准生成） |
| 编排 | `scripts/run_pipeline.sh` |

## 快速开始

```sh
# 环境变量（示例）
export LARK_BASE_TOKEN=Il56b9q70a9VLWs6HKIc2HZ4nQF   # 飞书多维表格 base token
export LARK_TABLE_ID=tblR10BFpCA1OXdq                # 需求卡表 ID
export GITHUB_REPO=hongdongdong/sdd-pipeline-demo    # owner/repo
export GITHUB_TOKEN=xxx                              # fine-grained PAT：Contents 读写 + Pull requests 读写
export DEEPSEEK_API_KEY=xxx
export LARK_CLI=/path/to/lark-cli
export CODEX_BIN=/path/to/codex                      # 不传则用脚本内置默认路径

# 在飞书「需求卡」表新建一条需求（标题 + 描述，状态=待处理），拿到记录 ID
scripts/run_pipeline.sh <记录ID>
```

## 流程细节

1. 读取需求卡，状态 → 进行中
2. 从 main 开分支 `demand/<记录ID>-<slug>`
3. `openspec new change` 建变更目录
4. Codex 按 openspec-propose 技能生成 proposal / specs / design / tasks（含 EARS 验收标准），并 validate
5. Codex 按 openspec-apply-change 技能实施，代码写入 `app/`
6. `openspec archive` 归档 change
7. 提交、推送分支，经 GitHub API 创建 MR
8. Codex 按验收标准生成 Playwright 用例 → 跑 E2E → 失败则自动修复一轮
9. 报告上传飞书云盘，回写需求卡：状态、分支、MR 链接、报告链接、成本（tokens）
10. 一轮修复后仍失败的用例标记为失败，不回写为已完成

## 验收标准（对应 MVP 定义）

1. ✅ 表格新建需求 → 跑一条命令 → 分支、Spec、代码、MR 自动出现
2. ✅ E2E 报告生成并回写需求卡
3. ✅ 全程 DeepSeek，成本（输入/输出 tokens）记录在卡上

## 目录结构

```
app/                    # 流水线产物：个人工作台单页应用
openspec/               # OpenSpec 根目录（changes / specs / archive）
scripts/run_pipeline.sh # 编排脚本
e2e/                    # 生成的 E2E 用例 + 静态服务器 + 报告
AGENTS.md               # 仓库 Agent 规则（分流、EARS、产物生命周期）
```

## 已知边界（最小版本之外，留待下一轮）

- 无 CI 自动触发：手动跑脚本
- 无多角色 Handoff：单 Agent 执行
- 无成本观测平台：只记录 tokens，未折算金额
- 无 TeamSpace 面板：用飞书多维表格代替
- Codex 需要 `sandbox_mode = "danger-full-access"`（本容器内核禁止 userns，bwrap 沙箱不可用；脚本会自动写入 pipeline 专用配置）
- 本容器缺少 Chromium 系统依赖库，E2E 运行时需 `LD_LIBRARY_PATH` 指向补齐的库目录（见 `PW_LD_PATH`）
