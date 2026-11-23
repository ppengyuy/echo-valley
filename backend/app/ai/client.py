import json
from typing import AsyncIterator

import httpx

from ..config import settings


async def stream_chat(history: list[dict]) -> AsyncIterator[str]:
    """调用 OpenAI 兼容的 /chat/completions 流式接口，逐段产出文本。"""
    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    payload = {
        "model": settings.llm_model,
        "messages": history,
        "stream": True,
        "temperature": 0.8,
        "max_tokens": 500,
    }
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}

    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0]["delta"].get("content")
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
                if delta:
                    yield delta
