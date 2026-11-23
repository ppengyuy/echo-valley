from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """从 .env / 环境变量读取配置，见 backend/.env.example。"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Valley of Echoes API"
    database_url: str = "sqlite:///./data/valley.db"
    jwt_secret: str = "change-me"
    jwt_expire_days: int = 7
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = ""
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_enabled(self) -> bool:
        return bool(self.llm_base_url and self.llm_api_key and self.llm_model)


settings = Settings()
