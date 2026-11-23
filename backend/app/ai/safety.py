"""危险话题与越界话题的快速兜底（关键词版，正式版应替换为模型判定）。"""

DANGER_KEYWORDS = (
    "不想活",
    "想死",
    "自杀",
    "自残",
    "伤害自己",
    "活不下去",
    "结束生命",
)

QUIZ_KEYWORDS = (
    "这道题",
    "求解答",
    "解题",
    "答案是什么",
    "怎么做这道",
    "帮我做作业",
    "搜题",
)


def is_danger(text: str) -> bool:
    return any(word in text for word in DANGER_KEYWORDS)


def is_quiz(text: str) -> bool:
    return any(word in text for word in QUIZ_KEYWORDS)
