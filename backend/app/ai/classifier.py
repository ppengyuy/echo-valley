"""存档询问的轻量判定（关键词启发式，TODO: 接入 LLM 结构化输出）。"""

EMOTION_WORDS = ("害怕", "焦虑", "委屈", "难受", "想哭", "崩溃", "释然", "担心", "内耗")
REFLECTION_WORDS = ("我发现", "我意识到", "原来我", "我总是", "我是不是")
READING_WORDS = ("读完", "看书", "书里", "这篇文章", "这个回答", "知乎")
BELIEF_WORDS = ("我相信", "我希望", "我期待", "我的人生", "我想要")


def classify(text: str) -> dict:
    category = None
    if any(w in text for w in EMOTION_WORDS):
        category = "emotion"
    elif any(w in text for w in REFLECTION_WORDS):
        category = "reflection"
    elif any(w in text for w in READING_WORDS):
        category = "reading_touch"
    elif any(w in text for w in BELIEF_WORDS):
        category = "belief"

    return {
        "should_inquire": category is not None,
        "inquiry_category": category,
        "self_attack": any(w in text for w in ("我太没用", "我什么都做不好", "我很差劲")),
        "save_command": ("存为回音" in text) or ("存成回音" in text),
        "topic_class": "quiz" if any(w in text for w in ("这道题", "解题", "搜题")) else "companionship",
    }
