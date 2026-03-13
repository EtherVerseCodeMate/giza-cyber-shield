"""
Configuration for Khepra ML Anomaly Detection Service
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, validator, SecretStr
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    """Service configuration loaded from environment variables"""

    # Service Configuration
    service_name: str = "adinkhepra-ml-anomaly"
    service_version: str = "1.0.0"
    host: str = Field(default="0.0.0.0", description="API host")
    port: int = Field(default=8080, ge=1, le=65535, description="API port")
    debug: bool = False
    log_level: str = Field(default="INFO", description="Logging level")

    # Model Configuration
    model_path: str = "./models/souhimbou_v1.pt"
    model_version: str = "v1.0.0"
    feature_dim: int = Field(default=32, gt=0)
    hidden_dim: int = Field(default=64, gt=0)
    latent_dim: int = Field(default=16, gt=0)

    # Training Configuration
    learning_rate: float = Field(default=0.001, gt=0, lt=1)
    batch_size: int = Field(default=64, gt=0)
    epochs: int = Field(default=100, gt=0)
    contamination_ratio: float = Field(default=0.05, ge=0, le=0.5)

    # Inference Configuration
    anomaly_threshold: float = Field(default=0.5, ge=0, le=1)
    confidence_threshold: float = Field(default=0.7, ge=0, le=1)
    max_inference_time_ms: int = Field(default=100, gt=0)

    # Learning Mode
    enable_online_learning: bool = True
    learning_buffer_size: int = Field(default=10000, gt=0)
    baseline_update_interval: int = Field(default=3600, gt=0)

    # Metrics & Monitoring
    enable_metrics: bool = True
    metrics_port: int = Field(default=9090, ge=1, le=65535)

    # Data Source (The "Soul") - Optional paths to local training corpora.
    # When unset, SouHimBou initializes without personal-context embeddings,
    # which is the correct default for container deployments.
    # Override via env:
    #   ADINKHEPRA_ML_CLASSIFIED_DOCS_PATH=/mnt/soul/patents
    #   ADINKHEPRA_ML_CYBER_BRAIN_PATH=/mnt/soul/cyber-brain
    classified_docs_path: Optional[Path] = None
    cyber_brain_path: Optional[Path] = None

    # Access Token for external API calls (if any)
    internal_api_key: Optional[SecretStr] = None

    model_config = SettingsConfigDict(
        env_prefix="ADINKHEPRA_ML_",
        case_sensitive=False
    )

    @validator("log_level")
    def validate_log_level(cls, v):
        levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in levels:
            raise ValueError(f"Log level must be one of {levels}")
        return v.upper()


settings = Settings()
