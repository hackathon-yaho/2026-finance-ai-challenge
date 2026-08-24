"""POST /internal/draft — 소명서 생성 (internal-api-contract.md)."""

from fastapi import APIRouter, Depends

from ..auth import require_internal_token
from ..schemas.draft import DraftRequest, DraftResponse
from ..services import drafting

router = APIRouter(dependencies=[Depends(require_internal_token)])


@router.post("/internal/draft", response_model=DraftResponse, response_model_exclude_none=True)
async def draft(request: DraftRequest) -> DraftResponse:
    return await drafting.generate(request)
