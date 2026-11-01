#!/usr/bin/env bash
# ============================================================
# SDD 研发流水线（最小版本）
# 一条命令把一条飞书需求走完端到端：
#   需求卡 → 开分支 → OpenSpec 产物 → Codex 编码 → MR → E2E 报告 → 回写需求卡
#
# 用法： run_pipeline.sh <飞书记录ID>
# 依赖环境变量（见 README.md「配置」）：
#   LARK_CLI LARK_BASE_TOKEN LARK_TABLE_ID
#   GITHUB_REPO GITHUB_TOKEN DEEPSEEK_API_KEY
#   CODEX_BIN OPENSPEC_BIN （不传则用脚本内置默认路径）
# ============================================================
set -euo pipefail

log()  { echo "[pipeline] $(date +%H:%M:%S) $*"; }
die()  { log "失败: $*"; exit 1; }

# ---------- 配置 ----------
RECORD_ID="${1:-}"; [ -n "$RECORD_ID" ] || { echo "用法: run_pipeline.sh <飞书记录ID>"; exit 2; }

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LARK_CLI="${LARK_CLI:-/data/default_project/agents/default_agent/shared_env/lark-cli/node_modules/.bin/lark-cli}"
TOOLS_BIN="/data/default_project/agents/default_agent/shared_env/codex-tools/node_modules/.bin"
CODEX_BIN="${CODEX_BIN:-$TOOLS_BIN/codex}"
OPENSPEC_BIN="${OPENSPEC_BIN:-$TOOLS_BIN/openspec}"
MODEL="${MODEL:-deepseek-v4-pro}"
CODEX_HOME_DIR="${CODEX_HOME_DIR:-$HOME/.codex-pipeline}"
PW_LD_PATH="${PW_LD_PATH:-$HOME/pw-libs/usr/lib/x86_64-linux-gnu}"
E2E_PORT="${E2E_PORT:-4173}"

: "${LARK_BASE_TOKEN:?未设置 LARK_BASE_TOKEN}"
: "${LARK_TABLE_ID:?未设置 LARK_TABLE_ID}"
: "${GITHUB_REPO:?未设置 GITHUB_REPO（owner/repo）}"
: "${GITHUB_TOKEN:?未设置 GITHUB_TOKEN}"
: "${DEEPSEEK_API_KEY:?未设置 DEEPSEEK_API_KEY}"

export CODEX_HOME="$CODEX_HOME_DIR"
mkdir -p "$CODEX_HOME_DIR"
cat > "$CODEX_HOME_DIR/config.toml" << EOF
model = "$MODEL"
model_provider = "deepseek"
sandbox_mode = "danger-full-access"

[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com/v1"
env_key = "DEEPSEEK_API_KEY"
wire_api = "responses"
EOF

# ---------- 小工具 ----------
js(){ node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);'"$1"'})'; }

