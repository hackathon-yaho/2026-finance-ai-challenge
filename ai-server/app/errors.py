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


def extraction_failed(message: str) -> ContractError:
    return ContractError(502, "EXTRACTION_FAILED", message, fallback="text_input")


def timeout_error() -> ContractError:
    return ContractError(504, "TIMEOUT", "AI 처리 시간이 초과되었습니다.")


def quota_exceeded() -> ContractError:
    return ContractError(429, "QUOTA_EXCEEDED", "LLM API 쿼터를 초과했습니다.")


def draft_failed(message: str) -> ContractError:
    return ContractError(502, "DRAFT_FAILED", message)


def unauthorized() -> ContractError:
    return ContractError(401, "UNAUTHORIZED", "유효한 X-Internal-Token이 필요합니다.")


def bad_request(message: str) -> ContractError:
    return ContractError(400, "BAD_REQUEST", message)
