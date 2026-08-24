"""GET /internal/health — 무인증 공개 (킵얼라이브용, internal-api-contract.md)."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/internal/health")
async def health() -> dict:
    return {"status": "UP"}
