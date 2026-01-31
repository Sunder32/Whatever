from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
from functools import lru_cache


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
    
    export_temp_dir: str = "/tmp/diagram-exports"
    export_max_width: int = 8192
    export_max_height: int = 8192
    export_default_dpi: int = 150
    
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:9000"]
    cors_allow_credentials: bool = True
    
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
