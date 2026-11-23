# 03 API 接口文档

> FastAPI，Base URL：`http://localhost:8000/api/v1`（下文省略前缀）。
> 除注册/登录外均需请求头 `Authorization: Bearer <token>`（JWT，7 天）。

## 1. 通用约定

统一响应：`{ "code": 0, "message": "ok", "data": { } }`；文件下载接口除外。

| code | HTTP | 含义 |
|---|---|---|
| 0 | 200/201 | 成功 |
| 40001 | 400 | 参数错误 |
| 40101 / 40102 | 401 | 未登录 / token 失效（前端跳登录） |
| 40301 | 403 | 资源不属于当前用户 |
| 40401 | 404 | 不存在 |
| 40901 | 409 | 用户名已存在 |
| 40902 | 409 | 状态冲突（如重复决定存档） |
| 50001 | 500 | 服务器错误 |
| 50002 | 503 | AI 服务不可用（前端保留用户输入） |
| 50003 | 500 | 导出生成失败 |

## 2. 接口清单

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /auth/register | 注册 `{username,password,nickname?}` → `{user, access_token, expires_in}` |
| POST | /auth/login | 登录，同上 |
| GET | /auth/me | 当前用户 |
| GET / PATCH | /profile | 档案（exam_type、target_desc）查看/修改，仅亲述信息 |
| GET | /profile/facts | 记忆条目列表 |
| DELETE | /profile/facts/{id} | 删除记忆条目（置 removed） |
| POST | /chat/sessions | 创建会话 `{space: valley\|path}` |
| GET | /chat/sessions | 会话列表 `?space=` |
| GET | /chat/sessions/{id} | 详情 `?include=messages` 返回全部消息 |
| PATCH | /chat/sessions/{id} | `{status:"closed"}` 关闭会话 |
| POST | /chat/sessions/{id}/messages | **发送消息（SSE 流式）**，见 §3 |
| POST | /chat/messages/{id}/save-decision | 存档决定 `{decision:"accept"\|"reject"}`；accept → 返回 echo；reject → 不留任何记录 |
| POST | /chat/messages/{id}/manual-save | 手动强制保存（"把这句话存为回音"），跳过询问 |
| GET | /echoes | 回音列表 `?status=active\|archived`；返回 items + links（连线） |
| POST | /echoes | 手动保存 `{message_id}`（与 manual-save 等价） |
| POST | /echoes/mirror | 镜像回音成对创建 `{origin_message_id, mirror_content}`，见 §4 |
| POST | /echoes/{id}/archive | 归档 |
| POST | /echoes/{id}/restore | 恢复（P1） |
| DELETE | /echoes/{id} | 消散（物理删除，不可恢复） |
| DELETE | /echoes | 一键清空 `?scope=all\|active\|archived` |
| GET | /echoes/stats | `{total_saved, milestone:{threshold:5, reached, text}}`，累计数驱动彩蛋 |
| POST | /plans | 向导答案生成计划，见 §5 |
| GET | /plans/current | 当前 active 计划 |
| GET | /plans/{id} | 计划详情（含 milestones/tasks） |
| PATCH | /plans/{id} | 调整/归档；改 daily_hours 不自动重排，返回提示 |
| PATCH | /plans/tasks/{task_id} | 任务标记 `{status:"todo"\|"done"\|"skipped"}`，仅用户主动 |
| GET | /plans/{id}/export | 导出 `?format=csv\|excel`；CSV 带 BOM，xlsx 用 openpyxl |
| GET | /review/summary | 复盘双线并排 `?days=14`，见 §6 |

## 3. 发送消息（SSE）

`POST /chat/sessions/{id}/messages`，请求 `{content, mode:"chat"|"review"}`，响应 `text/event-stream`：

| 事件 | data | 说明 |
|---|---|---|
| user_message | `{message_id, content}` | 用户消息已落库 |
| safety_alert | `{level, content, contact_hint}` | 危险念头 → 固定转介话术，中断生成 |
| boundary_notice | `{content}` | 搜题/越界 → 拒答话术 |
| delta | `{text}` | 回复增量（多次） |
| message | `{message_id, content, weather}` | 助手消息完整落库 |
| save_inquiry | `{message_id, category, hint}` | 命中 4 类内心表达 → 询问"要不要存入山谷？"（pending） |
| mirror_offer | `{message_id, hint}` | 持续自我否定 → 询问"要不要开启镜像回音？" |
| recall | `{echo:{id, content, created_at}, content}` | review 模式：旧回音纯文本念回 |
| echo_saved | `{message_id, echo_id}` | 检出手动指令自动保存后推送 |
| error / done | — | 流结束必发 done |

事件顺序：
- 正常：`user_message → delta* → message → (save_inquiry | mirror_offer)? → done`
- 安全：`user_message → safety_alert → done`
- 复盘：`user_message → recall → message → done`

save_inquiry 针对用户消息；询问不落为独立 assistant 消息，由前端以固定 UI 呈现。

## 4. 镜像回音流程

1. 用户连续自我否定 → SSE 返回 `mirror_offer`；
2. 用户同意 → 前端展示引导（想象好朋友会对你说什么）；
3. 用户写下安慰话 → `POST /echoes/mirror` 成对创建 normal + mirror（pending_confirm=true）；
4. 强制询问（不受语义判断限制）→ 用户在对话流点保存/不要 → 调 `save-decision`；
5. reject → 两条物理删除；退出流程 = 调 reject，不留半成品。

## 5. 生成计划 `POST /plans`

请求：`{final_goal, deadline, daily_hours, focus_minutes, rest_buffer_minutes?, overpack_sensitivity?, weekly_rest_day?}`。

服务端确定性规则：按 deadline 倒排年→月→周→日；每日任务合计 ≤ daily_hours（扣缓冲）；超载则按价值删减并将说明写入 `trim_report`；缓冲日不铺任务。LLM 仅辅助拆阶段名/润色，不可用时纯规则生成。

## 6. 复盘

- `GET /review/summary?days=14` 返回两线原始数据：path（tasks_total/done/skipped + recent_tasks）与 valley（recent_echoes）。**仅陈列，不做解读**，前端不得渲染完成率式评判组件。
- 复盘对话复用发送消息接口 `mode=review`；旧回音候选池：`status=active` 且 `type=normal`；只念原话，用户转移话题即停。

## 7. AI 服务层边界规则

- 陪伴回复与意图判定分开调用：回复 `temperature 0.8` 流式；判定 `temperature 0` 输出 JSON `{topic_class, should_inquire, inquiry_category, self_attack, save_command, recall_suggestion}`。
- `topic_class=quiz/irrelevant` → 拒答拉回；`unsafe` → 转介（最高优先级）；`self_attack` → mirror_offer（优先于 should_inquire）；`save_command` → 自动强制保存。
- System Prompt 硬约束：先接住感受、不灌鸡汤、valley 不谈规划 / path 不谈情绪、复盘只念原话不对比、不贴标签、不催打卡。
- 意图判定允许误差：误触发用户回"不要"，漏识别靠手动指令兜底。

## 8. 环境变量与启动

| 变量 | 说明 |
|---|---|
| DATABASE_URL | 默认 `sqlite:///./valley.db` |
| JWT_SECRET | 签名密钥 |
| LLM_BASE_URL / LLM_API_KEY / LLM_MODEL | OpenAI 兼容端点 |
| CORS_ORIGINS | 默认 `http://localhost:5173` |

```bash
uvicorn app.main:app --reload --port 8000   # Swagger: /docs
npm run dev -- --port 5173
```
