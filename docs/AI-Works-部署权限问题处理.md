# AI Works 部署失败：云函数权限问题处理

> 失败时间：2026-11-28 11:04
> requestId：`464dfb3e-3bce-4df4-afa9-68c8b1378201`
> 错误码：`code=9, action=DescribeFunctionV2, retryable=false`

## 一、问题定性

项目的构建、描述符校验、运行时验证**全部通过**（日志里每步 `code=0`）。失败发生在最后一步「部署云函数」：

```
[CreateFunction] you are not authorized to perform operation (scf:CreateFunction)
resource (qcs::cls:ap-shanghai:uin/1670861915:logset/f21c5f8f-8dbb-4798-8877-9ca6140a9333) has no permission
resource (qcs::cls:ap-shanghai:uin/1670861915:topic/bda52244-82e9-41f4-bcd1-bfa39958afab) has no permission
```

**根因**：AI Works 用来部署的腾讯云账号（uin `1670861915`）缺少创建云函数和操作 CLS 日志资源的权限。这是平台侧账号配置问题，与项目包无关。

**关键**：这个账号是知乎平台的，创作者无法登录它、也无法给它补权限。所以「补权限」只能由平台做；用户能做的是反馈，或改用自己的腾讯云账号部署。

## 二、路线一：反馈给平台修（推荐）

复制下面内容发到 AI Works 官方工单或社区帖子：

```
【问题描述】
按官方规则「前端+Node后端的全栈项目、不含数据库写入，可使用 AI Works 部署能力」，
我的项目符合条件，平台正确识别为 fullstack-split，构建与校验全部通过（code=0），
但部署云函数时提示 CAM 权限不足，retryable=false。

项目名称：回音谷
失败时间：2026-11-28 11:04
requestId: 464dfb3e-3bce-4df4-afa9-68c8b1378201

【错误原文】
[CreateFunction] you are not authorized to perform operation (scf:CreateFunction)
resource (qcs::cls:ap-shanghai:uin/1670861915:logset/f21c5f8f-8dbb-4798-8877-9ca6140a9333) has no permission
resource (qcs::cls:ap-shanghai:uin/1670861915:topic/bda52244-82e9-41f4-bcd1-bfa39958afab) has no permission
code=9, action=DescribeFunctionV2, retryable=false

【已排查】
npm install、切换运行时依赖清单、npm install --omit=dev、
验证运行时交付（含 test -x scf_bootstrap）、安装 CloudBase CLI 均 code=0；
_tmp/frontend.deploy.json 和 _tmp/backend.deploy.json 由官方 Skill 生成并通过校验。
失败仅在平台调用 tcb fn deploy 创建云函数时，与项目代码和打包内容无关。

【请求协助】
请检查部署账号 uin 1670861915 的 CAM 权限，至少需要：
1. 云函数：QcloudSCFFullAccess（或 scf:CreateFunction 等 scf:* 操作）
2. 日志服务：QcloudCLSFullAccess（或 cls:*，覆盖报错里的 logset 和 topic 资源）
3. 云开发：QcloudTCBFullAccess（或 tcb:*，覆盖 env 资源）
参考腾讯云官方文档 https://cloud.tencent.com/document/product/876/47057 中
CloudBase 子账号的标准授权配置。
补齐后我会重新上传同一个 ZIP 验证，谢谢！
```

发送后无需改动代码或包，等平台回复后重传同一个 ZIP 即可。

## 三、路线二：自建腾讯云账号部署

用你自己的腾讯云账号，就不受平台账号权限限制。

### 3.1 先理解权限这件事

- **用主账号部署**：主账号默认拥有全部权限，**不用配 CAM**。这是最简单的方式。
- **用子账号部署**：子账号默认无云开发权限，需要主账号在 CAM 控制台关联三个预设策略：
  - `QcloudTCBFullAccess`（云开发）
  - `QcloudSCFFullAccess`（云函数）
  - `QcloudCLSFullAccess`（日志服务）

  → 这正是平台那个账号缺的东西。用自己的账号就能亲自补齐。

