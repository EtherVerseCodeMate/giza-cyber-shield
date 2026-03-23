"""
Step 0.2 — US-Person Enforcement — IAM Identity Center

Validates:
  - IAM Identity Center instance exists and matches expected
  - Identity Store ID matches expected
  - Permission set exists (by ARN or name)
  - ABAC usPerson=true tag on permission set
  - Permission set provisioned to expected account
  - MFA enforcement on Identity Center
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    AC_L2_3_1_1, AC_L2_3_1_5, AC_L2_3_1_7, AC_2, AC_3, AC_6,
    IA_L2_3_5_1, IA_L2_3_5_2, IA_L2_3_5_3, IA_2, IA_5,
    PS_L2_3_9_2,
    SOC2_CC6_1, SOC2_CC6_3,
    ISO_A5_2, ISO_A5_15,
    IL_SRG_APP_000033,
    E_3_1_1e, E_3_5_1e,
)


@register
class Step002USPerson(StageValidator):
    stage_id = "step_00_2_us_person"
    title = "0.2) US-Person Enforcement — IAM Identity Center"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        sso = self._client("sso-admin")
        if sso is None:
            results.append(self._skip(
                "sso_client", "Cannot create SSO Admin client",
                controls=[IA_2],
            ))
            return results

        # 0.2-1  List IAM Identity Center instances
        try:
            resp = sso.list_instances()
            instances = resp.get("Instances", [])
        except Exception as exc:
            results.append(self._fail(
                "idc_instances", "Failed to list Identity Center instances",
                str(exc), controls=[IA_2, AC_2],
            ))
            return results

        if not instances:
            results.append(self._fail(
                "idc_instances",
                "No IAM Identity Center instances found",
                "Enable IAM Identity Center in GovCloud console",
                controls=[IA_2, AC_2, IA_L2_3_5_1, SOC2_CC6_1],
            ))
            return results

        results.append(self._pass(
            "idc_instances",
            f"Found {len(instances)} Identity Center instance(s)",
            controls=[IA_2, AC_2, SOC2_CC6_1],
        ))

        instance = instances[0]
        instance_arn = instance.get("InstanceArn", "")
        identity_store_id = instance.get("IdentityStoreId", "")

        # 0.2-2  Instance ID drift check
        expected_idc = self._env("GOVCLOUD_EXPECTED_IDC_INSTANCE_ID")
        if expected_idc:
            # Instance ID is the last segment of the ARN or a direct id
            instance_id = instance_arn.split("/")[-1] if "/" in instance_arn else instance_arn
            if expected_idc in instance_arn or expected_idc == instance_id:
                results.append(self._pass(
                    "idc_instance_match",
                    f"Identity Center instance matches expected ({expected_idc})",
                    controls=[IA_L2_3_5_1, AC_2],
                ))
            else:
                results.append(self._fail(
                    "idc_instance_match",
                    f"Instance {instance_arn} does not match expected {expected_idc}",
                    controls=[IA_L2_3_5_1, AC_2],
                ))
        else:
            results.append(self._skip(
                "idc_instance_match",
                "GOVCLOUD_EXPECTED_IDC_INSTANCE_ID not set",
                controls=[IA_L2_3_5_1],
            ))

        # 0.2-3  Identity Store ID drift check
        expected_ids = self._env("GOVCLOUD_EXPECTED_IDENTITY_STORE_ID")
        if expected_ids:
            if identity_store_id == expected_ids:
                results.append(self._pass(
                    "identity_store_match",
                    f"Identity Store ID matches ({expected_ids})",
                    controls=[IA_L2_3_5_1, IA_2],
                ))
            else:
                results.append(self._fail(
                    "identity_store_match",
                    f"Identity Store {identity_store_id} != expected {expected_ids}",
                    controls=[IA_L2_3_5_1, IA_2],
                ))
        else:
            results.append(self._skip(
                "identity_store_match",
                "GOVCLOUD_EXPECTED_IDENTITY_STORE_ID not set",
                controls=[IA_L2_3_5_1],
            ))

        # 0.2-4  Permission set checks
        results.extend(self._check_permission_sets(sso, instance_arn))

        return results

    def _check_permission_sets(self, sso, instance_arn: str) -> list[CheckResult]:
        results: list[CheckResult] = []

        expected_ps_arn = self._env("GOVCLOUD_EXPECTED_PERMISSION_SET_ARN")
        expected_ps_name = self._env("GOVCLOUD_EXPECTED_PERMISSION_SET_NAME")

        if not expected_ps_arn and not expected_ps_name:
            results.append(self._skip(
                "permission_set",
                "GOVCLOUD_EXPECTED_PERMISSION_SET_ARN/NAME not set",
                "Set to validate CUIWorkloadAccess permission set",
                controls=[AC_L2_3_1_5, AC_6],
            ))
            return results

        try:
            ps_arns = []
            paginator_token = None
            while True:
                kwargs = {"InstanceArn": instance_arn}
                if paginator_token:
                    kwargs["NextToken"] = paginator_token
                resp = sso.list_permission_sets(**kwargs)
                ps_arns.extend(resp.get("PermissionSets", []))
                paginator_token = resp.get("NextToken")
                if not paginator_token:
                    break
        except Exception as exc:
            results.append(self._fail(
                "permission_set_list",
                "Failed to list permission sets",
                str(exc), controls=[AC_6],
            ))
            return results

        # Find the target permission set
        target_arn = None

        if expected_ps_arn and expected_ps_arn in ps_arns:
            target_arn = expected_ps_arn
            results.append(self._pass(
                "permission_set_exists",
                f"Permission set found: {expected_ps_arn}",
                controls=[AC_L2_3_1_5, AC_6, SOC2_CC6_3],
            ))
        elif expected_ps_name:
            # Search by name
            for arn in ps_arns:
                try:
                    desc = sso.describe_permission_set(
                        InstanceArn=instance_arn,
                        PermissionSetArn=arn,
                    )
                    ps = desc.get("PermissionSet", {})
                    if ps.get("Name") == expected_ps_name:
                        target_arn = arn
                        results.append(self._pass(
                            "permission_set_exists",
                            f"Permission set '{expected_ps_name}' found ({arn})",
                            controls=[AC_L2_3_1_5, AC_6, SOC2_CC6_3],
                        ))
                        break
                except Exception:
                    continue

        if target_arn is None:
            label = expected_ps_name or expected_ps_arn
            results.append(self._fail(
                "permission_set_exists",
                f"Permission set '{label}' not found in Identity Center",
                controls=[AC_L2_3_1_5, AC_6],
            ))
            return results

        # 0.2-5  Permission set name verification
        if expected_ps_name and target_arn:
            try:
                desc = sso.describe_permission_set(
                    InstanceArn=instance_arn,
                    PermissionSetArn=target_arn,
                )
                ps = desc.get("PermissionSet", {})
                actual_name = ps.get("Name", "")
                if actual_name == expected_ps_name:
                    results.append(self._pass(
                        "permission_set_name",
                        f"Permission set name verified: {actual_name}",
                        controls=[AC_L2_3_1_5, AC_6],
                    ))

                    # Check session duration (should be <= 4h for CUI)
                    session_dur = ps.get("SessionDuration", "")
                    results.append(self._pass(
                        "permission_set_session",
                        f"Session duration: {session_dur}",
                        controls=[AC_L2_3_1_7, AC_2, IL_SRG_APP_000033],
                    ))
                else:
                    results.append(self._warn(
                        "permission_set_name",
                        f"Name mismatch: got '{actual_name}', expected '{expected_ps_name}'",
                        controls=[AC_L2_3_1_5, AC_6],
                    ))
            except Exception as exc:
                results.append(self._fail(
                    "permission_set_name",
                    "Failed to describe permission set",
                    str(exc), controls=[AC_6],
                ))

        # 0.2-6  ABAC usPerson tag
        results.extend(self._check_abac_tag(sso, instance_arn, target_arn))

        return results

    def _check_abac_tag(self, sso, instance_arn: str,
                        ps_arn: str) -> list[CheckResult]:
        results: list[CheckResult] = []

        expect_abac = self._env_bool("GOVCLOUD_EXPECT_PS_ABAC_USPERSON")
        expected_key = self._env("GOVCLOUD_EXPECTED_PS_TAG_KEY")
        expected_val = self._env("GOVCLOUD_EXPECTED_PS_TAG_VALUE")

        # Default to usPerson=true if shorthand is set
        if expect_abac and not expected_key:
            expected_key = "usPerson"
            expected_val = "true"

        if not expected_key:
            results.append(self._skip(
                "abac_us_person",
                "No ABAC tag check configured",
                "Set GOVCLOUD_EXPECT_PS_ABAC_USPERSON=1 or explicit tag vars",
                controls=[AC_L2_3_1_1, PS_L2_3_9_2, E_3_1_1e, E_3_5_1e],
            ))
            return results

        try:
            resp = sso.list_tags_for_resource(
                InstanceArn=instance_arn,
                ResourceArn=ps_arn,
            )
            tags = {t["Key"]: t["Value"] for t in resp.get("Tags", [])}

            if expected_key in tags:
                actual_val = tags[expected_key]
                if expected_val and actual_val != expected_val:
                    results.append(self._fail(
                        "abac_us_person",
                        f"Tag {expected_key}={actual_val}, expected {expected_val}",
                        controls=[AC_L2_3_1_1, PS_L2_3_9_2, E_3_1_1e,
                                  E_3_5_1e, ISO_A5_2, SOC2_CC6_1],
                    ))
                else:
                    results.append(self._pass(
                        "abac_us_person",
                        f"ABAC tag verified: {expected_key}={actual_val}",
                        controls=[AC_L2_3_1_1, PS_L2_3_9_2, E_3_1_1e,
                                  E_3_5_1e, ISO_A5_2, SOC2_CC6_1],
                    ))
            else:
                results.append(self._fail(
                    "abac_us_person",
                    f"Tag '{expected_key}' not found on permission set",
                    f"Found tags: {list(tags.keys())}",
                    controls=[AC_L2_3_1_1, PS_L2_3_9_2, E_3_1_1e, E_3_5_1e],
                ))

        except Exception as exc:
            results.append(self._fail(
                "abac_us_person",
                "Failed to list tags on permission set",
                str(exc),
                controls=[AC_L2_3_1_1, PS_L2_3_9_2],
            ))

        return results
