import hmac

from fastapi import Header

from .config import settings
from .errors import unauthorized


async def require_internal_token(x_internal_token: str | None = Header(default=None)) -> None:
    expected = settings.internal_token
    if not expected or not x_internal_token:
        raise unauthorized()
    if not hmac.compare_digest(x_internal_token.encode(), expected.encode()):
        raise unauthorized()
