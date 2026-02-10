"""
SouHimBou AGI - Sunsum & MmereDane Engine
"The Balance that Preserves the Flow"

Responsibility:
    - Implement Poetically Obfuscated Cyber-Physical logic (Ref: FIG 3)
    - Balance 'Merit' (Security) against 'Burden' (Impact)
    - Formerly the Resilience Engine
"""
import logging
from typing import Dict, List, Tuple, Optional
from enum import Enum
from pydantic import BaseModel

class VoidDisturbance(Enum):
    INTENT = "INTENT"    # Formerly SETTINGS (Operator Setpoints)
    COMMAND = "COMMAND"  # Formerly CONTROL (PLC Logic)
    PERCEPTION = "PERCEPTION" # Formerly SENSING (Sensor Data)

class AkofenaOption(BaseModel):
    id: str
    name: str
    merit: float   # Formerly security_benefit (0.0 to 1.0)
    burden: float  # Formerly stability_impact (0.0 to 1.0)
    realm: str    # "SPIRIT" (Cyber) or "Vessel" (Physical)

class MmereDaneResult(BaseModel):
    chosen_path: str
    wisdom_log: str
    sunsum_score: float
    merit_delta: float

class SunsumEngine:
    def __init__(self):
        self.logger = logging.getLogger("souhimbou.sunsum")

    def perform_harmonization(
        self, 
        void_type: VoidDisturbance, 
        corruption_score: float,
        options: List[AkofenaOption]
    ) -> MmereDaneResult:
        """
        Formerly perform_tradeoff_analysis. 
        Selects the path of highest merit with lowest burden.
        """
        best_path = None
        max_delta = -1.0

        for opt in options:
            delta = opt.merit - opt.burden
            
            # FIG 3 Logic: If perception is clouded, prefer physical (Vessel) corrections
            if void_type == VoidDisturbance.PERCEPTION and opt.realm == "Vessel":
                delta += 0.2 
            
            if delta > max_delta:
                max_delta = delta
                best_path = opt

        if not best_path:
            return MmereDaneResult(
                chosen_path="STILLNESS",
                wisdom_log="No path within sacred bounds was found.",
                sunsum_score=0.0,
                merit_delta=0.0
            )

        sunsum_score = (1.0 - best_path.burden) * 100
        
        wisdom_log = (
            f"Akofena path selected for {void_type.value} disturbance. "
            f"Path '{best_path.name}' maintains Sunsum merit ({best_path.merit:.2f}) "
            f"within sustainable burden limits ({best_path.burden:.2f})."
        )

        return MmereDaneResult(
            chosen_path=best_path.name,
            wisdom_log=wisdom_log,
            sunsum_score=sunsum_score,
            merit_delta=max_delta
        )

    def calculate_dynamism(self, reaction_time_ms: int, baseline_ms: int) -> float:
        """Formerly calculate_system_agility (FIG 1 Metric S)."""
        if reaction_time_ms <= 0: return 1.0
        agility = baseline_ms / reaction_time_ms
        return min(agility, 1.0)
