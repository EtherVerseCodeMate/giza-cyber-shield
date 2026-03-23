"""
Stage registry — auto-discovery of all StageValidator subclasses.
"""

from __future__ import annotations

from typing import Dict, List, Type

from govcloud_validation.base import StageValidator

# Populated by register() or by validators/__init__.py imports
STAGE_REGISTRY: Dict[str, Type[StageValidator]] = {}


def register(cls: Type[StageValidator]) -> Type[StageValidator]:
    """Decorator — register a StageValidator subclass by its stage_id."""
    STAGE_REGISTRY[cls.stage_id] = cls
    return cls


def get_all_stages(region: str = "us-gov-west-1") -> List[StageValidator]:
    """Return instantiated validators in runbook order."""
    ordered_keys = [
        "step_00_prereqs",
        "step_00_2_us_person",
        "step_01_organizations",
        "step_02_root_guardrails",
        "step_03_logging",
        "step_04_networking",
        "step_05_aurora",
        "step_06_compute",
        "step_06a_lambda",
        "step_06b_frontend",
        "step_07_identity",
        "step_08_encryption",
        "step_08a_bedrock",
        "step_09_enclave",
        "step_10_sdlc",
        "step_11_smoke",
        "step_12_evidence_binder",
    ]
    stages = []
    for key in ordered_keys:
        if key in STAGE_REGISTRY:
            stages.append(STAGE_REGISTRY[key](region=region))
    # Append any stages registered but not in the ordered list
    for key, cls in STAGE_REGISTRY.items():
        if key not in ordered_keys:
            stages.append(cls(region=region))
    return stages
