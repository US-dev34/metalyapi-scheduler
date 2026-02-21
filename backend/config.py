"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration for the MetalYapi Scheduling API.

    Values are read from environment variables or a `.env` file located in the
    project root.
    """

    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_key: str = ""
    claude_api_key: str = ""
    claude_model: str = "claude-sonnet-4-20250514"
    cors_origins: list[str] = ["http://localhost:5173"]
    environment: str = "development"
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
