#!/usr/bin/env bash
# 用你自己的腾讯云账号，把回音谷部署成 CloudBase HTTP 云函数。
# 用法：
#   export TCB_ENV_ID="你的环境ID"
#   export TCB_SECRET_ID="你的SecretId"
#   export TCB_SECRET_KEY="你的SecretKey"
#   bash scripts/deploy-cloudbase.sh /path/to/echo-valley-deploy
#
# 第一个参数是解压后的项目目录（含 _tmp/prepare-backend-package.js、server/server.mjs、dist/）。
# 脚本会把密钥只用于 tcb login，不写入任何文件。

set -euo pipefail

PROJECT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
FUNCTION_NAME="${FUNCTION_NAME:-echo-valley}"

: "${TCB_ENV_ID:?请先设置 TCB_ENV_ID}"
: "${TCB_SECRET_ID:?请先设置 TCB_SECRET_ID}"
: "${TCB_SECRET_KEY:?请先设置 TCB_SECRET_KEY}"

echo "项目目录: $PROJECT_DIR"
echo "环境 ID:  $TCB_ENV_ID"
echo "函数名:   $FUNCTION_NAME"

cd "$PROJECT_DIR"

# 1. 切后端运行时清单（把根 package.json 换成无依赖的后端清单）
echo "[1/5] 切换后端运行时清单..."
node _tmp/prepare-backend-package.js

# 2. 生成 cloudbaserc.json
echo "[2/5] 生成 cloudbaserc.json..."
cat > cloudbaserc.json <<EOF
{
  "envId": "$TCB_ENV_ID",
  "functionRoot": ".",
  "functions": [
    {
      "name": "$FUNCTION_NAME",
      "type": "HTTP",
      "installDependency": true,
      "runtime": "Nodejs20.19"
    }
  ]
}
EOF

# 3. CLI 登录（密钥只在命令行参数里，不落盘）
echo "[3/5] 登录 CloudBase CLI..."
tcb login --apiKeyId "$TCB_SECRET_ID" --apiKey "$TCB_SECRET_KEY"

# 4. 部署云函数
echo "[4/5] 部署云函数..."
tcb fn deploy "$FUNCTION_NAME" --dir . --force -e "$TCB_ENV_ID" --httpFn --yes

# 5. 提示后续
echo "[5/5] 完成。请到 CloudBase 控制台 → 云函数 → $FUNCTION_NAME → 复制 HTTP 访问地址。"
echo "      用浏览器打开该地址，确认首页和「借一句别人的话」能正常工作。"