### 3.2 一步步操作（主账号路线）

**第 1 步：准备腾讯云账号**

1. 打开 https://console.cloud.tencent.com ，用微信或邮箱注册并登录（实名认证可能需要，个人认证免费）。
2. 进入「云开发 CloudBase」控制台：https://console.cloud.tencent.com/tcb
3. 首次进入会提示开通服务，点同意授权。
4. 点「新建环境」：
   - 计费方式选**按量计费**（有免费额度，个人项目基本不花钱）
   - 环境名称随便填，比如 `echo-valley`
   - **地域选上海**（和之前报错的 `ap-shanghai` 一致，避免跨地域问题）
   - 创建完成后，复制**环境 ID**（形如 `echo-valley-1g8xxxxx`），后面要用。

**第 2 步：创建 API 密钥**

1. 打开 https://console.cloud.tencent.com/cam/capi
2. 点「新建密钥」，得到 `SecretId` 和 `SecretKey`。
3. **SecretKey 只显示一次，立刻复制保存**，关掉页面就看不到了。
4. 安全提示：这对密钥等于你账号的密码，不要发给任何人、不要写进项目文件。

**第 3 步：安装 CloudBase CLI**

在你电脑上打开终端（PowerShell 或 Git Bash），执行：

```bash
npm i -g @cloudbase/cli
```

安装完成后执行 `tcb -v`，能输出版本号就成功了。

**第 4 步：登录 CLI**

```bash
tcb login
```

会弹出浏览器让你扫码登录腾讯云，扫完即可。

**第 5 步：准备部署目录**

不要用临时目录（会被系统清理）。在你电脑选一个固定位置，比如 `D:\echo-valley-deploy`，把桌面上的 `echo-valley-aiworks.zip` 解压进去。解压后应该能看到：

```
D:\echo-valley-deploy\
├── index.html
├── package.json
├── scf_bootstrap
├── cloudbaserc.json
├── server\server.mjs
├── dist\
├── src\
└── _tmp\
```

**第 6 步：切换成后端运行时清单**

这步对应日志里的「切换运行时依赖清单」，把包里的后端清单替换掉根 `package.json`：

```bash
cd /d/echo-valley-deploy
node _tmp/prepare-backend-package.js
```

成功后 `package.json` 会变成只有 `echo-valley-api` 的最小清单（无依赖）。

**第 7 步：填写 cloudbaserc.json**

用文本编辑器打开 `cloudbaserc.json`，把两个占位符替换掉：

```json
{
  "envId": "你的环境ID",
  "functionRoot": ".",
  "functions": [
    {
      "name": "echo-valley",
      "type": "HTTP",
      "installDependency": true,
      "runtime": "Nodejs20.19"
    }
  ]
}
```

- `envId`：第 1 步复制的环境 ID
- `name`：云函数名，随便起，比如 `echo-valley`

**第 8 步：部署云函数**

```bash
tcb fn deploy echo-valley --dir . --force -e 你的环境ID --httpFn --yes
```

等待上传完成。

> ⚠️ **实战踩坑 1**：`--httpFn` 只是把函数设成 HTTP 类型，**不会自动创建公网访问服务**。部署完直接访问默认域名会返回 `INVALID_ENV`。必须再执行一次：
> ```bash
> tcb service create -p echo-valley -f echo-valley -e 你的环境ID
> ```
> 它会返回一个带随机后缀的正式地址，形如 `https://xxx-1543794446.ap-shanghai.app.tcloudbase.com/echo-valley`——**用这个地址**，不是控制台里那个不带后缀的。

> ⚠️ **实战踩坑 2**：站点挂在 `/echo-valley` 路径下，但前端构建默认 `base: '/'`，资源会请求 `/assets/...`（不带前缀）导致 404：页面能开、但样式脚本全丢。构建前要在 `vite.config.ts` 里加：
> ```ts
> base: '/echo-valley/',
> define: {
>   'import.meta.env.VITE_ZHIDA_ENABLED': JSON.stringify('true'),
>   'import.meta.env.VITE_ZHIDA_ENDPOINT': JSON.stringify('/echo-valley/api/zhida/v1/chat/completions'),
> }
> ```
> 然后 `npx vite build` 重新生成 `dist/`，再执行第 8 步的 `tcb fn deploy`。

