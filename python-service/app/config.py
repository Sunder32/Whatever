from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from typing import Optional
from functools import lru_cache
import tempfile
import os


class Settings(BaseSettings):
    app_name: str = "Diagram App Python Service"
    app_version: str = "1.0.0"
    debug: bool = False
    
    host: str = "0.0.0.0"
    port: int = 5000
    workers: int = 4
    
    database_url: str = Field(
        default="postgresql://diagram:diagram_secret@localhost:5432/diagram_db",
        description="PostgreSQL connection URL"
    )
    database_pool_size: int = 10
    database_max_overflow: int = 20
    
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL"
    )
    redis_ttl: int = 3600
    
    go_backend_url: str = Field(
        default="http://localhost:9000",
        description="Go backend service URL"
    )
    
    jwt_secret: str = Field(
        default="your-super-secret-jwt-key-change-in-production",
        description="JWT secret key"
    )
    jwt_algorithm: str = "HS256"
    
    encryption_key: Optional[str] = None
    encryption_salt_length: int = 16
    encryption_iterations: int = 100000
    
    max_file_size: int = 50 * 1024 * 1024
    allowed_image_types: list[str] = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"]
    
    export_temp_dir: str = Field(
        default="",
        description="Temp dir for exports (auto-detected if empty)"
    )
    export_max_width: int = 8192
    export_max_height: int = 8192
    export_default_dpi: int = 150
    
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:9000"]
    cors_allow_credentials: bool = True

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v
    
    log_level: str = "INFO"
    log_format: str = "json"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
