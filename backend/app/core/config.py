from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "sqlite:///./data/projectflow.sqlite"
    llm_provider: str = "openai"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
