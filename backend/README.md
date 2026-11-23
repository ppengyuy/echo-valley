# 回音谷 后端

FastAPI + SQLAlchemy + SQLite，接口定义见 `../docs/03-API接口文档.md`。

## 启动

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env        # 填写 JWT_SECRET / LLM_API_KEY
uvicorn app.main:app --reload --port 8000
```

- Swagger：<http://localhost:8000/docs>
- 健康检查：<http://localhost:8000/health>
- 数据库文件：`backend/data/valley.db`（首次启动自动生成，已 gitignore）
- 未配置 `LLM_API_KEY` 时，对话回复为占位内容，其余接口正常。
