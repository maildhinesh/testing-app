from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/tamil_test"

    # Security
    jwt_secret: str = "change-me"
    jwt_expire_minutes: int = 480
    email_verify_expire_minutes: int = 1440
    magic_link_expire_minutes: int = 2880

    # Bootstrap admin
    admin_email: str = "admin@example.com"
    admin_password: str = "admin12345"
    admin_name: str = "Test Admin"

    # SMTP
    smtp_host: str = "localhost"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@example.com"
    smtp_use_tls: bool = True

    # URLs
    frontend_base_url: str = "http://localhost:5173"
    backend_base_url: str = "http://localhost:8000"

    # Test rules
    test_total_minutes: int = 75

    # Deployment environment: "development" | "production".
    # In production the app refuses to boot with insecure default secrets.
    environment: str = "development"

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() in {"production", "prod"}


# Values that are fine locally but must never reach production.
INSECURE_DEFAULTS = {
    "jwt_secret": "change-me",
    "admin_password": "admin12345",
}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