> ⚠️ **实战踩坑 3**：用 API 密钥登录的参数是 `--apiKey`（不是 `--apiKeySecret`）：
> `tcb login --apiKeyId xxx --apiKey yyy`

> ⚠️ **实战踩坑 4（会导致白屏）**：`server.mjs` 如果像常规 Node 服务那样用 `createReadStream` 流式返回静态文件，云函数 HTTP 网关会在流结束前断开，1.4MB 的 JS 只返回约 790KB，浏览器解析到一半就报错，**页面背景色出来但内容全空**。必须改成整块读取一次性返回：
> ```js
> const body = readFileSync(file);
> res.setHeader('Content-Length', String(body.length));
> res.end(body);
> ```
> 判断方法：`curl -s <JS地址> -o /tmp/r.js -w '%{size_download}'` 与本地 `dist/assets/*.js` 的字节数比对，不一致就是被截断了。

**第 9 步：验证**

浏览器打开第 8 步拿到的正式地址，依次确认：
1. 首页能显示「回音谷」；
2. 浏览器 F12 → Network，看 `assets/*.js` 和 `*.css` 是否都是 **200**（若 404 说明踩坑 2 没处理）；
3. 测试「借一句别人的话」，能刷出句子说明知乎直答通了。

**已验证的线上地址**（本次部署，可直接体验）：

```
https://vital-flyingfish-d3ey10v5d77d1c8-1543794446.ap-shanghai.app.tcloudbase.com/echo-valley
```

### 3.3 如果要用子账号（可选）

用主账号跑上面的步骤即可，不需要这段。只有在你想用子账号密钥时才做：

1. 登录 CAM 控制台：https://console.cloud.tencent.com/cam
2. 左侧「用户」→「新建用户」，创建一个子账号并生成 API 密钥。
3. 左侧「策略」→「新建自定义策略」→「按策略语法创建」→「空白模板」，按官方文档 https://cloud.tencent.com/document/product/876/47057 复制策略语法，把 `${uin}`、`${envId}`、`${region}`、`${namespace}`、`${topicId}` 替换成你的真实值。
4. 或者更简单：直接在子账号详情里关联三个预设策略 `QcloudTCBFullAccess`、`QcloudSCFFullAccess`、`QcloudCLSFullAccess`。
5. 第 2 步创建 API 密钥时用子账号的密钥，第 4 步改成 `tcb login --apiKeyId 子账号SecretId --apiKey 子账号SecretKey`。

## 四、两种路线对比

| | 路线一（反馈平台修） | 路线二（自建账号） |
|---|---|---|
| 谁补权限 | 平台 | 你自己（主账号不用补） |
| 操作量 | 发一条反馈，等回复 | 注册腾讯云 + 9 步操作 |
| 能否保留知乎直答 | 能 | 能 |
| 上线位置 | AI Works 项目广场 | 你自己的云函数域名 |
| 参赛展示 | 方便（平台内直接展示） | 需把公网链接填进 AI Works「体验项目链接」 |
| 费用 | 平台承担 | 腾讯云按量计费，个人项目基本免费 |

建议：先发路线一的反馈，同时可以并行走路线二做备用。哪条先通就用哪条。

## 五、密钥安全说明

- 交付包里的 `ZHIDA_ACCESS_SECRET` 是按你的授权明文固化在 `server/server.mjs` 里的，**不进前端 bundle、不进 GitHub 公开仓库**。
- 任何拿到 ZIP 的人都能读到这个密钥——这是「明文固化保留直答」这条路的既有代价。
- 自建部署时，腾讯云的 `SecretId`/`SecretKey` 只用于 CLI 登录，**不要写进项目文件、不要提交到仓库**。
