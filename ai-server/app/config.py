"""환경 설정.

`.env`를 **프로세스 환경변수로 올린다.** pydantic-settings는 `.env` 값을 Settings
객체에만 채우고 `os.environ`에는 넣지 않는데, LLM SDK는 `os.environ`에서 키를
읽는다 — 이 한 줄이 없으면 `.env`에 키를 넣어도 SDK가 보지 못한다.

`override=False`이므로 **실제 배포 환경이 항상 이긴다.** Cloud Run이 Secret
Manager에서 주입한 환경변수를 로컬 `.env` 파일이 덮어쓰는 일은 없다.

LLM 공급자는 **OpenAI**다(2026-08-26 확정). 키는 `set-key.ps1`로 등록한다. `.env`는 `.gitignore`에 있어
저장소에 올라가지 않는다.
"""

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv(override=False)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    internal_token: str = ""
    # 추출과 소명서는 요구가 다르다 — 실측(evals/README.md)에 근거해 나눈다.
    # 추출: 이미지가 붙어 느리고 NFR-01(p95 8초)이 걸려 있다. mini가 p95 4.4s로
    #       여유 있게 들어오고, 정확도 차이는 24건 세트에서 1~2케이스 수준이다.
    # 소명서: 텍스트만이라 빠르고, 문장 품질이 결과물의 핵심이다.
    ai_model: str = "gpt-5.4-mini"
    draft_model: str = "gpt-5.5"
    extract_effort: str = "low"
    draft_effort: str = "medium"
    llm_timeout_extract: float = 15.0
    llm_timeout_draft: float = 10.0
    handler_budget_extract: float = 18.0
    handler_budget_draft: float = 13.0
    max_concurrency: int = 4
    max_image_bytes: int = 10 * 1024 * 1024
    max_raw_text_chars: int = 2000


settings = Settings()
