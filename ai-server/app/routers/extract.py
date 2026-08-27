"""POST /internal/extract — Content-Type으로 이미지/텍스트 경로 분기 (계약 2026-08-25 확정).

이미지는 raw body로 받는다. 멀티파트 파서를 쓰지 않으므로 디스크 스풀링이 원천적으로 없다.
"""

from fastapi import APIRouter, Depends, Request

from ..auth import require_internal_token
from ..config import settings
from ..errors import bad_request
from ..schemas.card import ExtractResponse, RawTextRequest
from ..services import extraction

router = APIRouter(dependencies=[Depends(require_internal_token)])

_MAGIC: dict[str, tuple[bytes, ...]] = {
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
}
_MEDIA_ALIASES = {"image/jpg": "image/jpeg"}


@router.post("/internal/extract", response_model=ExtractResponse)
async def extract(
    request: Request,
    image_index: int | None = None,
    # 연도 없는 캡처의 연도 추론에 쓰는 기준 시점 (계약 2026-08-27 신설).
    # 없으면 추론하지 않는다 — 재료 없이 추측하지 않는다는 원칙 그대로다.
    reference_date: str | None = None,
    intake_when: str | None = None,
) -> ExtractResponse:
    content_type = (request.headers.get("content-type") or "").split(";")[0].strip().lower()
    content_type = _MEDIA_ALIASES.get(content_type, content_type)

    if content_type in _MAGIC:
        if image_index is None or image_index < 0:
            raise bad_request("image_index 쿼리 파라미터(0 이상 정수)가 필요합니다.")
        body = await request.body()
        try:
            if not body:
                raise bad_request("이미지 본문이 비어 있습니다.")
            if len(body) > settings.max_image_bytes:
                raise bad_request("이미지가 10MB 상한을 초과합니다.")
            if not any(body.startswith(magic) for magic in _MAGIC[content_type]):
                raise bad_request("Content-Type과 파일 시그니처(매직바이트)가 일치하지 않습니다.")
            return await extraction.extract_image(
                body, content_type, image_index, reference_date, intake_when
            )
        finally:
            del body

    if content_type == "application/json":
        try:
            payload = RawTextRequest.model_validate(await request.json())
        except Exception as exc:
            raise bad_request("본문은 {\"rawText\": \"...\"} 형식이어야 합니다.") from exc
        raw_text = payload.rawText.strip()
        if not raw_text:
            raise bad_request("rawText가 비어 있습니다.")
        if len(raw_text) > settings.max_raw_text_chars:
            raise bad_request(f"rawText는 최대 {settings.max_raw_text_chars}자입니다.")
        return await extraction.extract_text(raw_text)

    raise bad_request("지원하지 않는 Content-Type입니다 (image/png · image/jpeg · application/json).")
