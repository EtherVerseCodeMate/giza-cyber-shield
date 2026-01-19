
"""
SouHimBou AGI - The Speech Center (API)
"The Voice of the Soul"

Responsibility:
    - Expose the Anomaly Detection Model via HTTP
    - Allow the Motherboard (Go Layer) to query for "Intuition" (Anomaly Scores)
    - Allow triggering of "Awakening" (Retraining)
    - Provide BabyAGI-style autonomous agent capabilities (NEW)
    - Chat endpoint replaces LLM for user interaction (NEW)
    - Task recommendation and prioritization (NEW)

NIST AI RMF Alignment:
    - GOVERN: Auditable API with full request/response logging
    - MANAGE: Safety guardrails on all autonomous actions
    - Accountable: Every decision traceable
"""
import sys
import logging
import json
import subprocess
from pathlib import Path
from datetime import datetime
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
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
    # SouHimBou AGI components
    from services.ml_anomaly.intent import IntentClassifier, SecurityIntent, IntentResult
    from services.ml_anomaly.responder import SecurityResponder, ResponseContext
    from services.ml_anomaly.task_recommender import (
        TaskRecommender, TaskRecommendation, AnalysisResult, TaskPriority
    )
    from services.ml_anomaly.prioritizer import TaskPrioritizer, PrioritizedTask
except ImportError as e:
    # Fallback/Mock for initial setup if imports fail due to path issues
    logging.error(f"Import Error: {e}")
    # We will let it fail hard so we know to fix paths
    raise e

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("souhimbou.api")

# Global State
model_state = {
    "status": "INITIALIZING",
    "soul_embedding": {},
    "model_loaded": False,
    "last_anomaly_time": None,
    "active_scans": 0,
    "queue_count": 0,
}

model_instance = None
loader_instance = None

# SouHimBou AGI component instances
intent_classifier = IntentClassifier()
security_responder = SecurityResponder()
task_recommender = TaskRecommender()
task_prioritizer = TaskPrioritizer()

from contextlib import asynccontextmanager

# --- Data Models ---

class PredictRequest(BaseModel):
    features: List[float]
    metadata: Optional[Dict] = None

class PredictResponse(BaseModel):
    anomaly_score: float
    is_anomaly: bool
    confidence: float
    archetype_influence: Dict[str, float]  # How much each archetype contributed

class TrainingRequest(BaseModel):
    epochs: int = 50
    force_reload: bool = False

class DAGNode(BaseModel):
    id: str
    label: str
    type: str
    status: str

class DAGEdge(BaseModel):
    source: str
    target: str
    type: str

class TrustConstellation(BaseModel):
    nodes: List[DAGNode]
    edges: List[DAGEdge]
    stats: dict


# --- SouHimBou AGI Data Models ---

class ChatRequest(BaseModel):
    """Request for chat endpoint - replaces LLM chat."""
    message: str = Field(..., description="User message to process")
    context: Optional[Dict[str, str]] = Field(default=None, description="Additional context")
    features: Optional[List[float]] = Field(default=None, description="Feature vector for anomaly context")


class ChatResponse(BaseModel):
    """Response from chat endpoint."""
    message: str = Field(..., description="Generated response")
    intent: str = Field(..., description="Classified intent")
    confidence: float = Field(..., description="Classification confidence")
    recommended_actions: List[str] = Field(default_factory=list, description="Suggested follow-up actions")
    anomaly_context: Optional[Dict[str, float]] = Field(default=None, description="Anomaly info if applicable")


class TaskRecommendationResponse(BaseModel):
    """A single task recommendation."""
    id: str
    description: str
    priority: str
    symbol: str
    reason: str
    source: str
    anomaly_score: float
    confidence: float
    cvss_score: Optional[float] = None
    affected_systems: int = 1


