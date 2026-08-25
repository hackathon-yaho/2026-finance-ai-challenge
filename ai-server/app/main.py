"""해빙 AI-server 애플리케이션 조립.

로그에는 경로·상태·소요 시간만 남긴다 — 이미지 내용·추출 텍스트·소명서 본문 금지 (NFR-08).
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .config import settings
from .errors import ContractError
from .routers import draft, extract, health

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("ai.access")

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """기동 시 설정 상태를 남긴다.

    키가 없으면 첫 호출이 실패할 때까지 알 수 없었다. 값은 절대 찍지 않고
    있는지 없는지만 남긴다 (NFR-08).
    """
    from .llm import client as llm_client

    if not llm_client.api_key_present():
        log.error(
            "LLM API 키가 설정되지 않았습니다. /internal/health는 정상이지만 "
            "판독·소명서 생성은 AI_CONFIG_ERROR(500)로 실패합니다. "
            "로컬은 set-key.ps1, 배포는 Secret Manager를 확인하세요."
        )
    if not settings.internal_token:
        log.warning("INTERNAL_TOKEN이 비어 있습니다 — 모든 /internal 호출이 401로 거부됩니다.")
    yield


app = FastAPI(
    title="haebing-ai-server",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(extract.router)
app.include_router(draft.router)


@app.middleware("http")
async def access_log(request: Request, call_next):
    started = time.monotonic()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        log.info("%s %s %d %.2fs", request.method, request.url.path, status, time.monotonic() - started)


@app.exception_handler(ContractError)
async def contract_error_handler(_request: Request, exc: ContractError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=exc.body())


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, _exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"error": "BAD_REQUEST", "message": "요청이 계약 스키마와 다릅니다."},
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logging.getLogger("ai").error("unhandled %s at %s", type(exc).__name__, request.url.path)
    return JSONResponse(status_code=500, content={"error": "INTERNAL", "message": "서버 내부 오류입니다."})
