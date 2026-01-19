# SouHimBou AGI: Autonomous Security Intelligence

> **Document Status**: Architecture Design
> **Created**: 2026-01-19
> **Goal**: Transform SouHimBou ML from anomaly detector to full BabyAGI-style autonomous agent, replacing LLM dependency

---

## Executive Summary

SouHimBou AI evolves from a passive anomaly detection service to an **autonomous security intelligence agent** capable of:
1. **Task Planning** - Create security tasks based on analysis
2. **Task Execution** - Execute security operations autonomously
3. **Prioritization** - Rank tasks by risk and urgency
4. **Conversational Assistance** - Replace LLM for user chat/guidance
5. **Anomaly Detection** - Original ML capability preserved

**Key Principle**: No LLM required. SouHimBou AGI runs entirely on the lightweight PyTorch ensemble (~270KB model).

---

## Architecture: BabyAGI Pattern for Security

### Original BabyAGI Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    BabyAGI Loop                             │
│                                                             │
│  1. Task Queue ─────────────────────────────────────────┐   │
│        │                                                │   │
│        ▼                                                │   │
│  2. Execution Agent ──── Execute Task ──── Result ─────┤   │
│        │                                                │   │
│        ▼                                                │   │
│  3. Task Creation Agent ──── Create New Tasks ─────────┤   │
│        │                                                │   │
│        ▼                                                │   │
│  4. Prioritization Agent ──── Reorder Queue ───────────┘   │
│                                                             │
│  REPEAT until objective achieved or queue empty             │
└─────────────────────────────────────────────────────────────┘
```

### SouHimBou AGI Adaptation

```
┌─────────────────────────────────────────────────────────────┐
│                 SouHimBou AGI Loop                          │
│                                                             │
│  1. Security Task Queue (DAG-backed)                        │
│        │                                                    │
│        ▼                                                    │
│  2. Execution Agent (Arsenal + Scanners)                    │
│        │ ──── Execute ──── Result ────┐                     │
│        │                              │                     │
│        ▼                              ▼                     │
│  3. Analysis Agent (ML Ensemble)      │                     │
│        │ ──── Anomaly Score ──────────┤                     │
│        │ ──── Task Recommendation ────┤                     │
│        │                              │                     │
│        ▼                              ▼                     │
│  4. Task Creation Agent (Rule + ML)   │                     │
│        │ ──── New Tasks ──────────────┤                     │
│        │                              │                     │
│        ▼                              ▼                     │
│  5. Prioritization Agent (Risk Scoring)                     │
│        │ ──── Reorder by CVSS + Anomaly ───────────────────┘│
│                                                             │
│  REPEAT (5-second tick in KASA engine)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Design

### 1. Security Task Queue (Already Exists)

**Location**: `pkg/agi/engine.go` - `Tasks []Task`

```go
type Task struct {
    ID          string
    Description string
    Priority    string // HIGH, MED, LOW
    Symbol      string // Adinkra Symbol
}
```

**Enhancement**: Add ML-derived fields

```go
type EnhancedTask struct {
    Task
    // ML enrichment
    AnomalyScore    float64            // From SouHimBou
    Confidence      float64            // ML confidence
    Source          string             // "sonar", "forensics", "ir", "compliance"
    Recommendation  string             // ML-generated action
    RelatedTasks    []string           // DAG linkage
    CreatedBy       string             // "user", "ml", "rule"
}
```

---

### 2. Execution Agent (Already Exists)

**Location**: `pkg/agi/engine.go` - Various execution methods

| Method | Purpose | Status |
|--------|---------|--------|
| `RunScan()` | Network/port scanning | ✅ Complete |
| `executeForensics()` | Evidence collection | ✅ Complete |
| `executePentest()` | Penetration testing | ✅ Complete |
| `executeCompliance()` | STIG/CMMC validation | ✅ Complete |
| `executeVulnHunt()` | Dependency scanning | ✅ Complete |

**Enhancement**: Add ML feedback loop after each execution

```go
func (e *Engine) executeTask(task Task) TaskResult {
    result := e.doExecution(task)

    // ML Analysis of execution result
    features := extractFeatures(result)
    mlResponse, _ := e.python.GetIntuition(features, map[string]string{
        "source": task.Source,
        "task_id": task.ID,
    })

    result.AnomalyScore = mlResponse.AnomalyScore
    result.MLRecommendation = mlResponse.Recommendation

    return result
}
```

