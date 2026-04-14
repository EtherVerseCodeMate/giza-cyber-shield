"""Concrete validators per cloud / deployment target."""

from govcloud_validation.validators.aws_govcloud import AWSGovCloudValidator
from govcloud_validation.validators.azure_gov import AzureGovValidator
from govcloud_validation.validators.hpe_greenlake import HPEGreenLakeValidator

# Import step validators so their @register decorators populate the stage
# registry before AWSGovCloudValidator.validate_stage() is first called.
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

__all__ = [
    "AWSGovCloudValidator",
    "AzureGovValidator",
    "HPEGreenLakeValidator",
]