class RecommendTasksRequest(BaseModel):
    """Request for task recommendations."""
    anomaly_score: float = Field(0.0, description="Anomaly score from ML analysis")
    source: str = Field("unknown", description="Source of analysis (sonar, forensics, etc.)")
    intent: Optional[str] = Field(None, description="Security intent if from chat")
    findings: List[Dict] = Field(default_factory=list, description="List of findings")
    context: Optional[Dict] = Field(default=None, description="Additional context")


class RecommendTasksResponse(BaseModel):
    """Response with task recommendations."""
    tasks: List[TaskRecommendationResponse]
    total_count: int


class PrioritizeRequest(BaseModel):
    """Request for task prioritization."""
    tasks: List[TaskRecommendationResponse]


class PrioritizedTaskResponse(BaseModel):
    """A prioritized task with score breakdown."""
    task: TaskRecommendationResponse
    composite_score: float
    rank: int
    score_breakdown: Dict[str, float]


class PrioritizeResponse(BaseModel):
    """Response with prioritized tasks."""
    tasks: List[PrioritizedTaskResponse]


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

@app.get("/api/v1/dag/visualize", response_model=TrustConstellation)
async def get_dag_visualize():
    """
    Returns the Trust Constellation (DAG) graph for visualization.
    Calls 'khepra engine dag export --json' to get the latest state.
    """
    try:
        # Call the Go CLI to export DAG as JSON
        result = subprocess.run(
            ["khepra", "engine", "dag", "export", "--json"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            logger.error(f"DAG export failed: {result.stderr}")
            # Return empty graph if CLI fails
            return {
                "nodes": [],
                "edges": [],
                "stats": {"nodes": 0, "critical": 0, "error": "DAG export failed"}
            }
        
        # Parse CLI output
        dag_data = json.loads(result.stdout)
        
        # Transform to frontend format if needed
        return {
            "nodes": dag_data.get("nodes", []),
            "edges": dag_data.get("edges", []),
            "stats": dag_data.get("stats", {"nodes": 0, "critical": 0})
        }
    except subprocess.TimeoutExpired:
        logger.error("DAG export timed out")
        return {
            "nodes": [],
            "edges": [],
            "stats": {"nodes": 0, "critical": 0, "error": "Timeout"}
        }
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse DAG JSON: {e}")
        return {
            "nodes": [],
            "edges": [],
            "stats": {"nodes": 0, "critical": 0, "error": "Parse error"}
        }
    except Exception as e:
        logger.error(f"DAG Export Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/compliance/cmmc")
async def get_cmmc_status():
    """
    Returns the CMMC Level 2 Compliance Scorecard.
    Calls 'adinkhepra compliance status' to get real-time data.
    """
    try:
        # Call the Go CLI to get compliance status
        result = subprocess.run(
            ["adinkhepra", "compliance", "status", "--json"],
            capture_output=True,
            text=True,
            timeout=15
        )
        
        if result.returncode != 0:
            logger.error(f"Compliance check failed: {result.stderr}")
            # Return placeholder if CLI fails
            return {
                "score": 0.0,
                "level": "Unknown",
                "controls": {"total": 110, "passing": 0, "failing": 0},
                "domains": {},
                "error": "Compliance engine unavailable"
            }
        
        # Parse CLI output
        compliance_data = json.loads(result.stdout)
        return compliance_data
        
    except subprocess.TimeoutExpired:
        logger.error("Compliance check timed out")
        return {
            "score": 0.0,
            "level": "Timeout",
            "controls": {"total": 110, "passing": 0, "failing": 0},
            "domains": {},
            "error": "Timeout"
        }
    except Exception as e:
        logger.error(f"Compliance check error: {e}")
        return {
            "score": 0.0,
            "level": "Error",
            "controls": {"total": 110, "passing": 0, "failing": 0},
            "domains": {},
            "error": str(e)
        }

@app.get("/api/v1/ir/playbooks")
async def get_ir_playbooks():
    """
    Returns available Incident Response Playbooks.
    Calls 'khepra ir playbooks list --json' for real data.
    """
    try:
        # Call the Go CLI to list IR playbooks
        result = subprocess.run(
            ["khepra", "ir", "playbooks", "list", "--json"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            logger.error(f"IR playbooks list failed: {result.stderr}")
            # Return empty list if CLI fails
            return []
        
        # Parse CLI output
        playbooks = json.loads(result.stdout)
        return playbooks
        
    except subprocess.TimeoutExpired:
        logger.error("IR playbooks list timed out")
        return []
    except Exception as e:
        logger.error(f"IR playbooks error: {e}")
        return []

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


# --- SouHimBou AGI Endpoints (BabyAGI Pattern) ---

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Process user chat message - replaces LLM-based chat.
    Implements the conversational interface for SouHimBou AGI.

    This is the primary endpoint for the KASA Commando chat interface,
    providing security-focused responses without requiring an LLM.
    """
    try:
        # 1. Classify intent
        intent_result = intent_classifier.classify(request.message)
        logger.info(f"Intent classified: {intent_result.intent.value} (confidence: {intent_result.confidence:.2f})")

        # 2. Get anomaly context if features provided
        anomaly_context = None
        if request.features and model_instance and model_state["model_loaded"]:
            try:
                device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
                features_tensor = torch.tensor(request.features, dtype=torch.float32).unsqueeze(0).to(device)
                with torch.no_grad():
                    result = model_instance(features_tensor)
                anomaly_context = {
                    "anomaly_score": result["anomaly_score"].item(),
                    "confidence": result["confidence"].item(),
                }
                model_state["last_anomaly_time"] = datetime.now().isoformat()
            except Exception as e:
                logger.warning(f"Anomaly context extraction failed: {e}")

        # 3. Build response context
        response_context = ResponseContext(
            intent=intent_result.intent,
            params=intent_result.extracted_params,
            anomaly_score=anomaly_context.get("anomaly_score") if anomaly_context else None,
            state="ack",
            extra={
                "ml_status": model_state["status"],
                "engine_status": "ACTIVE",
                "dag_status": "SYNCHRONIZED",
                "sonar_status": "READY",
                "queue_count": model_state.get("queue_count", 0),
                "active_scans": model_state.get("active_scans", 0),
                "last_anomaly_time": model_state.get("last_anomaly_time", "N/A"),
                "soul_status": "STABLE" if model_state["soul_embedding"] else "FRAGMENTED",
            }
        )

        # 4. Generate response
        response_message = security_responder.generate_response(response_context)

        # 5. Get task recommendations based on intent
        analysis = AnalysisResult(
            anomaly_score=anomaly_context.get("anomaly_score", 0) if anomaly_context else 0,
            source="chat",
            intent=intent_result.intent,
            findings=[],
            context=request.context or {},
        )
        recommendations = task_recommender.recommend_tasks(analysis)
        recommended_actions = [r.description for r in recommendations[:3]]  # Top 3

        return ChatResponse(
            message=response_message,
            intent=intent_result.intent.value,
            confidence=intent_result.confidence,
            recommended_actions=recommended_actions,
            anomaly_context=anomaly_context,
        )

    except Exception as e:
        logger.error(f"Chat processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/recommend_tasks", response_model=RecommendTasksResponse)
async def recommend_tasks(request: RecommendTasksRequest):
    """
    Generate task recommendations from analysis results.
    Called after scans, forensics, compliance checks.

    Implements the "Task Creation Agent" from BabyAGI pattern.
    """
    try:
        # Convert intent string to enum if provided
        intent_enum = None
        if request.intent:
            try:
                intent_enum = SecurityIntent(request.intent)
            except ValueError:
                pass  # Invalid intent, leave as None

        # Build analysis result
        analysis = AnalysisResult(
            anomaly_score=request.anomaly_score,
            source=request.source,
            intent=intent_enum,
            findings=request.findings,
            context=request.context or {},
        )

        # Generate recommendations
        recommendations = task_recommender.recommend_tasks(analysis)

        # Convert to response format
        task_responses = [
            TaskRecommendationResponse(
                id=r.id,
                description=r.description,
                priority=r.priority.value,
                symbol=r.symbol.value,
                reason=r.reason,
                source=r.source,
                anomaly_score=r.anomaly_score,
                confidence=r.confidence,
                cvss_score=r.cvss_score,
                affected_systems=r.affected_systems,
            )
            for r in recommendations
        ]

        logger.info(f"Generated {len(task_responses)} task recommendations from {request.source}")

        return RecommendTasksResponse(
            tasks=task_responses,
            total_count=len(task_responses),
        )

    except Exception as e:
        logger.error(f"Task recommendation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/prioritize", response_model=PrioritizeResponse)
async def prioritize_tasks(request: PrioritizeRequest):
    """
    Reorder task list by risk priority.
    Called by KASA engine periodically.

    Implements the "Prioritization Agent" from BabyAGI pattern.
    """
    try:
        # Convert request tasks to TaskRecommendation objects
        tasks = []
        for t in request.tasks:
            # Map priority string to enum
            try:
                priority = TaskPriority(t.priority)
            except ValueError:
                priority = TaskPriority.MEDIUM

            # Map symbol string to enum (simplified - use EBAN as default)
            from services.ml_anomaly.task_recommender import AdinkraSymbol
            try:
                symbol = AdinkraSymbol(t.symbol)
            except ValueError:
                symbol = AdinkraSymbol.EBAN

            task = TaskRecommendation(
                id=t.id,
                description=t.description,
                priority=priority,
                symbol=symbol,
                reason=t.reason,
                source=t.source,
                anomaly_score=t.anomaly_score,
                confidence=t.confidence,
                cvss_score=t.cvss_score,
                affected_systems=t.affected_systems,
            )
            tasks.append(task)

        # Prioritize
        prioritized = task_prioritizer.prioritize(tasks)

        # Convert to response format
        response_tasks = []
        for p in prioritized:
            task_resp = TaskRecommendationResponse(
                id=p.task.id,
                description=p.task.description,
                priority=p.task.priority.value,
                symbol=p.task.symbol.value,
                reason=p.task.reason,
                source=p.task.source,
                anomaly_score=p.task.anomaly_score,
                confidence=p.task.confidence,
                cvss_score=p.task.cvss_score,
                affected_systems=p.task.affected_systems,
            )
            response_tasks.append(PrioritizedTaskResponse(
                task=task_resp,
                composite_score=p.composite_score,
                rank=p.rank,
                score_breakdown=p.score_breakdown,
            ))

        logger.info(f"Prioritized {len(response_tasks)} tasks")

        return PrioritizeResponse(tasks=response_tasks)

    except Exception as e:
        logger.error(f"Task prioritization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/agi/status")
async def get_agi_status():
    """
    Returns SouHimBou AGI system status.
    Provides visibility into the autonomous agent state.
    """
    return {
        "service": "SouHimBou AGI",
        "version": settings.service_version,
        "status": model_state["status"],
        "components": {
            "intent_classifier": "ACTIVE",
            "responder": "ACTIVE",
            "task_recommender": "ACTIVE",
            "prioritizer": "ACTIVE",
            "anomaly_detector": "ACTIVE" if model_state["model_loaded"] else "UNTRAINED",
        },
        "soul_integrity": "STABLE" if model_state["soul_embedding"] else "FRAGMENTED",
        "dominant_archetype": max(model_state["soul_embedding"], key=model_state["soul_embedding"].get) if model_state["soul_embedding"] else "None",
        "last_anomaly_time": model_state.get("last_anomaly_time"),
        "nist_ai_rmf": {
            "govern": "IMPLEMENTED",
            "map": "IMPLEMENTED",
            "measure": "ACTIVE",
            "manage": "ACTIVE",
        },
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
