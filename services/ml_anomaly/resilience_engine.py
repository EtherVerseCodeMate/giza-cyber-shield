"""
SouHimBou AGI - Resilience & Trade-off Engine
"The Balance that Preserves the Flow"

Responsibility:
    - Implement Cyber-Physical Trade-off analysis (Ref: FIG 3, WO2023064898A1)
    - Balance "Security Benefit" against "Operational Stability Impact"
    - Categorize attacks into Settings, Control, or Sensing disturbances
"""
import logging
from typing import Dict, List, Tuple, Optional
from enum import Enum
from pydantic import BaseModel

class DisturbanceType(Enum):
    SETTINGS = "SETTINGS"  # Attacker action against Operator Setpoints
    CONTROL = "CONTROL"    # Attacker action against Control Logic/PLC
    SENSING = "SENSING"    # Attacker action against Sensor data (Injection)

class MitigationOption(BaseModel):
    id: str
    name: str
    security_benefit: float  # 0.0 to 1.0
    stability_impact: float  # 0.0 to 1.0 (higher = more disruption)
    type: str  # "CYBER" or "PHYSICAL"

class TradeoffResult(BaseModel):
    recommended_mitigation: str
    reasoning: str
    resilience_score: float
    tradeoff_delta: float

class ResilienceEngine:
    def __init__(self):
        self.logger = logging.getLogger("souhimbou.resilience")

    def perform_tradeoff_analysis(
        self, 
        disturbance: DisturbanceType, 
        vulnerability_score: float,
        options: List[MitigationOption]
    ) -> TradeoffResult:
        """
        Selects the most 'Surgical' response by maximizing (Benefit - Impact).
        If Impact is too high, it favors physical corrections over cyber blocks.
        """
        best_option = None
        max_delta = -1.0

        for opt in options:
            # The Resilience Logic: High benefit is good, but high impact is bad.
            # We prioritize 'Surgical' responses that maintain 'Minimum Normalcy'.
            delta = opt.security_benefit - opt.stability_impact
            
            # FIG 3 Logic: If it's a SENSING attack, we prefer PHYSICAL mitigations (setpoint offset)
            if disturbance == DisturbanceType.SENSING and opt.type == "PHYSICAL":
                delta += 0.2  # Bonus for physical correction in sensing attacks
            
            if delta > max_delta:
                max_delta = delta
                best_option = opt

        if not best_option:
            return TradeoffResult(
                recommended_mitigation="MANUAL_INTERVENTION",
                reasoning="No safe autonomous mitigation found within stability bounds.",
                resilience_score=0.0,
                tradeoff_delta=0.0
            )

        resilience_score = (1.0 - best_option.stability_impact) * 100
        
        reasoning = (
            f"Surgical response selected for {disturbance.value} attack. "
            f"Mitigation '{best_option.name}' provides high security ({best_option.security_benefit:.2f}) "
            f"with acceptable stability impact ({best_option.stability_impact:.2f})."
        )

        return TradeoffResult(
            recommended_mitigation=best_option.name,
            reasoning=reasoning,
            resilience_score=resilience_score,
            tradeoff_delta=max_delta
        )

    def calculate_system_agility(self, reaction_time_ms: int, baseline_ms: int) -> float:
        """FIG 1 Metric: Measure System Agility (S) based on latency (t)."""
        if reaction_time_ms <= 0: return 1.0
        # Ratio of actual vs baseline response speed
        agility = baseline_ms / reaction_time_ms
        return min(agility, 1.0)
