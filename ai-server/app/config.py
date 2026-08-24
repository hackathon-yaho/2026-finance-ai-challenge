from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    internal_token: str = ""
    ai_model: str = "claude-opus-5"
    extract_effort: str = "low"
    draft_effort: str = "medium"
    llm_timeout_extract: float = 12.0
    llm_timeout_draft: float = 10.0
    handler_budget_extract: float = 18.0
    handler_budget_draft: float = 13.0
    max_concurrency: int = 4
    max_image_bytes: int = 10 * 1024 * 1024
    max_raw_text_chars: int = 2000


settings = Settings()