# 汇总 codex JSONL 输出里的 token 用量
codex_usage(){ node -e '
let total={input:0,output:0};
const fs=require("fs");
for(const line of fs.readFileSync(process.argv[1],"utf8").split("\n")){
  if(!line.trim())continue;
  try{const o=JSON.parse(line);if(o.type==="turn.completed"&&o.usage){total.input+=o.usage.input_tokens||0;total.output+=(o.usage.output_tokens||0)+(o.usage.reasoning_output_tokens||0);}}catch{}
}
console.log(total.input+" / "+total.output);
' "$1"; }

# ---------- 1. 读需求 ----------
log "读取需求卡 $RECORD_ID"
DEMAND=$("$LARK_CLI" base +record-get --as user --base-token "$LARK_BASE_TOKEN" \
  --table-id "$LARK_TABLE_ID" --record-id "$RECORD_ID" --format json) || die "读取需求卡失败"
TITLE=$(echo "$DEMAND" | js 'const d=j.data;const i=(d.fields||[]).indexOf("需求标题");const v=(d.data||[])[0]?.[i];console.log(Array.isArray(v)?(v[0]??""):(v??""))')
DESC=$(echo "$DEMAND" | js 'const d=j.data;const i=(d.fields||[]).indexOf("需求描述");const v=(d.data||[])[0]?.[i];console.log(Array.isArray(v)?(v[0]??""):(v??""))')
[ -n "$TITLE" ] || die "需求卡缺少「需求标题」"
log "需求: $TITLE"
SLUG="demand-$(echo "$RECORD_ID" | tr 'A-Z' 'a-z')"   # OpenSpec change 名要求全小写 kebab-case

# ---------- 2. 状态 → 进行中 ----------
"$LARK_CLI" base +record-batch-update --as user --base-token "$LARK_BASE_TOKEN" --table-id "$LARK_TABLE_ID" \
  --json "{\"update_records\":{\"$RECORD_ID\":{\"状态\":[\"进行中\"]}}}" >/dev/null || die "回写状态失败"

# ---------- 3. 开分支 ----------
cd "$REPO_DIR"
BRANCH="demand/$SLUG"
git checkout -q main 2>/dev/null || git checkout -q -b main
if git remote get-url origin >/dev/null 2>&1; then git pull -q --ff-only origin main 2>/dev/null || true; fi
git checkout -q -b "$BRANCH" || die "创建分支失败"
log "分支: $BRANCH"

# ---------- 4. OpenSpec change ----------
"$OPENSPEC_BIN" new change "$SLUG" --description "$TITLE" >/dev/null || die "openspec new change 失败"
log "OpenSpec change: $SLUG"

# ---------- 5. Codex 生成 SDD 产物（propose） ----------
log "Codex 生成 SDD 产物（propose）"
cat > /tmp/propose-prompt.txt << EOF
请使用 openspec-propose 技能，为下面这条需求创建 OpenSpec change「$SLUG」的全部规划产物（proposal / specs / design / tasks），并执行验证。
需求标题：$TITLE
需求描述：$DESC
规划产物里必须包含可自动化验收的标准（EARS 句式），供后续 E2E 使用。
EOF
"$CODEX_BIN" exec --json --ephemeral -C "$REPO_DIR" --dangerously-bypass-approvals-and-sandbox \
  < /tmp/propose-prompt.txt > "$CODEX_HOME_DIR/propose.log" 2>&1 || die "propose 阶段失败，见 $CODEX_HOME_DIR/propose.log"
USAGE_PROPOSE=$(codex_usage "$CODEX_HOME_DIR/propose.log")

"$OPENSPEC_BIN" validate "$SLUG" --strict >/dev/null 2>&1 || "$OPENSPEC_BIN" validate "$SLUG" >/dev/null 2>&1 || die "openspec validate 未通过"
log "propose 完成，tokens: $USAGE_PROPOSE"

# ---------- 6. Codex 实现（apply） ----------
log "Codex 实施 change $SLUG（apply）"
cat > /tmp/apply-prompt.txt << EOF
请使用 openspec-apply-change 技能，实施 OpenSpec change「$SLUG」。
按 tasks.md 逐项完成；代码写到 app/ 目录；完成后运行仓库内可用的验证命令并确认通过。
EOF
"$CODEX_BIN" exec --json --ephemeral -C "$REPO_DIR" --dangerously-bypass-approvals-and-sandbox \
  < /tmp/apply-prompt.txt > "$CODEX_HOME_DIR/apply.log" 2>&1 || die "apply 阶段失败，见 $CODEX_HOME_DIR/apply.log"
USAGE_APPLY=$(codex_usage "$CODEX_HOME_DIR/apply.log")
log "apply 完成，tokens: $USAGE_APPLY"

# ---------- 7. 归档 change ----------
"$OPENSPEC_BIN" archive "$SLUG" --yes >/dev/null 2>&1 || log "归档跳过（archive 失败不阻塞）"

# ---------- 8. 提交 + 推送 + MR ----------
log "提交并推送 $BRANCH"
git add -A
git commit -q -m "$SLUG: $TITLE" || log "无改动可提交"
PUSH_URL="https://oauth2:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git"
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "https://github.com/${GITHUB_REPO}.git"
fi
git push -q -u "$PUSH_URL" "$BRANCH" 2>/dev/null || die "推送失败（检查 GITHUB_TOKEN 与仓库 ${GITHUB_REPO}）"
MR_JSON=$(curl -s -X POST "https://api.github.com/repos/${GITHUB_REPO}/pulls" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" \
  -d "{\"title\":\"$SLUG: $TITLE\",\"head\":\"$BRANCH\",\"base\":\"main\"}") || die "创建 MR 失败"
MR_URL=$(echo "$MR_JSON" | js 'console.log(j.html_url||j.message||"")')
log "MR: $MR_URL"

# ---------- 9. E2E ----------
log "Codex 根据验收标准生成 E2E 用例"
cat > /tmp/e2e-prompt.txt << EOF
根据 openspec/changes/archive/ 或 openspec/specs/ 中与本需求「$TITLE」相关的验收标准，生成 Playwright 用例文件 e2e/generated-${SLUG}.spec.js。
要求：使用 page.goto('/') 访问 app/ 的应用（静态服务器已在 http://127.0.0.1:${E2E_PORT} 运行）；覆盖全部验收标准；用中文描述测试名。
EOF
"$CODEX_BIN" exec --json --ephemeral -C "$REPO_DIR" --dangerously-bypass-approvals-and-sandbox \
  < /tmp/e2e-prompt.txt > "$CODEX_HOME_DIR/e2egen.log" 2>&1 || die "E2E 用例生成失败"
USAGE_E2E=$(codex_usage "$CODEX_HOME_DIR/e2egen.log")

mkdir -p e2e/reports
node e2e/server.mjs > e2e/reports/server.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
sleep 1

E2E_STATUS="pass"
if [ -n "$PW_LD_PATH" ] && [ -d "$PW_LD_PATH" ]; then
  export LD_LIBRARY_PATH="$PW_LD_PATH"
fi
if ! npx playwright test "generated-${SLUG}.spec.js" > e2e/reports/run.log 2>&1; then
  log "E2E 未通过，进入一轮修复"
  cat > /tmp/fix-prompt.txt << EOF
Playwright E2E 对 app/ 的验收未通过。测试输出如下，请修复 app/ 里的实现代码使其通过（不改测试用例）：
$(tail -c 6000 e2e/reports/run.log)
EOF
  "$CODEX_BIN" exec --json --ephemeral -C "$REPO_DIR" --dangerously-bypass-approvals-and-sandbox \
    < /tmp/fix-prompt.txt > "$CODEX_HOME_DIR/fix.log" 2>&1 || true
  if npx playwright test "generated-${SLUG}.spec.js" > e2e/reports/run.log 2>&1; then
    log "修复后 E2E 通过"
  else
    E2E_STATUS="fail"
    log "E2E 仍失败"
  fi
  USAGE_FIX=$(codex_usage "$CODEX_HOME_DIR/fix.log")
  git add -A && git commit -q -m "$SLUG: e2e 修复" 2>/dev/null || true
  git push -q "$PUSH_URL" "$BRANCH" 2>/dev/null || true
fi

# 汇总报告
REPORT_MD="e2e/reports/${SLUG}-report.md"
node - "$REPORT_MD" "$SLUG" "$TITLE" "$E2E_STATUS" << 'EOF'
const fs=require('fs');const [file,slug,title,status]=process.argv.slice(2);
let runLog='';try{runLog=fs.readFileSync('e2e/reports/run.log','utf8').slice(-4000)}catch{}
const p=(runLog.match(/(\d+)\s+passed/)||[])[1]; const f=(runLog.match(/(\d+)\s+failed/)||[])[1];
const summary=`通过 ${p||0} / 失败 ${f||0}`;
fs.writeFileSync(file,`# E2E 验收报告 · ${title}\n\n- Change: ${slug}\n- 结果: ${status==='pass'?'通过':'未通过'}（${summary}）\n- 时间: ${new Date().toISOString()}\n\n## 运行输出（尾部）\n\n\`\`\`\n${runLog}\n\`\`\`\n`);
EOF
log "报告: $REPORT_MD（$E2E_STATUS）"

# ---------- 10. 回写飞书 ----------
log "回写需求卡"
REPORT_URL=""
UPLOAD_JSON=$(cd "$REPO_DIR" && "$LARK_CLI" drive +upload --as user --file "$REPORT_MD" --name "${SLUG}-e2e报告.md" --format json 2>/dev/null) || true
REPORT_URL=$(echo "$UPLOAD_JSON" | js 'console.log(j.data?.file?.url||j.data?.url||"")')
TOTAL_TOKENS=$(node -e '
const fs=require("fs");const files=process.argv.slice(1);
let ti=0,to=0;
for(const f of files){try{for(const line of fs.readFileSync(f,"utf8").split("\n")){if(!line.trim())continue;try{const o=JSON.parse(line);if(o.type==="turn.completed"&&o.usage){ti+=o.usage.input_tokens||0;to+=(o.usage.output_tokens||0)+(o.usage.reasoning_output_tokens||0);}}catch{}}}catch{}}
console.log(`输入 ${ti} / 输出 ${to} tokens · ${process.env.MODEL||"deepseek-v4-pro"}`);
' "$CODEX_HOME_DIR/propose.log" "$CODEX_HOME_DIR/apply.log" "$CODEX_HOME_DIR/e2egen.log" "$CODEX_HOME_DIR/fix.log")
FINAL_STATUS="已完成"; [ "$E2E_STATUS" = "fail" ] && FINAL_STATUS="失败"

"$LARK_CLI" base +record-batch-update --as user --base-token "$LARK_BASE_TOKEN" --table-id "$LARK_TABLE_ID" \
  --json "$(node -e '
const rec=process.argv[1],branch=process.argv[2],mr=process.argv[3],report=process.argv[4],cost=process.argv[5],st=process.argv[6];
const f={"状态":[st],"分支":branch,"MR链接":mr,"成本":cost,"备注":"E2E 验收报告已生成"};
if(report)f["报告链接"]=report;
console.log(JSON.stringify({update_records:{[rec]:f}}));
' "$RECORD_ID" "$BRANCH" "$MR_URL" "$REPORT_URL" "$TOTAL_TOKENS" "$FINAL_STATUS")" >/dev/null || die "回写需求卡失败"

log "完成。状态=$FINAL_STATUS 分支=$BRANCH"
log "MR: ${MR_URL:-（无）}"
log "报告: ${REPORT_URL:-（上传失败，见本地 $REPORT_MD）}"
log "成本: $TOTAL_TOKENS"
