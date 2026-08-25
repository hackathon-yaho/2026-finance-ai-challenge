class ContractError(Exception):
    """internal-api-contract.md 오류 절의 {error, message, fallback} 형식으로 내려가는 예외."""

    def __init__(self, status_code: int, error: str, message: str, fallback: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.error = error
        self.message = message
        self.fallback = fallback

    def body(self) -> dict:
        payload = {"error": self.error, "message": self.message}
        if self.fallback is not None:
            payload["fallback"] = self.fallback
        return payload


def extraction_failed(message: str, *, fallback: bool = True) -> ContractError:
    """fallback은 이미지 경로에서만 붙인다.

    이미 텍스트로 보낸 요청에 "텍스트로 입력하세요"를 대안으로 주면 같은 자리를
    맴돈다 (계약 "fallback은 이미지 경로에만" 절).
    """
    return ContractError(
        502, "EXTRACTION_FAILED", message, fallback="text_input" if fallback else None
    )


def timeout_error(*, fallback: bool = True) -> ContractError:
    return ContractError(
        504, "TIMEOUT", "AI 처리 시간이 초과되었습니다.", fallback="text_input" if fallback else None
    )


def config_error() -> ContractError:
    """AI-server 설정 오류 — 사용자 입력과 무관하고, 다시 시도해도 같다.

    판독 실패(EXTRACTION_FAILED)로 감싸면 백엔드가 사용자를 텍스트 입력으로
    보내는데, 그래도 해결되지 않는다. 재시도도 하지 않는다.
    """
    return ContractError(
        500, "AI_CONFIG_ERROR", "AI 서버 설정에 문제가 있습니다. 관리자 확인이 필요합니다."
    )


def quota_exceeded() -> ContractError:
    return ContractError(429, "QUOTA_EXCEEDED", "LLM API 쿼터를 초과했습니다.")


def draft_failed(message: str) -> ContractError:
    return ContractError(502, "DRAFT_FAILED", message)


def unauthorized() -> ContractError:
    return ContractError(401, "UNAUTHORIZED", "유효한 X-Internal-Token이 필요합니다.")


def bad_request(message: str) -> ContractError:
    return ContractError(400, "BAD_REQUEST", message)
