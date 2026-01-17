"""
Configuration for Khepra ML Anomaly Detection Service
"""
import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Service configuration loaded from environment variables"""

    # Service Configuration
    service_name: str = "adinkhepra-ml-anomaly"
    service_version: str = "1.0.0"
    host: str = "0.0.0.0"
    port: int = 8080
    debug: bool = False

    # Model Configuration
    model_path: str = "./models/anomaly_detector.pt"
    model_version: str = "v1.0.0"
    feature_dim: int = 32
    hidden_dim: int = 64
    latent_dim: int = 16

    # Training Configuration
    learning_rate: float = 0.001
    batch_size: int = 64
    epochs: int = 100
    contamination_ratio: float = 0.05  # Expected anomaly ratio

    # Inference Configuration
    anomaly_threshold: float = 0.5
    confidence_threshold: float = 0.7
    max_inference_time_ms: int = 100

    # Learning Mode
    enable_online_learning: bool = True
    learning_buffer_size: int = 10000
    baseline_update_interval: int = 3600  # seconds

    # Metrics & Monitoring
    enable_metrics: bool = True
    metrics_port: int = 9090

    class Config:
        env_prefix = "ADINKHEPRA_ML_"


settings = Settings()
