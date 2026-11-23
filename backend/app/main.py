from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import models  # noqa: F401  确保模型注册后再建表
from .api import auth, chat, echoes, plans, profile, review
from .config import settings
from .core.exceptions import AppError
from .core.response import ok
from .database import Base, engine


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(profile.router, prefix=API_PREFIX)
app.include_router(chat.router, prefix=API_PREFIX)
app.include_router(echoes.router, prefix=API_PREFIX)
app.include_router(plans.router, prefix=API_PREFIX)
app.include_router(review.router, prefix=API_PREFIX)


@app.exception_handler(AppError)
async def handle_app_error(_request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "message": exc.message},
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_request: Request, exc: RequestValidationError):
    errors = exc.errors()
    message = errors[0].get("msg", "参数错误") if errors else "参数错误"
    return JSONResponse(status_code=400, content={"code": 40001, "message": message})


@app.get("/health")
def health():
    return ok({"status": "up"})
