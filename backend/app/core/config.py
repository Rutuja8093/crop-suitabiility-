from typing import List, Union, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "SoilPilot API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    SECRET_KEY: str = "insecure_dev_secret_key_change_in_production"

    # PostgreSQL Database URL with PostGIS
    DATABASE_URL: str = "postgresql://soilpilot_user:soilpilot_password@127.0.0.1:5432/soilpilot_db"

    # Open Government Data (data.gov.in) / AGMARKNET API Integration
    DATA_GOV_IN_API_KEY: Optional[str] = None
    AGMARKNET_RESOURCE_ID: str = "9ef84268-d588-465a-a308-a864a43d0070"
    AGMARKNET_API_BASE_URL: str = "https://api.data.gov.in/resource"

    # Open-Meteo Weather API Integration
    OPEN_METEO_API_KEY: Optional[str] = None

    # CORS Origins
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
