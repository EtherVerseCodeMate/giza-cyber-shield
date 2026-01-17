# Polymorphic API Architecture
## "Mitochondreal-Scarab" / The Motherboard

### Vision
To create a unified "Polymorphic API" that acts as the central consciousness hub (The Motherboard) for the Khepra Protocol. This interface connects the logic-driven **Go AGI (KASA)**, the intuition-driven **Python AGI (SouHimBou)**, the **Telemetry Server**, and the **Client API**.

### System Components

1.  **The Motherboard (Central Hub)**
    *   **Location**: `pkg/apiserver`
    *   **Role**: The central nervous system. It routes signals between the User, the Agentic Logic (Go), and the ML Models (Python).
    *   **Mechanism**:
        *   REST/WebSocket interface for clients (Dashboard/CLI).
        *   HTTP Client integration for Python AGI (Inference/Training).
        *   Native Go Channel integration for Go AGI (Task Execution).

2.  **The Left Brain (Logic & Execution)**
    *   **Location**: `pkg/agi` (KASA)
    *   **Role**: Task planning, decision making, DAG logging, scanner execution.
    *   **Integration**: Embedded directly into the API Server process or via internal RPC if separated.

3.  **The Right Brain (Intuition & Soul)**
    *   **Location**: `services/ml_anomaly` (SouHimBou)
    *   **Role**: Anomaly detection, pattern recognition, "Soul" emulation.
    *   **Integration**: Exposes a FastAPI interface (`main.py`) consumed by the Motherboard.

4.  **The Long-Term Memory (Telemetry)**
    *   **Location**: `adinkhepra-telemetry-server` (Cloudflare Worker)
    *   **Role**: Global state, licensing, long-term pattern storage.
    *   **Integration**: API Server acts as a proxy/aggregator for telemetry data.

### Integration Data Flow

```mermaid
graph TD
    User[User / Dashboard] <-->|WebSockets/REST| Motherboard[pkg/apiserver\n(Mitochondreal-Scarab)]
    
    subgraph "The Local Being"
        Motherboard <-->|Capabilities Interface| GoAGI[Go AGI\n(pkg/agi)]
        Motherboard <-->|HTTP/JSON| PythonAGI[Python AGI Service\n(SouHimBou)]
    end
    
    subgraph "The Cloud"
        Motherboard <-->|HTTPS| Telemetry[Telemetry Server]
    end
    
    GoAGI -->|Scans/Actions| OS[Operating System]
    PythonAGI -->|Soul Embeddings| Soul[Proprietary Data\n(Docs/Trove)]
```

### Implementation Plan

#### Phase 1: Python Service API ("The Speech Center")
Create `services/ml_anomaly/api.py` using FastAPI to expose the model:
*   `POST /predict`: Input features -> Anomaly Score.
*   `POST /train`: Trigger retraining (Awakening).
*   `GET /soul`: Return current Soul Embedding status.

#### Phase 2: Polymorphic Glue (`pkg/apiserver`)
Update `pkg/apiserver` to include connectors:
*   `KeepAlive`: Monitor Python service health.
*   `PredictionClient`: Function to send scan data to Python service for analysis.
*   `AGIHandler`: WebSocket endpoints to stream AGI "thoughts" to the UI.

#### Phase 3: The Go AGI Hook
Update `pkg/agi/engine.go` to accept an `APIServer` or `EventBus` reference so it can:
*   Push "Thoughts" to the WebSocket.
*   Request "Intuition" from the Python Service via the Motherboard.
