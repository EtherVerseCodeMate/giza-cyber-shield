"""
GovCloud / sovereign-cloud deployment validation (Runbook v2.1–aligned stages).

Usage (from repo root):
    python -m govcloud_validation --help

Requires boto3 for AWS GovCloud checks: pip install boto3
"""

from govcloud_validation.base import (
    CheckResult,
    CheckStatus,
    GovCloudValidator,
    StageResult,
    ValidationContext,
    ValidationReport,
)

# Register providers
import govcloud_validation.validators  # noqa: F401, E402

__all__ = [
    "CheckResult",
    "CheckStatus",
    "GovCloudValidator",
    "StageResult",
    "ValidationContext",
    "ValidationReport",
]
