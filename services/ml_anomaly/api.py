
"""
SouHimBou AI - The Speech Center (API)
"The Voice of the Soul"

Responsibility:
    - Expose the Anomaly Detection Model via HTTP
    - Allow the Motherboard (Go Layer) to query for "Intuition" (Anomaly Scores)
    - Allow triggering of "Awakening" (Retraining)
"""
import sys
import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Optional
import uvicorn
import torch
import numpy as np

# Add project root to path
sys.path.append(str(Path(__file__).resolve().parents[2]))

# Import internal services
try:
    from services.ml_anomaly.models import EnsembleAnomalyDetector
    from services.ml_anomaly.config import settings
    from services.ml_anomaly.training.data_loader import SouHimBouLoader
    from services.ml_anomaly.training.train import SoulBiasedTrainer
except ImportError as e:
    # Fallback/Mock for initial setup if imports fail due to path issues
    logging.error(f"Import Error: {e}")
    # We will let it fail hard so we know to fix paths
    raise e

from contextlib import asynccontextmanager

# --- Startup/Shutdown ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model_instance, loader_instance, model_state
    logger.info("SouHimBou API Awakening...")
    
    # 1. Load Soul
    try:
        loader_instance = SouHimBouLoader(
            secret_path=settings.secret_docs_path,
            cyber_brain_path=settings.cyber_brain_path
        )
        loader_instance.load_unified_corpus()
        model_state["soul_embedding"] = loader_instance.get_unified_embedding()
        logger.info(f"Soul Loaded. Dominant: {max(model_state['soul_embedding'], key=model_state['soul_embedding'].get)}")
    except Exception as e:
        logger.error(f"Failed to load Soul: {e}")
        model_state["status"] = "SOUL_FRAGMENTED"

    # 2. Load Model
    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model_instance = EnsembleAnomalyDetector(
            feature_dim=settings.feature_dim,
            hidden_dim=settings.hidden_dim,
            latent_dim=settings.latent_dim
        ).to(device)
        
        # Try load weights
        if Path(settings.model_path).exists():
            model_instance.load_state_dict(torch.load(settings.model_path, map_location=device))
            model_instance.eval()
            model_state["model_loaded"] = True
            model_state["status"] = "ONLINE"
            logger.info("Model Weights Loaded Successfully.")
        else:
            logger.warning("No pre-trained model found. Operating in UNTRAINED mode.")
            model_state["status"] = "UNTRAINED"
            
    except Exception as e:
        logger.error(f"Failed to load Model: {e}")
        model_state["status"] = "BRAIN_DAMAGE"

    yield

# Initialize API
app = FastAPI(
    title="SouHimBou AI API",
    description="Interface for the Khepra Anomaly Detection Service (The Right Brain)",
    version=settings.service_version,
    lifespan=lifespan
)

# --- Endpoints ---

@app.get("/")
async def root():
    return {
        "service": "SouHimBou AI",
        "status": model_state["status"],
        "soul_integrity": "STABLE" if model_state["soul_embedding"] else "FRAGMENTED"
    }

@app.get("/soul")
async def get_soul():
    """Returns the current Soul Embedding (Adinkra + Persona mapping)"""
    return {
        "embedding": model_state["soul_embedding"],
        "dominant_archetype": max(model_state["soul_embedding"], key=model_state["soul_embedding"].get) if model_state["soul_embedding"] else "None"
    }

@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """
    Get an anomaly score for a feature vector.
    This is the "Intuition" query from the Motherboard.
    """
    if not model_instance or not model_state["model_loaded"]:
         # Mock response for dev/testing if model not ready
         logger.warning("Model not ready. Returning mock prediction.")
         return PredictResponse(
             anomaly_score=0.0,
             is_anomaly=False,
             confidence=0.0,
             archetype_influence={"Note": 0.0} # Fixed Validation Error
         )
    
    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        features_tensor = torch.tensor(request.features, dtype=torch.float32).unsqueeze(0).to(device)
        
        with torch.no_grad():
            result = model_instance(features_tensor)
            
        score = result["anomaly_score"].item()
        
        # Explainability Mockup (Real implementation would use attention weights)
        # We project the Soul Bias onto the result
        influence = {}
        if model_state["soul_embedding"]:
            dom_trait = max(model_state["soul_embedding"], key=model_state["soul_embedding"].get)
            influence[dom_trait] = score * 0.8 # The dominant trait "explains" 80% of the decision
            
        return PredictResponse(
            anomaly_score=score,
            is_anomaly=score > settings.anomaly_threshold,
            confidence=result["confidence"].item(),
            archetype_influence=influence
        )
            
    except Exception as e:
        logger.error(f"Prediction Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def run_training_task():
    """Background task to run training"""
    logger.info("Initiating Background Training Sequence...")
    try:
        trainer = SoulBiasedTrainer()
        trainer.awaken(epochs=settings.epochs)
        
        # Reload global model
        global model_instance
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model_instance.load_state_dict(torch.load(settings.model_path, map_location=device))
        model_instance.eval()
        model_state["model_loaded"] = True
        model_state["status"] = "ONLINE"
        logger.info("Training Complete. New Consciousness Loaded.")
    except Exception as e:
        logger.error(f"Training Failed: {e}")
        model_state["status"] = "TRAINING_FAILED"

@app.post("/train")
async def trigger_training(request: TrainingRequest, background_tasks: BackgroundTasks):
    """Triggers the 'Awakening' (Retraining) process in the background."""
    if model_state["status"] == "TRAINING":
        raise HTTPException(status_code=409, detail="Training already in progress")
    
    model_state["status"] = "TRAINING"
    background_tasks.add_task(run_training_task)
    return {"message": "Awakening Sequence Initiated", "estimated_duration": "2 minutes"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
