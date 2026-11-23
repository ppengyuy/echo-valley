from datetime import datetime, timezone


def utcnow() -> datetime:
    """统一使用 naive UTC，便于 SQLite 存储与前端 ISO 序列化。"""
    return datetime.now(timezone.utc).replace(tzinfo=None)