---

### 3. Analysis Agent (NEW - SouHimBou ML Core)

**Location**: `services/ml_anomaly/` (Python service)

This is where SouHimBou gains "intelligence" beyond simple anomaly scoring.

#### 3.1 Intent Classification (Replaces LLM Chat)

```python
# services/ml_anomaly/intent.py

class IntentClassifier:
    """
    Rule-based + ML-enhanced intent classification.
    Replaces LLM for understanding user commands.
    """

    INTENT_PATTERNS = {
        "SCAN": ["scan", "check", "analyze", "assess", "audit"],
        "FIREWALL": ["block", "firewall", "deny", "restrict", "filter"],
        "REMEDIATE": ["fix", "patch", "remediate", "resolve", "repair"],
        "VULNHUNT": ["vulnerability", "cve", "exploit", "weakness"],
        "PENTEST": ["pentest", "penetration", "attack", "breach", "hack"],
        "FORENSICS": ["forensic", "evidence", "investigate", "incident"],
        "COMPLIANCE": ["stig", "cmmc", "nist", "compliance", "audit"],
        "HELP": ["help", "guide", "how", "what", "explain"],
        "STATUS": ["status", "state", "health", "running"],
    }

    def classify(self, message: str) -> IntentResult:
        """
        Classify user message into security intent.
        Uses keyword matching + context analysis.
        """
        message_lower = message.lower()
        scores = {}

        for intent, keywords in self.INTENT_PATTERNS.items():
            score = sum(1 for kw in keywords if kw in message_lower)
            scores[intent] = score

        best_intent = max(scores, key=scores.get)
        confidence = scores[best_intent] / max(len(message.split()), 1)

        return IntentResult(
            intent=best_intent,
            confidence=confidence,
            extracted_params=self._extract_params(message, best_intent)
        )

    def _extract_params(self, message: str, intent: str) -> dict:
        """Extract parameters based on intent."""
        params = {}

        if intent == "SCAN":
            # Extract target IP/hostname
            params["target"] = self._extract_target(message)
        elif intent == "FIREWALL":
            # Extract port number
            params["port"] = self._extract_port(message)
        elif intent == "COMPLIANCE":
            # Extract framework
            params["framework"] = self._extract_framework(message)

        return params
```

#### 3.2 Response Generation (Replaces LLM Chat)

```python
# services/ml_anomaly/responder.py

class SecurityResponder:
    """
    Template-based + ML-enhanced response generation.
    Replaces LLM for generating helpful responses.
    """

    RESPONSE_TEMPLATES = {
        "SCAN": {
            "ack": "COMMANDO ACKNOWLEDGED. Initiating {type} scan on {target}.",
            "progress": "Scan in progress... {progress}% complete. {findings} findings so far.",
            "complete": "Scan complete. {total} findings detected. Risk score: {risk}.",
        },
        "HELP": {
            "general": """KASA OPERATIONAL MANUAL:

Available Commands:
- SCAN [target] - Network/vulnerability scan
- FIREWALL [port] - Deploy micro-firewall rule
- REMEDIATE - Apply security patches
- VULNHUNT - Scan dependencies for CVEs
- PENTEST [target] - Internal penetration test
- FORENSICS - Collect system evidence
- COMPLIANCE [framework] - Run compliance check
- STATUS - System health report

Type any command or describe what you need.""",

            "scan": """SCAN COMMAND GUIDE:

Usage: scan [target]
Examples:
  - "scan localhost" - Scan local system
  - "scan 192.168.1.0/24" - Scan network range
  - "scan example.com" - Scan external host

Capabilities:
  - Port enumeration (1-65535)
  - Service fingerprinting
  - OS detection
  - Vulnerability correlation (CISA KEV)
  - AI anomaly scoring""",
        },
        "ANOMALY": {
            "low": "Analysis complete. Anomaly score: {score:.2f}. System within normal parameters.",
            "medium": "Analysis complete. Anomaly score: {score:.2f}. Minor deviations detected. Recommend monitoring.",
            "high": "WARNING: Anomaly score: {score:.2f}. Significant deviation detected. Immediate review recommended.",
            "critical": "ALERT: Critical anomaly detected ({score:.2f}). Potential security incident. Initiating automatic response.",
        }
    }

    def generate_response(self, intent: str, context: dict) -> str:
        """Generate response based on intent and context."""
        templates = self.RESPONSE_TEMPLATES.get(intent, {})

        # Select appropriate template based on context
        if "error" in context:
            return f"Operation failed: {context['error']}. Please retry or check logs."

        if "anomaly_score" in context:
            score = context["anomaly_score"]
            if score >= 0.85:
                template_key = "critical"
            elif score >= 0.6:
                template_key = "high"
            elif score >= 0.3:
                template_key = "medium"
            else:
                template_key = "low"
            return templates.get(template_key, "").format(**context)

        template_key = context.get("state", "ack")
        template = templates.get(template_key, f"Processing {intent} request...")

        return template.format(**context)
```

