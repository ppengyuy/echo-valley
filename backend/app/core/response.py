from typing import Any


def ok(data: Any = None) -> dict:
    """统一成功响应：{code: 0, message: "ok", data: {...}}。"""
    return {"code": 0, "message": "ok", "data": {} if data is None else data}
