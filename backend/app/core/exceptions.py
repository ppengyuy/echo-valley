class AppError(Exception):
    """业务异常，统一由 main.py 的异常处理器转为 {code, message}。"""

    def __init__(self, code: int, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)