#### 3.3 Task Recommendation Engine

```python
# services/ml_anomaly/task_recommender.py

class TaskRecommender:
    """
    ML-powered task creation based on analysis results.
    This is the "Task Creation Agent" from BabyAGI.
    """

    def recommend_tasks(self, analysis_result: dict) -> List[TaskRecommendation]:
        """
        Generate task recommendations based on analysis.
        Uses anomaly detection + rule-based logic.
        """
        tasks = []
        score = analysis_result.get("anomaly_score", 0)
        source = analysis_result.get("source", "unknown")
        findings = analysis_result.get("findings", [])

        # High anomaly → Forensics task
        if score >= 0.7:
            tasks.append(TaskRecommendation(
                description="Emergency forensic snapshot",
                priority="HIGH",
                symbol="Sankofa",
                reason=f"High anomaly score ({score:.2f}) detected in {source}",
            ))

        # Compliance gaps → Remediation tasks
        for finding in findings:
            if finding.get("type") == "compliance_gap":
                tasks.append(TaskRecommendation(
                    description=f"Remediate {finding['control']} ({finding['framework']})",
                    priority=self._finding_to_priority(finding),
                    symbol="Eban",
                    reason=finding.get("description"),
                ))

        # Open ports → Firewall tasks
        for finding in findings:
            if finding.get("type") == "open_port" and finding.get("risk") == "high":
                tasks.append(TaskRecommendation(
                    description=f"Evaluate firewall rule for port {finding['port']}",
                    priority="MED",
                    symbol="Eban",
                    reason=f"High-risk port {finding['port']} open: {finding.get('service')}",
                ))

        # CVEs → Patch tasks
        for finding in findings:
            if finding.get("type") == "cve":
                tasks.append(TaskRecommendation(
                    description=f"Patch {finding['cve_id']} in {finding['package']}",
                    priority=self._cvss_to_priority(finding.get("cvss", 0)),
                    symbol="OwoForoAdobe",
                    reason=f"CVSS: {finding.get('cvss', 'N/A')} - {finding.get('description', '')}",
                ))

        return tasks

    def _finding_to_priority(self, finding: dict) -> str:
        severity = finding.get("severity", "").upper()
        return {"CRITICAL": "HIGH", "HIGH": "HIGH", "MEDIUM": "MED"}.get(severity, "LOW")

    def _cvss_to_priority(self, cvss: float) -> str:
        if cvss >= 9.0:
            return "HIGH"
        elif cvss >= 7.0:
            return "HIGH"
        elif cvss >= 4.0:
            return "MED"
        return "LOW"
```

#### 3.4 Prioritization Agent

```python
# services/ml_anomaly/prioritizer.py

class TaskPrioritizer:
    """
    Risk-based task prioritization.
    Uses anomaly scores + CVSS + business context.
    """

    PRIORITY_WEIGHTS = {
        "anomaly_score": 0.3,
        "cvss_score": 0.25,
        "compliance_impact": 0.2,
        "business_criticality": 0.15,
        "time_sensitivity": 0.1,
    }

    def prioritize(self, tasks: List[EnhancedTask]) -> List[EnhancedTask]:
        """
        Reorder tasks by composite risk score.
        """
        for task in tasks:
            task.composite_score = self._calculate_score(task)

        return sorted(tasks, key=lambda t: t.composite_score, reverse=True)

    def _calculate_score(self, task: EnhancedTask) -> float:
        score = 0.0

        # Anomaly contribution
        score += task.anomaly_score * self.PRIORITY_WEIGHTS["anomaly_score"]

        # CVSS contribution (if present)
        if hasattr(task, "cvss_score"):
            score += (task.cvss_score / 10.0) * self.PRIORITY_WEIGHTS["cvss_score"]

        # Compliance impact (HIGH=1.0, MED=0.5, LOW=0.2)
        priority_map = {"HIGH": 1.0, "MED": 0.5, "LOW": 0.2}
        score += priority_map.get(task.priority, 0.3) * self.PRIORITY_WEIGHTS["compliance_impact"]

        # Time sensitivity (tasks older than 1 hour get boost)
        if hasattr(task, "created_at"):
            age_hours = (datetime.now() - task.created_at).total_seconds() / 3600
            if age_hours > 1:
                score += min(age_hours / 24, 1.0) * self.PRIORITY_WEIGHTS["time_sensitivity"]

        return score
```

