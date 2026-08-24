"""해빙 AI-server 애플리케이션 조립.

로그에는 경로·상태·소요 시간만 남긴다 — 이미지 내용·추출 텍스트·소명서 본문 금지 (NFR-08).
"""

import logging
import time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .errors import ContractError
from .routers import draft, extract, health

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("ai.access")

app = FastAPI(title="haebing-ai-server", docs_url=None, redoc_url=None, openapi_url=None)

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
