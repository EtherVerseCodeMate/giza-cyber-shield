"""
Step 0 — Pre-Reqs & Account Pairing (Runbook v2.1)

Validates:
  - boto3 available and importable
  - AWS credentials configured (STS GetCallerIdentity)
  - Region is a GovCloud region (us-gov-west-1 / us-gov-east-1)
  - Account ID matches expected (drift check)
  - FIPS endpoints reachable
  - Commercial ↔ GovCloud account pairing awareness
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    AC_L2_3_1_1, AC_2, IA_L2_3_5_1, IA_2,
    SOC2_CC6_1, ISO_A5_15,
    IL_SRG_APP_000033,
    SC_L2_3_13_8, SC_8,
)


@register
class Step00Prereqs(StageValidator):
    stage_id = "step_00_prereqs"
    title = "0) Pre-Reqs — Account Pairing (Runbook v2.1)"
    description = "Verify AWS credentials, GovCloud region, and account identity."

    GOVCLOUD_REGIONS = {"us-gov-west-1", "us-gov-east-1"}

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        # 0-1  boto3 available
        b3 = self._import_boto3()
        if b3 is None:
            results.append(self._fail(
                "boto3_installed",
                "boto3 is not installed",
                "Run: pip install boto3",
                [IA_2],
            ))
            return results
        results.append(self._pass("boto3_installed", "boto3 is available"))

        # 0-2  Region is GovCloud
        if self.region in self.GOVCLOUD_REGIONS:
            results.append(self._pass(
                "govcloud_region",
                f"Region {self.region} is a valid GovCloud region",
                controls=[SC_L2_3_13_8, IL_SRG_APP_000033],
            ))
        else:
            results.append(self._fail(
                "govcloud_region",
                f"Region {self.region} is NOT a GovCloud region",
                "GovCloud regions: us-gov-west-1, us-gov-east-1",
                controls=[SC_L2_3_13_8, IL_SRG_APP_000033],
            ))

        # 0-3  STS GetCallerIdentity
        sts = self._client("sts")
        if sts is None:
            results.append(self._skip(
                "sts_identity", "Cannot create STS client",
                controls=[IA_L2_3_5_1, IA_2, AC_2],
            ))
            return results

        try:
            identity = sts.get_caller_identity()
            account_id = identity["Account"]
            arn = identity["Arn"]
            results.append(self._pass(
                "sts_identity",
                f"Authenticated as {arn} (account {account_id})",
                controls=[IA_L2_3_5_1, IA_2, AC_L2_3_1_1, SOC2_CC6_1, ISO_A5_15],
            ))

            # 0-4  Account ID drift check
            expected = self._env("GOVCLOUD_EXPECTED_ACCOUNT_ID")
            if expected:
                if account_id == expected:
                    results.append(self._pass(
                        "account_id_match",
                        f"Account ID matches expected ({expected})",
                        controls=[AC_2, SOC2_CC6_1],
                    ))
                else:
                    results.append(self._fail(
                        "account_id_match",
                        f"Account ID {account_id} != expected {expected}",
                        "Set GOVCLOUD_EXPECTED_ACCOUNT_ID or verify credentials",
                        controls=[AC_2, SOC2_CC6_1],
                    ))
            else:
                results.append(self._skip(
                    "account_id_match",
                    "GOVCLOUD_EXPECTED_ACCOUNT_ID not set — skipping drift check",
                    "Export GOVCLOUD_EXPECTED_ACCOUNT_ID=<your-account-id>",
                    controls=[AC_2],
                ))

            # 0-5  GovCloud ARN partition check
            if ":aws-us-gov:" in arn:
                results.append(self._pass(
                    "govcloud_partition",
                    "ARN confirms aws-us-gov partition",
                    controls=[SC_L2_3_13_8, SC_8, IL_SRG_APP_000033],
                ))
            else:
                results.append(self._fail(
                    "govcloud_partition",
                    f"ARN partition is not aws-us-gov: {arn}",
                    "Ensure you are using GovCloud credentials, not commercial",
                    controls=[SC_L2_3_13_8, SC_8, IL_SRG_APP_000033],
                ))

        except Exception as exc:
            results.append(self._fail(
                "sts_identity",
                "STS GetCallerIdentity failed",
                str(exc),
                controls=[IA_L2_3_5_1, IA_2],
            ))

        # 0-6  FIPS endpoint connectivity check
        results.extend(self._check_fips_endpoint())

        return results

    def _check_fips_endpoint(self) -> list[CheckResult]:
        """Verify that the FIPS STS endpoint responds."""
        try:
            import urllib.request
            url = f"https://sts.{self.region}.amazonaws.com/"
            req = urllib.request.Request(url, method="GET")
            # We just need connectivity — a 403 is fine (proves endpoint is up)
            try:
                urllib.request.urlopen(req, timeout=10)
            except Exception as e:
                if "403" in str(e) or "400" in str(e):
                    return [self._pass(
                        "fips_endpoint_reachable",
                        f"FIPS STS endpoint reachable ({self.region})",
                        controls=[SC_L2_3_13_11, SC_13, IL_SRG_APP_000023],
                    )]
                raise
            return [self._pass(
                "fips_endpoint_reachable",
                f"FIPS STS endpoint reachable ({self.region})",
                controls=[SC_L2_3_13_11, SC_13, IL_SRG_APP_000023],
            )]
        except Exception as exc:
            return [self._warn(
                "fips_endpoint_reachable",
                "Could not reach FIPS STS endpoint",
                str(exc),
                controls=[SC_L2_3_13_11, SC_13, IL_SRG_APP_000023],
            )]