---

### 4. Enhanced API Endpoints

**Location**: `services/ml_anomaly/api.py`

```python
# New endpoints for SouHimBou AGI

@app.post("/chat")
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Process user chat message.
    Replaces LLM-based chat in KASA engine.
    """
    # 1. Classify intent
    intent_result = intent_classifier.classify(request.message)

    # 2. Get anomaly context (if relevant data provided)
    anomaly_context = {}
    if request.features:
        anomaly_context = await get_anomaly_context(request.features)

    # 3. Generate response
    response = responder.generate_response(
        intent=intent_result.intent,
        context={
            **intent_result.extracted_params,
            **anomaly_context,
            "message": request.message,
        }
    )

    # 4. Recommend actions
    recommendations = task_recommender.recommend_tasks({
        "intent": intent_result.intent,
        "anomaly_score": anomaly_context.get("anomaly_score", 0),
        "source": "chat",
    })

    return ChatResponse(
        message=response,
        intent=intent_result.intent,
        confidence=intent_result.confidence,
        recommended_actions=[r.description for r in recommendations],
    )


@app.post("/recommend_tasks")
async def recommend_tasks(request: AnalysisResult) -> TaskRecommendations:
    """
    Generate task recommendations from analysis results.
    Called after scans, forensics, compliance checks.
    """
    recommendations = task_recommender.recommend_tasks(request.dict())
    return TaskRecommendations(tasks=recommendations)


@app.post("/prioritize")
async def prioritize_tasks(request: TaskList) -> TaskList:
    """
    Reorder task list by risk priority.
    Called by KASA engine periodically.
    """
    prioritized = prioritizer.prioritize(request.tasks)
    return TaskList(tasks=prioritized)
```

---

### 5. Go Integration (KASA Engine Updates)

**Location**: `pkg/agi/engine.go`

Replace LLM fallback with SouHimBou AGI call:

```go
// Before (LLM-dependent):
if maxScore < 3 {
    if e.llm != nil {
        response, err := e.llm.Generate(message, systemPrompt)
        // ...
    }
}

// After (SouHimBou AGI):
if maxScore < 3 {
    // Use SouHimBou AGI for intent classification and response
    response, err := e.python.Chat(message, e.getCurrentContext())
    if err != nil {
        return "COMMANDO MODE ACTIVE. Processing your request with heuristics..."
    }

    // If SouHimBou recommends actions, queue them
    for _, action := range response.RecommendedActions {
        e.AddTask(action, "SouHimBou")
    }

    return fmt.Sprintf("[🧠 SOUHIMBOU AGI]\n%s", response.Message)
}
```

**New Python client method**:

```go
// pkg/apiserver/python_client.go

type ChatRequest struct {
    Message  string            `json:"message"`
    Context  map[string]string `json:"context,omitempty"`
    Features []float64         `json:"features,omitempty"`
}

type ChatResponse struct {
    Message            string   `json:"message"`
    Intent             string   `json:"intent"`
    Confidence         float64  `json:"confidence"`
    RecommendedActions []string `json:"recommended_actions"`
}

func (c *PythonServiceClient) Chat(message string, context map[string]string) (*ChatResponse, error) {
    payload := ChatRequest{
        Message: message,
        Context: context,
    }

    body, _ := json.Marshal(payload)
    resp, err := c.HTTPClient.Post(c.BaseURL+"/chat", "application/json", bytes.NewReader(body))
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result ChatResponse
    json.NewDecoder(resp.Body).Decode(&result)
    return &result, nil
}
```

