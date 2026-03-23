"""
Core framework: CheckStatus, CheckResult, StageValidator.

Every check is tagged with zero or more compliance control ids so the
final report can be filtered by framework.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Check result model
# ---------------------------------------------------------------------------

class CheckStatus(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    WARN = "WARN"
    SKIP = "SKIP"


@dataclass
class CheckResult:
    check_id: str
    status: CheckStatus
    message: str
    detail: str = ""
    controls: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "check_id": self.check_id,
            "status": self.status.value,
            "message": self.message,
            "detail": self.detail,
            "controls": self.controls,
        }


# ---------------------------------------------------------------------------
# Base stage validator
# ---------------------------------------------------------------------------

class StageValidator:
    """
    Subclass for each runbook step.  Override ``checks()`` to yield
    ``CheckResult`` objects.  The runner calls ``run()`` which wraps
    ``checks()`` with boto3 availability gating and error handling.
    """

    stage_id: str = ""
    title: str = ""
    description: str = ""

    # Set to True if the stage requires boto3 (almost all do)
    requires_boto3: bool = True

    def __init__(self, region: str = "us-gov-west-1"):
        self.region = region
        self._boto3 = None
        self._clients: Dict[str, Any] = {}

    # -- helpers ------------------------------------------------------------

    def _env(self, name: str, default: str = "") -> str:
        return os.environ.get(name, default).strip()

    def _env_bool(self, name: str) -> bool:
        return self._env(name).lower() in ("1", "true", "yes")

    def _env_list(self, name: str) -> List[str]:
        raw = self._env(name)
        if not raw:
            return []
        return [s.strip() for s in raw.split(",") if s.strip()]

    def _import_boto3(self):
        if self._boto3 is not None:
            return self._boto3
        try:
            import boto3 as _b3  # noqa: F811
            self._boto3 = _b3
            return _b3
        except ImportError:
            return None

    def _client(self, service: str, region: Optional[str] = None):
        """Return a cached boto3 client for *service*."""
        b3 = self._import_boto3()
        if b3 is None:
            return None
        key = f"{service}:{region or self.region}"
        if key not in self._clients:
            kwargs: Dict[str, Any] = {}
            r = region or self.region
            if r:
                kwargs["region_name"] = r
            # Prefer FIPS endpoints when available in GovCloud
            fips_env = self._env("AWS_USE_FIPS_ENDPOINT", "true")
            if fips_env.lower() in ("1", "true", "yes"):
                kwargs["endpoint_url"] = self._fips_endpoint(service, r)
            try:
                self._clients[key] = b3.client(service, **kwargs)
            except Exception:
                # Fall back without explicit endpoint
                kwargs.pop("endpoint_url", None)
                self._clients[key] = b3.client(service, **kwargs)
        return self._clients[key]

    @staticmethod
    def _fips_endpoint(service: str, region: str) -> Optional[str]:
        """Return the FIPS endpoint URL for a service, or None."""
        fips_map = {
            "sts": f"https://sts.{region}.amazonaws.com",
            "organizations": "https://organizations-fips.us-gov-west-1.amazonaws.com",
            "iam": "https://iam-fips.us-gov.amazonaws.com",
            "sso-admin": f"https://sso-fips.{region}.amazonaws.com",
            "identitystore": f"https://identitystore-fips.{region}.amazonaws.com",
            "s3": f"https://s3-fips.{region}.amazonaws.com",
            "kms": f"https://kms-fips.{region}.amazonaws.com",
            "secretsmanager": f"https://secretsmanager-fips.{region}.amazonaws.com",
            "logs": f"https://logs-fips.{region}.amazonaws.com",
            "ec2": f"https://ec2-fips.{region}.amazonaws.com",
            "ecs": f"https://ecs-fips.{region}.amazonaws.com",
            "ecr": f"https://ecr-fips.{region}.amazonaws.com",
            "elasticloadbalancingv2": f"https://elasticloadbalancing-fips.{region}.amazonaws.com",
            "rds": f"https://rds-fips.{region}.amazonaws.com",
            "cloudtrail": f"https://cloudtrail-fips.{region}.amazonaws.com",
            "config": f"https://config-fips.{region}.amazonaws.com",
            "guardduty": f"https://guardduty-fips.{region}.amazonaws.com",
            "securityhub": f"https://securityhub-fips.{region}.amazonaws.com",
            "cognito-idp": f"https://cognito-idp-fips.{region}.amazonaws.com",
            "wafv2": f"https://wafv2-fips.{region}.amazonaws.com",
            "codepipeline": f"https://codepipeline-fips.{region}.amazonaws.com",
            "codebuild": f"https://codebuild-fips.{region}.amazonaws.com",
            "lambda": f"https://lambda-fips.{region}.amazonaws.com",
        }
        return fips_map.get(service)

    # -- result helpers -----------------------------------------------------

    def _pass(self, check_id: str, msg: str, detail: str = "",
              controls: Optional[List[str]] = None) -> CheckResult:
        return CheckResult(check_id, CheckStatus.PASS, msg, detail,
                           controls or [])

    def _fail(self, check_id: str, msg: str, detail: str = "",
              controls: Optional[List[str]] = None) -> CheckResult:
        return CheckResult(check_id, CheckStatus.FAIL, msg, detail,
                           controls or [])

    def _warn(self, check_id: str, msg: str, detail: str = "",
              controls: Optional[List[str]] = None) -> CheckResult:
        return CheckResult(check_id, CheckStatus.WARN, msg, detail,
                           controls or [])

    def _skip(self, check_id: str, msg: str, detail: str = "",
              controls: Optional[List[str]] = None) -> CheckResult:
        return CheckResult(check_id, CheckStatus.SKIP, msg, detail,
                           controls or [])

    # -- main entry ---------------------------------------------------------

    def checks(self) -> List[CheckResult]:
        """Override in subclass. Yield individual check results."""
        raise NotImplementedError

    def run(self) -> List[CheckResult]:
        """Run all checks with boto3 gating and error handling."""
        if self.requires_boto3 and self._import_boto3() is None:
            return [self._skip(
                "boto3",
                "boto3 not available",
                "Install boto3: pip install boto3",
                ["prereq"],
            )]
        try:
            return self.checks()
        except Exception as exc:
            return [self._fail(
                "unhandled_error",
                f"Stage {self.stage_id} raised an unhandled error",
                str(exc),
            )]
