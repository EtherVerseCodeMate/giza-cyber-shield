"""
Auto-import all validator modules so they register with the stage registry.
"""

from govcloud_validation.validators import (  # noqa: F401
    step_00_prereqs,
    step_00_2_us_person,
    step_01_organizations,
    step_02_root_guardrails,
    step_03_logging,
    step_04_networking,
    step_05_aurora,
    step_06_compute,
    step_06a_lambda,
    step_06b_frontend,
    step_07_identity,
    step_08_encryption,
    step_08a_bedrock,
    step_09_enclave,
    step_10_sdlc,
    step_11_smoke,
    step_12_evidence_binder,
)