---

## Capability Matrix: LLM vs SouHimBou AGI

| Capability | LLM (Before) | SouHimBou AGI (After) | Quality Delta |
|------------|--------------|----------------------|---------------|
| Intent classification | GPT-based | Rule + ML | Equivalent |
| Parameter extraction | NLP parsing | Regex + patterns | Equivalent |
| Response generation | Free-form text | Template-based | Slightly less dynamic |
| Task creation | LLM reasoning | ML + rules | Equivalent for security |
| Prioritization | LLM judgment | CVSS + anomaly scoring | Better for security |
| Context awareness | RAG + context window | Feature vectors + history | Different approach |
| Explanation quality | Natural language | Structured templates | More consistent |
| Hallucination risk | Present | Zero | Better |
| Resource usage | 3-10 GB VRAM | ~50 MB RAM | Dramatically better |

---

## What SouHimBou AGI Cannot Do (vs LLM)

These capabilities require an LLM and will be unavailable in Community Edition:

1. **Free-form creative responses** - Limited to templates
2. **Complex multi-turn reasoning** - No chain-of-thought
3. **Code generation** - No remediation script writing
4. **Natural language summarization** - Structured reports only
5. **Ambiguous query handling** - Falls back to "please clarify"

**These become features for Enterprise/Pharaoh tiers with optional LLM add-on.**

---

## Implementation Phases

### Phase 1: Intent & Response System (Week 1)

```
services/ml_anomaly/
├── intent.py          # IntentClassifier
├── responder.py       # SecurityResponder
└── templates/         # Response templates by intent
    ├── scan.py
    ├── firewall.py
    ├── compliance.py
    └── help.py
```

### Phase 2: Task Recommendation Engine (Week 2)

```
services/ml_anomaly/
├── task_recommender.py  # TaskRecommender
├── prioritizer.py       # TaskPrioritizer
└── rules/               # Rule definitions
    ├── anomaly_rules.py
    ├── compliance_rules.py
    └── vuln_rules.py
```

### Phase 3: API Integration (Week 2-3)

```
services/ml_anomaly/api.py
  + POST /chat
  + POST /recommend_tasks
  + POST /prioritize
```

### Phase 4: Go Client Updates (Week 3)

```
pkg/apiserver/python_client.go
  + Chat()
  + RecommendTasks()
  + PrioritizeTasks()
```

### Phase 5: KASA Engine Integration (Week 3-4)

```
pkg/agi/engine.go
  - Remove LLM fallback
  + Add SouHimBou AGI calls
  + Update task creation flow
```

---

## Validation Criteria

### Functional Tests

1. **Intent Classification**
   - "scan localhost" → SCAN intent, target=localhost
   - "block port 22" → FIREWALL intent, port=22
   - "help me understand compliance" → HELP intent
   - "what is the status" → STATUS intent

2. **Response Quality**
   - All responses actionable and accurate
   - No hallucinated capabilities
   - Clear next steps provided

3. **Task Recommendation**
   - High anomaly (>0.7) → Forensics task created
   - CVE found → Patch task with correct priority
   - Compliance gap → Remediation task linked to control

4. **Prioritization**
   - Critical findings sorted first
   - Age-based boost working
   - CVSS integrated correctly

### Performance Tests

| Metric | Target | Current LLM |
|--------|--------|-------------|
| Chat response latency | < 200 ms | 2-10 seconds |
| Memory usage | < 100 MB | 6-16 GB |
| Cold start time | < 2 seconds | 30-60 seconds |
| Throughput | > 100 req/sec | 1-2 req/sec |

---

## Summary

SouHimBou AGI transforms from a passive anomaly detector to an **active autonomous security agent**:

1. **Understands** user intent without LLM
2. **Responds** with accurate, actionable guidance
3. **Creates tasks** based on ML analysis
4. **Prioritizes** by risk, not just rules
5. **Executes** through existing KASA infrastructure

**The Community Edition ships complete, autonomous, and LLM-free.**

---

## References

- [BabyAGI Original Architecture](https://yoheinakajima.com/birth-of-babyagi/) - Yohei Nakajima
- [BabyAGI Archive](https://github.com/yoheinakajima/babyagi_archive) - Original task-based implementation
- [IBM: What is BabyAGI?](https://www.ibm.com/think/topics/babyagi) - Architecture explanation
