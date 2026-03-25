"""
Step 2 — Root Hygiene & SCPs (Runbook v2.1)

Validates:
  - SCPs enabled on the organization
  - Custom SCPs attached at the organization root (not just FullAWSAccess)
  - Expected SCP names present at root (optional drift check)
  - Root account MFA / access key hygiene (IAM credential report)
  - Deny-region guardrails recommended
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    AC_L2_3_1_1, AC_L2_3_1_5, AC_L2_3_1_7, AC_2, AC_3, AC_6,
    CM_L2_3_4_1, CM_L2_3_4_2, CM_2, CM_6,
    SC_L2_3_13_1, SC_7,
    SOC2_CC6_1, SOC2_CC6_6, SOC2_CC8_1,
    ISO_A5_15, ISO_A8_9,
    IL_SRG_APP_000231,
    E_3_1_1e, E_3_4_1e,
)


@register
class Step02RootGuardrails(StageValidator):
    stage_id = "step_02_root_guardrails"
    title = "2) Root Hygiene & SCPs"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        org_client = self._client("organizations")
        if org_client is None:
            results.append(self._skip("org_client", "Cannot create Organizations client"))
            return results

        # 2-1  Get org root
        try:
            roots = org_client.list_roots().get("Roots", [])
        except Exception as exc:
            results.append(self._fail("org_root", "Cannot list roots", str(exc)))
            return results

        if not roots:
            results.append(self._fail("org_root", "No organization root found"))
            return results

        root_id = roots[0]["Id"]
        policy_types = roots[0].get("PolicyTypes", [])

        # 2-2  SCP policy type enabled
        scp_enabled = any(
            pt.get("Type") == "SERVICE_CONTROL_POLICY" and
            pt.get("Status") == "ENABLED"
            for pt in policy_types
        )
        if scp_enabled:
            results.append(self._pass(
                "scp_enabled",
                "Service Control Policies are ENABLED on the organization",
                controls=[AC_L2_3_1_5, AC_6, CM_L2_3_4_2, CM_6,
                          SC_L2_3_13_1, SC_7, SOC2_CC6_6, ISO_A5_15,
                          IL_SRG_APP_000231, E_3_1_1e, E_3_4_1e],
            ))
        else:
            results.append(self._fail(
                "scp_enabled",
                "SCPs are NOT enabled — enable under Organizations → Policies",
                controls=[AC_L2_3_1_5, AC_6, CM_L2_3_4_2, CM_6,
                          SC_L2_3_13_1, SC_7],
            ))
            return results

        # 2-3  List SCPs attached at root
        try:
            resp = org_client.list_policies_for_target(
                TargetId=root_id,
                Filter="SERVICE_CONTROL_POLICY",
            )
            policies = resp.get("Policies", [])
        except Exception as exc:
            results.append(self._fail(
                "root_scps", "Failed to list SCPs at root", str(exc)))
            return results

        aws_managed = [p for p in policies if p.get("AwsManaged", False)]
        custom = [p for p in policies if not p.get("AwsManaged", False)]

        results.append(self._pass(
            "root_scp_count",
            f"SCPs at root: {len(policies)} total "
            f"({len(aws_managed)} AWS-managed, {len(custom)} custom)",
            controls=[AC_L2_3_1_5, CM_L2_3_4_2],
        ))

        # 2-4  Must have at least one custom SCP
        if custom:
            names = [p.get("Name", p.get("Id")) for p in custom]
            results.append(self._pass(
                "custom_scp_present",
                f"Custom SCP(s) attached at root: {', '.join(names)}",
                controls=[AC_L2_3_1_5, AC_6, CM_L2_3_4_2, CM_6,
                          SC_L2_3_13_1, SC_7, SOC2_CC6_6, SOC2_CC8_1,
                          ISO_A5_15, ISO_A8_9, IL_SRG_APP_000231,
                          E_3_1_1e, E_3_4_1e],
            ))
        else:
            results.append(self._warn(
                "custom_scp_present",
                "Only AWS-managed SCPs at root — attach your custom guardrail SCPs",
                "Recommended: DenyCUIWithoutUSPersonTag, DenyNonGovRegions, "
                "ProtectGuardrails, DenyRootActions",
                controls=[AC_L2_3_1_5, AC_6, CM_L2_3_4_2, CM_6,
                          SC_L2_3_13_1, SC_7, SOC2_CC6_6],
            ))

        # 2-5  Expected SCP names (optional drift check)
        expected_names = self._env_list("GOVCLOUD_EXPECTED_SCP_NAMES")
        if expected_names:
            actual_names = {p.get("Name", "") for p in policies}
            missing = [n for n in expected_names if n not in actual_names]
            if missing:
                results.append(self._fail(
                    "expected_scps",
                    f"Missing expected SCPs at root: {', '.join(missing)}",
                    f"Found: {', '.join(actual_names)}",
                    controls=[CM_L2_3_4_1, CM_2, AC_L2_3_1_5],
                ))
            else:
                results.append(self._pass(
                    "expected_scps",
                    f"All expected SCPs present at root: {', '.join(expected_names)}",
                    controls=[CM_L2_3_4_1, CM_2, AC_L2_3_1_5],
                ))
        else:
            results.append(self._skip(
                "expected_scps",
                "GOVCLOUD_EXPECTED_SCP_NAMES not set",
                "Set to validate specific SCPs are attached at root",
                controls=[CM_L2_3_4_1],
            ))

        # 2-6  Recommended SCP patterns
        results.extend(self._check_recommended_scps(custom))

        # 2-7  Root account hygiene
        results.extend(self._check_root_hygiene())

        return results

    def _check_recommended_scps(self, custom_policies: list) -> list[CheckResult]:
        results: list[CheckResult] = []
        names_lower = {p.get("Name", "").lower() for p in custom_policies}

        recommended = {
            "region-deny": "Deny non-GovCloud regions (NIST 800-172 boundary)",
            "root-deny": "Deny root user actions (least privilege)",
            "guardrail-protect": "Protect logging/security guardrails from deletion",
            "us-person": "Deny CUI access without usPerson ABAC tag",
        }

        for pattern, desc in recommended.items():
            found = any(pattern in name for name in names_lower)
            if found:
                results.append(self._pass(
                    f"recommended_scp_{pattern.replace('-', '_')}",
                    f"Recommended SCP pattern '{pattern}' found",
                    controls=[AC_L2_3_1_5, SC_L2_3_13_1, E_3_1_1e],
                ))
            else:
                results.append(self._warn(
                    f"recommended_scp_{pattern.replace('-', '_')}",
                    f"Recommended: {desc}",
                    f"No SCP matching '{pattern}' pattern found at root",
                    controls=[AC_L2_3_1_5, SC_L2_3_13_1, E_3_1_1e],
                ))

        return results

    def _check_root_hygiene(self) -> list[CheckResult]:
        """Check IAM root account hygiene (credential report)."""
        results: list[CheckResult] = []

        iam = self._client("iam")
        if iam is None:
            results.append(self._skip(
                "root_hygiene", "Cannot create IAM client"))
            return results

        # Check for root access keys
        try:
            iam.generate_credential_report()
            import time
            time.sleep(2)  # credential report generation is async
            resp = iam.get_credential_report()
            import csv
            import io
            report = resp["Content"].decode("utf-8")
            reader = csv.DictReader(io.StringIO(report))
            for row in reader:
                if row.get("user") == "<root_account>":
                    # Root access keys should not exist
                    ak1 = row.get("access_key_1_active", "false")
                    ak2 = row.get("access_key_2_active", "false")
                    mfa = row.get("mfa_active", "false")

                    if ak1 == "true" or ak2 == "true":
                        results.append(self._fail(
                            "root_no_access_keys",
                            "Root account has active access keys — remove them",
                            controls=[AC_L2_3_1_7, AC_6, SOC2_CC6_1,
                                      ISO_A5_15],
                        ))
                    else:
                        results.append(self._pass(
                            "root_no_access_keys",
                            "Root account has no active access keys",
                            controls=[AC_L2_3_1_7, AC_6, SOC2_CC6_1],
                        ))

                    if mfa == "true":
                        results.append(self._pass(
                            "root_mfa",
                            "Root account MFA is enabled",
                            controls=[IA_L2_3_5_3, AC_L2_3_1_7,
                                      SOC2_CC6_1, ISO_A5_15],
                        ))
                    else:
                        results.append(self._fail(
                            "root_mfa",
                            "Root account MFA is NOT enabled — enable immediately",
                            controls=[IA_L2_3_5_3, AC_L2_3_1_7,
                                      SOC2_CC6_1, ISO_A5_15],
                        ))
                    break
        except Exception as exc:
            results.append(self._warn(
                "root_hygiene",
                "Could not generate/read credential report",
                str(exc),
                controls=[AC_L2_3_1_7],
            ))

        return results
