"""
AWS GovCloud (US) validator — stages aligned to GovCloud Deployment Runbook v2.1.

Uses boto3 when available and credentials permit; otherwise checks SKIP with reason.
"""

from __future__ import annotations

import os
from typing import Any, Callable, List, Optional, Tuple

from govcloud_validation.base import (
    CheckResult,
    CheckStatus,
    GovCloudValidator,
    StageResult,
    ValidationContext,
)
from govcloud_validation.registry import register

try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError

    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False
    BotoCoreError = ClientError = Exception  # type: ignore


def _aws_error_detail(exc: BaseException) -> str:
    if HAS_BOTO3 and isinstance(exc, ClientError):
        return exc.response.get("Error", {}).get("Message", str(exc))
    return str(exc)


def _env_strip(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def _env_truthy(name: str) -> bool:
    return _env_strip(name).lower() in ("1", "true", "yes", "on")


def _check_expected_scalar(
    check_id: str,
    title: str,
    env_var: str,
    actual: str,
    *,
    control_hints: Optional[List[str]] = None,
) -> CheckResult:
    """PASS/FAIL/SKIP when env_var is set; compare to actual API value."""
    expected = _env_strip(env_var)
    hints = control_hints or []
    if not expected:
        return CheckResult(
            check_id,
            title,
            CheckStatus.SKIP,
            f"Set {env_var} to enforce drift detection (see govcloud_validation/README.md).",
            control_hints=hints,
        )
    if (actual or "") == expected:
        return CheckResult(
            check_id,
            title,
            CheckStatus.PASS,
            f"Matches {env_var}",
            evidence={"expected": expected, "actual": actual},
            control_hints=hints,
        )
    return CheckResult(
        check_id,
        title,
        CheckStatus.FAIL,
        f"{env_var} expected {expected!r}, API returned {actual!r}",
        evidence={"expected": expected, "actual": actual},
        control_hints=hints,
    )


def _check_identity_center_drift(instances_response: dict) -> List[CheckResult]:
    """Optional match for GOVCLOUD_EXPECTED_IDC_INSTANCE_ID / GOVCLOUD_EXPECTED_IDENTITY_STORE_ID."""
    checks: List[CheckResult] = []
    insts = instances_response.get("Instances") or []
    exp_inst = _env_strip("GOVCLOUD_EXPECTED_IDC_INSTANCE_ID")
    exp_store = _env_strip("GOVCLOUD_EXPECTED_IDENTITY_STORE_ID")

    if exp_inst:
        matched = any(
            exp_inst in (i.get("InstanceArn") or "") or (i.get("InstanceArn") or "").rstrip("/").endswith(exp_inst)
            for i in insts
        )
        if not insts:
            checks.append(
                CheckResult(
                    "expected_idc_instance",
                    "Expected IAM Identity Center instance id",
                    CheckStatus.WARN,
                    "list_instances returned no instances; cannot verify GOVCLOUD_EXPECTED_IDC_INSTANCE_ID",
                    control_hints=["AC-2", "IA-2"],
                )
            )
        elif matched:
            checks.append(
                CheckResult(
                    "expected_idc_instance",
                    "Expected IAM Identity Center instance id",
                    CheckStatus.PASS,
                    f"Instance ARN contains {exp_inst!r}",
                    control_hints=["AC-2", "IA-2"],
                )
            )
        else:
            arns = [i.get("InstanceArn", "") for i in insts]
            checks.append(
                CheckResult(
                    "expected_idc_instance",
                    "Expected IAM Identity Center instance id",
                    CheckStatus.FAIL,
                    f"GOVCLOUD_EXPECTED_IDC_INSTANCE_ID {exp_inst!r} not found in {arns!r}",
                    control_hints=["AC-2", "IA-2"],
                )
            )
    else:
        checks.append(
            CheckResult(
                "expected_idc_instance",
                "Expected IAM Identity Center instance id",
                CheckStatus.SKIP,
                "Set GOVCLOUD_EXPECTED_IDC_INSTANCE_ID to enforce (e.g. ssoins-…).",
                control_hints=["AC-2", "IA-2"],
            )
        )

    if exp_store:
        matched = any((i.get("IdentityStoreId") or "") == exp_store for i in insts)
        if not insts:
            checks.append(
                CheckResult(
                    "expected_identity_store",
                    "Expected Identity Center identity store id",
                    CheckStatus.WARN,
                    "list_instances returned no instances; cannot verify GOVCLOUD_EXPECTED_IDENTITY_STORE_ID",
                    control_hints=["AC-2", "IA-2"],
                )
            )
        elif matched:
            checks.append(
                CheckResult(
                    "expected_identity_store",
                    "Expected Identity Center identity store id",
                    CheckStatus.PASS,
                    f"IdentityStoreId matches {exp_store!r}",
                    control_hints=["AC-2", "IA-2"],
                )
            )
        else:
            stores = [i.get("IdentityStoreId", "") for i in insts]
            checks.append(
                CheckResult(
                    "expected_identity_store",
                    "Expected Identity Center identity store id",
                    CheckStatus.FAIL,
                    f"GOVCLOUD_EXPECTED_IDENTITY_STORE_ID {exp_store!r} not in {stores!r}",
                    control_hints=["AC-2", "IA-2"],
                )
            )
    else:
        checks.append(
            CheckResult(
                "expected_identity_store",
                "Expected Identity Center identity store id",
                CheckStatus.SKIP,
                "Set GOVCLOUD_EXPECTED_IDENTITY_STORE_ID to enforce (e.g. d-… from portal URL).",
                control_hints=["AC-2", "IA-2"],
            )
        )

    return checks


def _policy_names_on_target(s: Any, target_id: str, policy_filter: str) -> set[str]:
    """Return policy Names attached to an Organizations target (root or OU)."""
    c = s.client("organizations")
    names: set[str] = set()
    paginator = c.get_paginator("list_policies_for_target")
    for page in paginator.paginate(TargetId=target_id, Filter=policy_filter):
        for p in page.get("Policies") or []:
            n = p.get("Name")
            if n:
                names.add(str(n))
    return names


def _check_expected_policy_names_on_target(
    check_id: str,
    title: str,
    target_id: str,
    policy_filter: str,
    expected: set[str],
    actual: set[str],
    *,
    control_hints: Optional[List[str]] = None,
) -> CheckResult:
    hints = control_hints or []
    missing = expected - actual
    if not missing:
        return CheckResult(
            check_id,
            title,
            CheckStatus.PASS,
            f"All {len(expected)} expected name(s) found on {target_id!r}",
            evidence={"target_id": target_id, "filter": policy_filter},
            control_hints=hints,
        )
    return CheckResult(
        check_id,
        title,
        CheckStatus.FAIL,
        f"Missing on {target_id!r}: {sorted(missing)}",
        evidence={"target_id": target_id, "filter": policy_filter, "sample_actual": sorted(actual)[:25]},
        control_hints=hints,
    )


def _parse_comma_ids(env_name: str) -> set[str]:
    raw = _env_strip(env_name)
    if not raw:
        return set()
    return {p.strip() for p in raw.replace(";", ",").split(",") if p.strip()}


def _collect_all_ou_ids(c: Any, parent_id: str, found: Optional[set[str]] = None) -> set[str]:
    """Recursively collect organizational unit ids under parent (root or OU)."""
    if found is None:
        found = set()
    paginator = c.get_paginator("list_organizational_units_for_parent")
    for page in paginator.paginate(ParentId=parent_id):
        for ou in page.get("OrganizationalUnits") or []:
            oid = ou.get("Id") or ""
            if oid:
                found.add(oid)
                _collect_all_ou_ids(c, oid, found)
    return found


def _check_expected_ou_layout(s: Any) -> List[CheckResult]:
    """Optional: GOVCLOUD_EXPECTED_ROOT_ID, GOVCLOUD_EXPECTED_OU_IDS (comma-separated)."""
    checks: List[CheckResult] = []
    exp_root = _env_strip("GOVCLOUD_EXPECTED_ROOT_ID")
    exp_ous = _parse_comma_ids("GOVCLOUD_EXPECTED_OU_IDS")
    if not exp_root and not exp_ous:
        checks.append(
            CheckResult(
                "expected_ou_layout",
                "Landing zone OU layout (Organizations)",
                CheckStatus.SKIP,
                "Set GOVCLOUD_EXPECTED_ROOT_ID and/or GOVCLOUD_EXPECTED_OU_IDS (comma-separated) "
                "to verify SecRed / runbook v2.1 OU ids — see README.",
                control_hints=["AC-2", "SC-7"],
            )
        )
        return checks
    try:
        c = s.client("organizations")
        roots = c.list_roots().get("Roots") or []
        root_id = (roots[0] or {}).get("Id", "") if roots else ""
        if exp_root:
            if root_id == exp_root:
                checks.append(
                    CheckResult(
                        "expected_root_id",
                        "Organization root id",
                        CheckStatus.PASS,
                        f"Root matches GOVCLOUD_EXPECTED_ROOT_ID ({exp_root!r})",
                        evidence={"root_id": root_id},
                        control_hints=["AC-2"],
                    )
                )
            else:
                checks.append(
                    CheckResult(
                        "expected_root_id",
                        "Organization root id",
                        CheckStatus.FAIL,
                        f"GOVCLOUD_EXPECTED_ROOT_ID was {exp_root!r}, API root is {root_id!r}",
                        evidence={"expected": exp_root, "actual": root_id},
                        control_hints=["AC-2"],
                    )
                )
        if exp_ous:
            if not root_id:
                checks.append(
                    CheckResult(
                        "expected_ou_ids",
                        "Expected OU ids present under root",
                        CheckStatus.WARN,
                        "Could not resolve organization root id",
                        control_hints=["AC-2", "SC-7"],
                    )
                )
            else:
                all_ous = _collect_all_ou_ids(c, root_id)
                missing = exp_ous - all_ous
                if missing:
                    checks.append(
                        CheckResult(
                            "expected_ou_ids",
                            "Expected OU ids present under root",
                            CheckStatus.FAIL,
                            f"Missing OUs: {sorted(missing)} (found {len(all_ous)} total)",
                            evidence={"missing": sorted(missing), "sample_found": sorted(all_ous)[:20]},
                            control_hints=["AC-2", "SC-7"],
                        )
                    )
                else:
                    checks.append(
                        CheckResult(
                            "expected_ou_ids",
                            "Expected OU ids present under root",
                            CheckStatus.PASS,
                            f"All {len(exp_ous)} expected OU id(s) found in organization tree",
                            evidence={"count": len(exp_ous)},
                            control_hints=["AC-2", "SC-7"],
                        )
                    )
    except (BotoCoreError, ClientError) as e:
        checks.append(
            CheckResult(
                "expected_ou_layout",
                "Landing zone OU layout (Organizations)",
                CheckStatus.WARN,
                f"Could not verify OUs: {_aws_error_detail(e)}",
                control_hints=["AC-2", "SC-7"],
            )
        )
    return checks


class AWSGovCloudValidator(GovCloudValidator):
    provider_id = "aws-govcloud"

    STAGES: List[Tuple[str, str]] = [
        ("step_00_prereqs", "0) Pre-Reqs — Account Pairing (Runbook v2.1)"),
        ("step_00_2_us_person", "0.2) US-Person Enforcement — IAM Identity Center"),
        ("step_01_organizations", "1) Landing Zone — Organizations & OUs"),
        ("step_02_root_guardrails", "2) Root Hygiene & SCPs"),
        ("step_03_logging", "3) Centralized Logging & Immutable Evidence"),
        ("step_04_networking", "4) Networking Baseline (VPC)"),
        ("step_05_aurora", "5) Aurora PostgreSQL"),
        ("step_06_compute", "6) ECS Fargate Compute"),
        ("step_07_identity", "7) Cognito + Aurora RLS"),
        ("step_08_encryption", "8) Secrets, Keys & Crypto"),
        ("step_09_enclave", "9) Secure Enclave API (CUI boundary)"),
        ("step_10_sdlc", "10) SDLC — Evidence-First"),
        ("step_11_smoke", "11) First Smoke Test"),
        ("step_12_evidence_binder", "12) C3PAO Evidence Binder"),
    ]

    def get_stages(self) -> List[Tuple[str, str]]:
        return list(self.STAGES)

    def validate_stage(self, stage_id: str, ctx: ValidationContext) -> StageResult:
        title = dict(self.STAGES).get(stage_id, stage_id)
        if not HAS_BOTO3:
            return StageResult(
                stage_id=stage_id,
                title=title,
                checks=[
                    CheckResult(
                        "boto3",
                        "boto3 installed",
                        CheckStatus.SKIP,
                        "boto3 not installed; pip install boto3",
                    )
                ],
            )

        handlers: dict[str, Callable[[ValidationContext], List[CheckResult]]] = {
            "step_00_prereqs": self._step_00,
            "step_00_2_us_person": self._step_00_2,
            "step_01_organizations": self._step_01,
            "step_02_root_guardrails": self._step_02,
            "step_03_logging": self._step_03,
            "step_04_networking": self._step_04,
            "step_05_aurora": self._step_05,
            "step_06_compute": self._step_06,
            "step_07_identity": self._step_07,
            "step_08_encryption": self._step_08,
            "step_09_enclave": self._step_09,
            "step_10_sdlc": self._step_10,
            "step_11_smoke": self._step_11,
            "step_12_evidence_binder": self._step_12,
        }
        fn = handlers.get(stage_id)
        if not fn:
            return StageResult(
                stage_id=stage_id,
                title=title,
                checks=[
                    CheckResult(
                        "unknown_stage",
                        "stage",
                        CheckStatus.SKIP,
                        f"No handler for {stage_id}",
                    )
                ],
            )
        try:
            checks = fn(ctx)
        except Exception as e:  # noqa: BLE001 — surface as single check failure
            checks = [
                CheckResult(
                    "stage_error",
                    "stage execution",
                    CheckStatus.WARN,
                    _aws_error_detail(e),
                )
            ]
        return StageResult(stage_id=stage_id, title=title, checks=checks)

    def _identity_center_checks(self, s: Any) -> List[CheckResult]:
        """IAM Identity Center reachability + optional instance / store drift (Runbook 0.2)."""
        checks: List[CheckResult] = []

        def sso_instances():
            c = s.client("sso-admin")
            return c.list_instances()

        checks.append(
            self._safe_call(
                "identity_center_instances",
                "IAM Identity Center (sso-admin) reachable",
                sso_instances,
                control_hints=["AC-2", "IA-2"],
            )
        )
        try:
            raw = s.client("sso-admin").list_instances()
            checks.extend(_check_identity_center_drift(raw))
        except (BotoCoreError, ClientError) as e:
            code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
            if code in ("AccessDenied", "UnauthorizedOperation", "AccessDeniedException"):
                for cid, title in (
                    ("expected_idc_instance", "Expected IAM Identity Center instance id"),
                    ("expected_identity_store", "Expected Identity Center identity store id"),
                ):
                    checks.append(
                        CheckResult(
                            cid,
                            title,
                            CheckStatus.WARN,
                            f"Cannot list Identity Center instances: {_aws_error_detail(e)}",
                            control_hints=["AC-2", "IA-2"],
                        )
                    )
            else:
                checks.append(
                    CheckResult(
                        "identity_center_drift",
                        "Identity Center drift checks",
                        CheckStatus.SKIP,
                        _aws_error_detail(e),
                        control_hints=["AC-2", "IA-2"],
                    )
                )
        checks.extend(self._permission_set_checks(s))
        return checks

    def _permission_set_abac_tag_checks(
        self,
        admin: Any,
        ps_arn: Optional[str],
        instance_arn: Optional[str] = None,
    ) -> List[CheckResult]:
        """
        Optional ABAC tag on the **permission set** (sso-admin:ListTagsForResource).

        Shorthand: GOVCLOUD_EXPECT_PS_ABAC_USPERSON=1 → usPerson=true if key/value not set.
        """
        out: List[CheckResult] = []
        key = _env_strip("GOVCLOUD_EXPECTED_PS_TAG_KEY")
        val = _env_strip("GOVCLOUD_EXPECTED_PS_TAG_VALUE")
        if _env_strip("GOVCLOUD_EXPECT_PS_ABAC_USPERSON").lower() in ("1", "true", "yes"):
            if not key:
                key = "usPerson"
            if not val:
                val = "true"
        if not key and not val:
            out.append(
                CheckResult(
                    "permission_set_abac_tag",
                    "Permission set ABAC tag (e.g. usPerson)",
                    CheckStatus.SKIP,
                    "Set GOVCLOUD_EXPECTED_PS_TAG_KEY and GOVCLOUD_EXPECTED_PS_TAG_VALUE, or "
                    "GOVCLOUD_EXPECT_PS_ABAC_USPERSON=1 for usPerson=true — see README.",
                    control_hints=["AC-2", "AC-3", "IA-2"],
                )
            )
            return out
        if not key or not val:
            out.append(
                CheckResult(
                    "permission_set_abac_tag",
                    "Permission set ABAC tag (e.g. usPerson)",
                    CheckStatus.WARN,
                    "Set both GOVCLOUD_EXPECTED_PS_TAG_KEY and GOVCLOUD_EXPECTED_PS_TAG_VALUE.",
                    control_hints=["AC-2", "IA-2"],
                )
            )
            return out
        if not ps_arn:
            out.append(
                CheckResult(
                    "permission_set_abac_tag",
                    "Permission set ABAC tag (e.g. usPerson)",
                    CheckStatus.SKIP,
                    "Could not resolve permission set ARN; fix ARN/name checks above first.",
                    control_hints=["AC-2", "IA-2"],
                )
            )
            return out
        if admin is None:
            out.append(
                CheckResult(
                    "permission_set_abac_tag",
                    "Permission set ABAC tag (e.g. usPerson)",
                    CheckStatus.SKIP,
                    "sso-admin client unavailable; cannot list permission set tags.",
                    control_hints=["AC-2", "IA-2"],
                )
            )
            return out
        try:
            kwargs = {"ResourceArn": ps_arn}
            # sso-admin in GovCloud commonly requires InstanceArn for this API.
            if instance_arn:
                kwargs["InstanceArn"] = instance_arn
            resp = admin.list_tags_for_resource(**kwargs)
            tags = {str(t.get("Key", "")): str(t.get("Value", "")) for t in resp.get("Tags") or []}
            actual = tags.get(key)
            if actual == val:
                out.append(
                    CheckResult(
                        "permission_set_abac_tag",
                        f"Permission set tag {key!r}",
                        CheckStatus.PASS,
                        f"Tag value matches ({key}={val})",
                        evidence={"tag_key": key},
                        control_hints=["AC-2", "AC-3", "IA-2"],
                    )
                )
            else:
                out.append(
                    CheckResult(
                        "permission_set_abac_tag",
                        f"Permission set tag {key!r}",
                        CheckStatus.FAIL,
                        f"Expected {key!r}={val!r}, found {actual!r} on permission set.",
                        evidence={"tag_key": key, "keys_present": sorted(tags.keys())},
                        control_hints=["AC-2", "AC-3", "IA-2"],
                    )
                )
        except (BotoCoreError, ClientError) as e:
            code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
            st = CheckStatus.WARN if code in ("AccessDenied", "UnauthorizedOperation", "AccessDeniedException") else CheckStatus.SKIP
            out.append(
                CheckResult(
                    "permission_set_abac_tag",
                    "Permission set ABAC tag (e.g. usPerson)",
                    st,
                    _aws_error_detail(e),
                    control_hints=["AC-2", "IA-2"],
                )
            )
        return out

    def _permission_set_checks(self, s: Any) -> List[CheckResult]:
        """Optional: GOVCLOUD_EXPECTED_PERMISSION_SET_ARN / GOVCLOUD_EXPECTED_PERMISSION_SET_NAME (CUI workload PS)."""
        out: List[CheckResult] = []
        exp_arn = _env_strip("GOVCLOUD_EXPECTED_PERMISSION_SET_ARN")
        exp_name = _env_strip("GOVCLOUD_EXPECTED_PERMISSION_SET_NAME")
        if not exp_arn and not exp_name:
            out.append(
                CheckResult(
                    "expected_permission_set",
                    "CUI / workload permission set (Identity Center)",
                    CheckStatus.SKIP,
                    "Set GOVCLOUD_EXPECTED_PERMISSION_SET_ARN and/or GOVCLOUD_EXPECTED_PERMISSION_SET_NAME "
                    "(e.g. CUIWorkloadAccess) — see README.",
                    control_hints=["AC-2", "IA-2", "AC-3"],
                )
            )
            tag_admin = s.client("sso-admin") if HAS_BOTO3 else None
            out.extend(self._permission_set_abac_tag_checks(tag_admin, None, None))
            return out
        try:
            admin = s.client("sso-admin")
            insts = admin.list_instances().get("Instances") or []
            if not insts:
                out.append(
                    CheckResult(
                        "expected_permission_set",
                        "CUI / workload permission set (Identity Center)",
                        CheckStatus.WARN,
                        "No IAM Identity Center instances returned; cannot verify permission set.",
                        control_hints=["AC-2", "IA-2"],
                    )
                )
                out.extend(self._permission_set_abac_tag_checks(admin, None, None))
                return out
            instance_arn = insts[0].get("InstanceArn") or ""
            if not instance_arn:
                out.append(
                    CheckResult(
                        "expected_permission_set",
                        "CUI / workload permission set (Identity Center)",
                        CheckStatus.WARN,
                        "Identity Center instance ARN missing from API response.",
                        control_hints=["AC-2", "IA-2"],
                    )
                )
                out.extend(self._permission_set_abac_tag_checks(admin, None, instance_arn))
                return out
            ps_arns: List[str] = []
            paginator = admin.get_paginator("list_permission_sets")
            for page in paginator.paginate(InstanceArn=instance_arn):
                ps_arns.extend(page.get("PermissionSets") or [])

            name_ps_arn: Optional[str] = None
            name_desc: Optional[dict] = None
            if exp_name:
                for ps_arn in ps_arns:
                    try:
                        desc = admin.describe_permission_set(
                            InstanceArn=instance_arn,
                            PermissionSetArn=ps_arn,
                        ).get("PermissionSet")
                    except (BotoCoreError, ClientError):
                        continue
                    if not desc:
                        continue
                    if (desc.get("Name") or "") == exp_name:
                        name_ps_arn = ps_arn
                        name_desc = desc
                        break

            if exp_arn:
                if exp_arn in ps_arns:
                    out.append(
                        CheckResult(
                            "expected_permission_set_arn",
                            "Expected permission set ARN registered",
                            CheckStatus.PASS,
                            "Permission set ARN found via sso-admin:ListPermissionSets",
                            evidence={"permission_set_arn": exp_arn},
                            control_hints=["AC-2", "IA-2"],
                        )
                    )
                else:
                    out.append(
                        CheckResult(
                            "expected_permission_set_arn",
                            "Expected permission set ARN registered",
                            CheckStatus.FAIL,
                            f"GOVCLOUD_EXPECTED_PERMISSION_SET_ARN not in instance ({len(ps_arns)} permission set(s) total).",
                            evidence={"expected": exp_arn, "sample": ps_arns[:5]},
                            control_hints=["AC-2", "IA-2"],
                        )
                    )
            else:
                out.append(
                    CheckResult(
                        "expected_permission_set_arn",
                        "Expected permission set ARN registered",
                        CheckStatus.SKIP,
                        "Set GOVCLOUD_EXPECTED_PERMISSION_SET_ARN to enforce exact ARN.",
                        control_hints=["AC-2", "IA-2"],
                    )
                )

            if exp_name:
                if name_desc and name_ps_arn:
                    out.append(
                        CheckResult(
                            "expected_permission_set_name",
                            "Expected permission set name",
                            CheckStatus.PASS,
                            f"Permission set {exp_name!r} present",
                            evidence={
                                "name": name_desc.get("Name"),
                                "session_duration": name_desc.get("SessionDuration"),
                            },
                            control_hints=["AC-2", "IA-2", "AC-3"],
                        )
                    )
                else:
                    out.append(
                        CheckResult(
                            "expected_permission_set_name",
                            "Expected permission set name",
                            CheckStatus.FAIL,
                            f"No permission set named {exp_name!r} in this Identity Center instance.",
                            control_hints=["AC-2", "IA-2"],
                        )
                    )
            else:
                out.append(
                    CheckResult(
                        "expected_permission_set_name",
                        "Expected permission set name",
                        CheckStatus.SKIP,
                        "Set GOVCLOUD_EXPECTED_PERMISSION_SET_NAME (e.g. CUIWorkloadAccess) to enforce.",
                        control_hints=["AC-2", "IA-2"],
                    )
                )

            resolved_ps_arn: Optional[str] = None
            if exp_arn and exp_arn in ps_arns:
                resolved_ps_arn = exp_arn
            elif name_ps_arn:
                resolved_ps_arn = name_ps_arn
            if (
                exp_arn
                and exp_arn in ps_arns
                and name_ps_arn
                and name_ps_arn != exp_arn
            ):
                out.append(
                    CheckResult(
                        "permission_set_arn_name_consistency",
                        "Permission set ARN matches name resolution",
                        CheckStatus.WARN,
                        f"GOVCLOUD_EXPECTED_PERMISSION_SET_ARN and name {exp_name!r} map to different permission sets.",
                        control_hints=["AC-2", "IA-2"],
                    )
                )

            out.extend(self._permission_set_abac_tag_checks(admin, resolved_ps_arn, instance_arn))

        except (BotoCoreError, ClientError) as e:
            code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
            st = CheckStatus.WARN if code in ("AccessDenied", "UnauthorizedOperation", "AccessDeniedException") else CheckStatus.SKIP
            out.append(
                CheckResult(
                    "expected_permission_set",
                    "CUI / workload permission set (Identity Center)",
                    st,
                    _aws_error_detail(e),
                    control_hints=["AC-2", "IA-2"],
                )
            )
            try:
                out.extend(self._permission_set_abac_tag_checks(s.client("sso-admin"), None, None))
            except Exception:  # noqa: BLE001
                pass
        return out

    def _session(self, ctx: ValidationContext):
        return boto3.session.Session(region_name=ctx.region)

    def _safe_call(
        self,
        check_id: str,
        name: str,
        fn: Callable[[], Any],
        pass_detail: str = "",
        control_hints: Optional[List[str]] = None,
    ) -> CheckResult:
        try:
            out = fn()
            return CheckResult(
                check_id,
                name,
                CheckStatus.PASS,
                pass_detail or "OK",
                evidence=_evidence_blob(out),
                control_hints=control_hints or [],
            )
        except (BotoCoreError, ClientError) as e:
            code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
            if code in ("AccessDenied", "UnauthorizedOperation", "AccessDeniedException"):
                return CheckResult(
                    check_id,
                    name,
                    CheckStatus.WARN,
                    f"Insufficient permission or denied: {_aws_error_detail(e)}",
                    control_hints=control_hints or [],
                )
            return CheckResult(
                check_id,
                name,
                CheckStatus.SKIP,
                _aws_error_detail(e),
                control_hints=control_hints or [],
            )

    # --- Step implementations ---

    def _step_00(self, ctx: ValidationContext) -> List[CheckResult]:
        s = self._session(ctx)
        checks: List[CheckResult] = []

        def caller():
            sts = s.client("sts")
            return sts.get_caller_identity()

        checks.append(
            self._safe_call(
                "sts_caller_identity",
                "STS GetCallerIdentity (GovCloud region session)",
                caller,
                "Active AWS credentials in this session",
                ["AC-2", "IA-2"],
            )
        )
        # Optional: verify caller account matches AdinKhepra GovCloud workload account
        if _env_strip("GOVCLOUD_EXPECTED_ACCOUNT_ID"):
            try:
                ident = s.client("sts").get_caller_identity()
                acct = ident.get("Account") or ""
                checks.append(
                    _check_expected_scalar(
                        "expected_govcloud_account_id",
                        "Expected GovCloud account ID (STS)",
                        "GOVCLOUD_EXPECTED_ACCOUNT_ID",
                        acct,
                        control_hints=["AC-2", "IA-2"],
                    )
                )
            except (BotoCoreError, ClientError) as e:
                checks.append(
                    CheckResult(
                        "expected_govcloud_account_id",
                        "Expected GovCloud account ID (STS)",
                        CheckStatus.WARN,
                        f"Could not re-read caller identity: {_aws_error_detail(e)}",
                        control_hints=["AC-2", "IA-2"],
                    )
                )
        else:
            checks.append(
                CheckResult(
                    "expected_govcloud_account_id",
                    "Expected GovCloud account ID (STS)",
                    CheckStatus.SKIP,
                    "Set GOVCLOUD_EXPECTED_ACCOUNT_ID to enforce (12-digit GovCloud account id — see README).",
                    control_hints=["AC-2", "IA-2"],
                )
            )
        # Root account hygiene (IAM summary — IA-5, AC-2)
        try:
            sm = (s.client("iam").get_account_summary() or {}).get("SummaryMap") or {}
            mfa = int(sm.get("AccountMFAEnabled") or 0)
            checks.append(
                CheckResult(
                    "iam_root_mfa_enabled",
                    "AWS account root user MFA (IAM summary)",
                    CheckStatus.PASS if mfa >= 1 else CheckStatus.WARN,
                    "Root MFA enabled per AccountMFAEnabled"
                    if mfa >= 1
                    else "Root MFA not enabled (AccountMFAEnabled=0) — enable for NIST 3.5.3 / IA-2(1) baseline",
                    evidence={"AccountMFAEnabled": mfa},
                    control_hints=["IA-2", "IA-5", "AC-2"],
                )
            )
            keys = int(sm.get("AccountAccessKeysPresent") or 0)
            checks.append(
                CheckResult(
                    "iam_root_access_keys_absent",
                    "AWS account root access keys absent",
                    CheckStatus.PASS if keys == 0 else CheckStatus.WARN,
                    "No active root access keys reported"
                    if keys == 0
                    else f"AccountAccessKeysPresent={keys} — remove root access keys",
                    evidence={"AccountAccessKeysPresent": keys},
                    control_hints=["IA-5", "AC-2", "AC-3"],
                )
            )
        except (BotoCoreError, ClientError) as e:
            checks.append(
                CheckResult(
                    "iam_root_mfa_enabled",
                    "AWS account root user MFA (IAM summary)",
                    CheckStatus.WARN,
                    f"Could not read IAM account summary: {_aws_error_detail(e)}",
                    control_hints=["IA-2", "IA-5"],
                )
            )
            checks.append(
                CheckResult(
                    "iam_root_access_keys_absent",
                    "AWS account root access keys absent",
                    CheckStatus.WARN,
                    f"Could not read IAM account summary: {_aws_error_detail(e)}",
                    control_hints=["IA-5"],
                )
            )
        return checks

    def _step_00_2(self, ctx: ValidationContext) -> List[CheckResult]:
        return self._identity_center_checks(self._session(ctx))

    def _step_01(self, ctx: ValidationContext) -> List[CheckResult]:
        s = self._session(ctx)
        checks: List[CheckResult] = []

        def org():
            c = s.client("organizations")
            return c.describe_organization()

        checks.append(
            self._safe_call(
                "organizations_describe",
                "AWS Organizations present",
                org,
                control_hints=["AC-2"],
            )
        )

        def roots():
            c = s.client("organizations")
            return c.list_roots()

        checks.append(
            self._safe_call(
                "organizations_roots",
                "Organization roots listed",
                roots,
                control_hints=["AC-2"],
            )
        )

        if _env_strip("GOVCLOUD_EXPECTED_ORG_ID"):
            try:
                c = s.client("organizations")
                org = c.describe_organization().get("Organization") or {}
                oid = org.get("Id") or ""
                checks.append(
                    _check_expected_scalar(
                        "expected_organization_id",
                        "Expected AWS Organization ID",
                        "GOVCLOUD_EXPECTED_ORG_ID",
                        oid,
                        control_hints=["AC-2"],
                    )
                )
            except (BotoCoreError, ClientError) as e:
                checks.append(
                    CheckResult(
                        "expected_organization_id",
                        "Expected AWS Organization ID",
                        CheckStatus.WARN,
                        f"Could not describe organization: {_aws_error_detail(e)}",
                        control_hints=["AC-2"],
                    )
                )
        else:
            checks.append(
                CheckResult(
                    "expected_organization_id",
                    "Expected AWS Organization ID",
                    CheckStatus.SKIP,
                    "Set GOVCLOUD_EXPECTED_ORG_ID to enforce (see README).",
                    control_hints=["AC-2"],
                )
            )
        checks.extend(_check_expected_ou_layout(s))
        return checks

    def _step_02(self, ctx: ValidationContext) -> List[CheckResult]:
        """Root / org SCP attachments — Runbook v2.1 Step 2 (custom SCPs expected for guardrails)."""
        s = self._session(ctx)
        checks: List[CheckResult] = []

        def scp_on_root():
            c = s.client("organizations")
            roots = c.list_roots().get("Roots") or []
            rid = (roots[0] or {}).get("Id", "")
            policies: List[dict] = []
            paginator = c.get_paginator("list_policies_for_target")
            for page in paginator.paginate(TargetId=rid, Filter="SERVICE_CONTROL_POLICY"):
                policies.extend(page.get("Policies") or [])
            return {"root_id": rid, "policies": policies, "policy_count": len(policies)}

        checks.append(
            self._safe_call(
                "scp_list_root",
                "Service control policies attached at organization root",
                scp_on_root,
                "Listed SCPs for root target",
                control_hints=["AC-2", "SC-7", "CM-2"],
            )
        )

        try:
            c = s.client("organizations")
            roots = c.list_roots().get("Roots") or []
            rid = (roots[0] or {}).get("Id", "")
            policies: List[dict] = []
            paginator = c.get_paginator("list_policies_for_target")
            for page in paginator.paginate(TargetId=rid, Filter="SERVICE_CONTROL_POLICY"):
                policies.extend(page.get("Policies") or [])
            custom = [p for p in policies if p.get("AwsManaged") is False]
            if not policies:
                checks.append(
                    CheckResult(
                        "scp_custom_guardrails",
                        "Custom SCP guardrails on root",
                        CheckStatus.WARN,
                        "No SCPs returned for root — verify Organizations API permissions or SCP attachment.",
                        control_hints=["AC-2", "SC-7"],
                    )
                )
            elif not custom:
                checks.append(
                    CheckResult(
                        "scp_custom_guardrails",
                        "Custom SCP guardrails on root",
                        CheckStatus.WARN,
                        "Only AWS-managed SCPs at root; add org-defined SCPs for Step 2 guardrails (typical for CMMC baseline).",
                        evidence={"attached_count": len(policies)},
                        control_hints=["AC-2", "SC-7", "CM-2"],
                    )
                )
            else:
                names = [p.get("Name", "") for p in custom]
                checks.append(
                    CheckResult(
                        "scp_custom_guardrails",
                        "Custom SCP guardrails on root",
                        CheckStatus.PASS,
                        f"{len(custom)} custom SCP(s) on root: {names[:10]}",
                        evidence={"custom_names": names},
                        control_hints=["AC-2", "SC-7", "CM-2"],
                    )
                )
        except (BotoCoreError, ClientError) as e:
            checks.append(
                CheckResult(
                    "scp_custom_guardrails",
                    "Custom SCP guardrails on root",
                    CheckStatus.WARN,
                    f"Could not analyze SCPs: {_aws_error_detail(e)}",
                    control_hints=["AC-2", "SC-7"],
                )
            )

        exp_names = _parse_comma_ids("GOVCLOUD_EXPECTED_SCP_NAMES")
        if exp_names:
            try:
                c = s.client("organizations")
                roots = c.list_roots().get("Roots") or []
                rid = (roots[0] or {}).get("Id", "")
                policies = []
                paginator = c.get_paginator("list_policies_for_target")
                for page in paginator.paginate(TargetId=rid, Filter="SERVICE_CONTROL_POLICY"):
                    policies.extend(page.get("Policies") or [])
                attached_names = {str(p.get("Name") or "") for p in policies}
                missing = exp_names - attached_names
                if missing:
                    checks.append(
                        CheckResult(
                            "expected_scp_names",
                            "Expected SCP names attached at root",
                            CheckStatus.FAIL,
                            f"Not attached at root: {sorted(missing)}",
                        )
                    )
                else:
                    checks.append(
                        CheckResult(
                            "expected_scp_names",
                            "Expected SCP names attached at root",
                            CheckStatus.PASS,
                            f"All {len(exp_names)} expected SCP name(s) found at root",
                        )
                    )
            except (BotoCoreError, ClientError) as e:
                checks.append(
                    CheckResult(
                        "expected_scp_names",
                        "Expected SCP names attached at root",
                        CheckStatus.WARN,
                        _aws_error_detail(e),
                    )
                )
        else:
            checks.append(
                CheckResult(
                    "expected_scp_names",
                    "Expected SCP names attached at root",
                    CheckStatus.SKIP,
                    "Optional: set GOVCLOUD_EXPECTED_SCP_NAMES (comma-separated) after you name your SCPs.",
                )
            )

        # Optional: SCPs on Workloads (or other) OU — e.g. DenyNonApprovedServices
        w_ou = _env_strip("GOVCLOUD_EXPECTED_WORKLOADS_OU_ID")
        w_scp = _parse_comma_ids("GOVCLOUD_EXPECTED_SCP_NAMES_WORKLOADS_OU")
        if w_ou and w_scp:
            try:
                actual_w = _policy_names_on_target(s, w_ou, "SERVICE_CONTROL_POLICY")
                checks.append(
                    _check_expected_policy_names_on_target(
                        "expected_scp_names_workloads_ou",
                        "Expected SCP names on Workloads OU",
                        w_ou,
                        "SERVICE_CONTROL_POLICY",
                        w_scp,
                        actual_w,
                        control_hints=["AC-2", "SC-7", "CM-2"],
                    )
                )
            except (BotoCoreError, ClientError) as e:
                checks.append(
                    CheckResult(
                        "expected_scp_names_workloads_ou",
                        "Expected SCP names on Workloads OU",
                        CheckStatus.WARN,
                        _aws_error_detail(e),
                        control_hints=["AC-2", "SC-7"],
                    )
                )
        elif w_ou or w_scp:
            checks.append(
                CheckResult(
                    "expected_scp_names_workloads_ou",
                    "Expected SCP names on Workloads OU",
                    CheckStatus.SKIP,
                    "Set both GOVCLOUD_EXPECTED_WORKLOADS_OU_ID and GOVCLOUD_EXPECTED_SCP_NAMES_WORKLOADS_OU.",
                    control_hints=["AC-2", "SC-7"],
                )
            )
        else:
            checks.append(
                CheckResult(
                    "expected_scp_names_workloads_ou",
                    "Expected SCP names on Workloads OU",
                    CheckStatus.SKIP,
                    "Optional: set GOVCLOUD_EXPECTED_WORKLOADS_OU_ID and GOVCLOUD_EXPECTED_SCP_NAMES_WORKLOADS_OU.",
                    control_hints=["AC-2", "SC-7"],
                )
            )

        # Optional: Resource Control Policies (RCP) on Security OU — GovCloud Organizations feature
        sec_ou = _env_strip("GOVCLOUD_EXPECTED_SECURITY_OU_ID")
        rcp_names = _parse_comma_ids("GOVCLOUD_EXPECTED_RCP_NAMES")
        if sec_ou and rcp_names:
            try:
                actual_r = _policy_names_on_target(s, sec_ou, "RESOURCE_CONTROL_POLICY")
                checks.append(
                    _check_expected_policy_names_on_target(
                        "expected_rcp_names_security_ou",
                        "Expected RCP names on Security OU",
                        sec_ou,
                        "RESOURCE_CONTROL_POLICY",
                        rcp_names,
                        actual_r,
                        control_hints=["AC-3", "SC-7", "CM-2"],
                    )
                )
            except (BotoCoreError, ClientError) as e:
                checks.append(
                    CheckResult(
                        "expected_rcp_names_security_ou",
                        "Expected RCP names on Security OU",
                        CheckStatus.WARN,
                        _aws_error_detail(e),
                        control_hints=["AC-3", "SC-7"],
                    )
                )
        elif sec_ou or rcp_names:
            checks.append(
                CheckResult(
                    "expected_rcp_names_security_ou",
                    "Expected RCP names on Security OU",
                    CheckStatus.SKIP,
                    "Set both GOVCLOUD_EXPECTED_SECURITY_OU_ID and GOVCLOUD_EXPECTED_RCP_NAMES.",
                    control_hints=["AC-3", "SC-7"],
                )
            )
        else:
            checks.append(
                CheckResult(
                    "expected_rcp_names_security_ou",
                    "Expected RCP names on Security OU",
                    CheckStatus.SKIP,
                    "Optional: set GOVCLOUD_EXPECTED_SECURITY_OU_ID and GOVCLOUD_EXPECTED_RCP_NAMES.",
                    control_hints=["AC-3", "SC-7"],
                )
            )

        return checks

    def _step_03(self, ctx: ValidationContext) -> List[CheckResult]:
        s = self._session(ctx)
        checks: List[CheckResult] = []

        def trails():
            c = s.client("cloudtrail")
            return c.describe_trails()

        checks.append(
            self._safe_call(
                "cloudtrail_describe",
                "CloudTrail trails visible",
                trails,
                control_hints=["AU-2", "AU-3"],
            )
        )

        try:
            gd_out = s.client("guardduty").list_detectors()
            checks.append(
                CheckResult(
                    "guardduty_list_detectors",
                    "GuardDuty API reachable",
                    CheckStatus.PASS,
                    "OK",
                    evidence=_evidence_blob(gd_out),
                    control_hints=["SI-4"],
                )
            )
            det_ids = gd_out.get("DetectorIds") or []
            checks.append(
                CheckResult(
                    "guardduty_detector_present",
                    "GuardDuty detector enabled (this region)",
                    CheckStatus.PASS if det_ids else CheckStatus.WARN,
                    f"{len(det_ids)} detector(s) in {ctx.region!r}"
                    if det_ids
                    else "No GuardDuty detector in this region — enable for threat detection baseline",
                    evidence={"detector_count": len(det_ids)},
                    control_hints=["SI-4", "RA-5"],
                )
            )
        except (BotoCoreError, ClientError) as e:
            code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
            st = CheckStatus.WARN if code in ("AccessDenied", "UnauthorizedOperation", "AccessDeniedException") else CheckStatus.SKIP
            checks.append(
                CheckResult(
                    "guardduty_list_detectors",
                    "GuardDuty API reachable",
                    st,
                    _aws_error_detail(e),
                    control_hints=["SI-4"],
                )
            )
            checks.append(
                CheckResult(
                    "guardduty_detector_present",
                    "GuardDuty detector enabled (this region)",
                    st,
                    _aws_error_detail(e),
                    control_hints=["SI-4"],
                )
            )

        trail_name = _env_strip("GOVCLOUD_EXPECTED_CLOUDTRAIL_NAME")
        if trail_name:

            def trail_detail():
                return s.client("cloudtrail").get_trail(Name=trail_name)

            checks.append(
                self._safe_call(
                    "cloudtrail_named_trail",
                    f"CloudTrail trail {trail_name!r} exists",
                    trail_detail,
                    control_hints=["AU-2", "AU-3", "SI-4"],
                )
            )
            try:
                st = s.client("cloudtrail").get_trail_status(Name=trail_name)
                logging_on = bool(st.get("IsLogging"))
                checks.append(
                    CheckResult(
                        "cloudtrail_logging_enabled",
                        f"CloudTrail trail {trail_name!r} logging",
                        CheckStatus.PASS if logging_on else CheckStatus.WARN,
                        "Logging enabled" if logging_on else "Trail exists but IsLogging is false",
                        evidence={"IsLogging": st.get("IsLogging"), "LatestDeliveryError": st.get("LatestDeliveryError")},
                        control_hints=["AU-2", "AU-3"],
                    )
                )
                lv = st.get("LogFileValidationEnabled")
                if lv is not None:
                    checks.append(
                        CheckResult(
                            "cloudtrail_log_file_validation",
                            f"CloudTrail log file validation ({trail_name})",
                            CheckStatus.PASS if lv else CheckStatus.WARN,
                            "Enabled" if lv else "Log file validation not enabled",
                            control_hints=["AU-2", "SI-7"],
                        )
                    )
            except (BotoCoreError, ClientError) as e:
                checks.append(
                    CheckResult(
                        "cloudtrail_logging_enabled",
                        f"CloudTrail trail {trail_name!r} status",
                        CheckStatus.WARN,
                        _aws_error_detail(e),
                        control_hints=["AU-2"],
                    )
                )
        else:
            checks.append(
                CheckResult(
                    "cloudtrail_named_trail",
                    "Named CloudTrail trail (drift)",
                    CheckStatus.SKIP,
                    "Set GOVCLOUD_EXPECTED_CLOUDTRAIL_NAME to enforce a specific trail.",
                    control_hints=["AU-2", "AU-3"],
                )
            )

        cfg_name = _env_strip("GOVCLOUD_EXPECTED_CONFIG_RECORDER_NAME")
        if not cfg_name and _env_strip("GOVCLOUD_CHECK_CONFIG_RECORDER").lower() in ("1", "true", "yes"):
            cfg_name = "default"
        if cfg_name:

            def cfg_status():
                return s.client("config").describe_configuration_recorder_status(
                    ConfigurationRecorderNames=[cfg_name]
                )

            chk = self._safe_call(
                "config_recorder_status",
                f"AWS Config recorder {cfg_name!r}",
                cfg_status,
                control_hints=["CM-2", "CM-6", "AU-2"],
            )
            checks.append(chk)
            if chk.status == CheckStatus.PASS:
                try:
                    rows = (
                        s.client("config")
                        .describe_configuration_recorder_status(ConfigurationRecorderNames=[cfg_name])
                        .get("ConfigurationRecordersStatus")
                        or []
                    )
                    rec = rows[0] if rows else {}
                    recording = rec.get("recording")
                    checks.append(
                        CheckResult(
                            "config_recorder_recording",
                            f"AWS Config recording ({cfg_name})",
                            CheckStatus.PASS if recording else CheckStatus.WARN,
                            "recording=true" if recording else "recording=false or unknown",
                            evidence={"recording": recording, "last_status": rec.get("lastStatus")},
                            control_hints=["CM-2", "AU-2"],
                        )
                    )
                except (BotoCoreError, ClientError) as e:
                    checks.append(
                        CheckResult(
                            "config_recorder_recording",
                            f"AWS Config recording ({cfg_name})",
                            CheckStatus.WARN,
                            _aws_error_detail(e),
                            control_hints=["CM-2"],
                        )
                    )
        else:
            checks.append(
                CheckResult(
                    "config_recorder_status",
                    "AWS Config recorder",
                    CheckStatus.SKIP,
                    "Set GOVCLOUD_EXPECTED_CONFIG_RECORDER_NAME or GOVCLOUD_CHECK_CONFIG_RECORDER=1 (uses name default).",
                    control_hints=["CM-2", "AU-2"],
                )
            )

        if cfg_name:
            try:
                dc_resp = s.client("config").describe_delivery_channels()
                chans = dc_resp.get("DeliveryChannels") or []
                checks.append(
                    CheckResult(
                        "config_delivery_channel",
                        "AWS Config delivery channel(s)",
                        CheckStatus.PASS if chans else CheckStatus.WARN,
                        f"{len(chans)} delivery channel(s) configured"
                        if chans
                        else "No delivery channel — configuration history may not reach S3",
                        evidence={"channel_count": len(chans)},
                        control_hints=["CM-2", "AU-2", "AU-4"],
                    )
                )
            except (BotoCoreError, ClientError) as e:
                checks.append(
                    CheckResult(
                        "config_delivery_channel",
                        "AWS Config delivery channel(s)",
                        CheckStatus.WARN,
                        _aws_error_detail(e),
                        control_hints=["CM-2", "AU-2"],
                    )
                )

        ev_bucket = _env_strip("GOVCLOUD_EXPECTED_EVIDENCE_BUCKET")
        if ev_bucket:
            s3c = s.client("s3")
            try:
                s3c.head_bucket(Bucket=ev_bucket)
                checks.append(
                    CheckResult(
                        "evidence_bucket_exists",
                        "CUI evidence bucket exists",
                        CheckStatus.PASS,
                        f"HeadBucket OK for {ev_bucket!r}",
                        control_hints=["AU-2", "SI-12", "SC-13"],
                    )
                )
            except (BotoCoreError, ClientError) as e:
                checks.append(
                    CheckResult(
                        "evidence_bucket_exists",
                        "CUI evidence bucket exists",
                        CheckStatus.FAIL,
                        _aws_error_detail(e),
                        control_hints=["AU-2", "SI-12"],
                    )
                )
            try:
                enc = s3c.get_bucket_encryption(Bucket=ev_bucket)
                rules = (enc.get("ServerSideEncryptionConfiguration") or {}).get("Rules") or []
                checks.append(
                    CheckResult(
                        "evidence_bucket_encryption",
                        "Evidence bucket default encryption",
                        CheckStatus.PASS if rules else CheckStatus.WARN,
                        "SSE configured" if rules else "No default encryption rules returned",
                        control_hints=["SC-13", "SI-12"],
                    )
                )
            except (BotoCoreError, ClientError) as e:
                code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
                if code == "ServerSideEncryptionConfigurationNotFoundError":
                    checks.append(
                        CheckResult(
                            "evidence_bucket_encryption",
                            "Evidence bucket default encryption",
                            CheckStatus.WARN,
                            "No default bucket encryption configuration",
                            control_hints=["SC-13"],
                        )
                    )
                else:
                    checks.append(
                        CheckResult(
                            "evidence_bucket_encryption",
                            "Evidence bucket default encryption",
                            CheckStatus.WARN,
                            _aws_error_detail(e),
                            control_hints=["SC-13"],
                        )
                    )
            want_lock = _env_strip("GOVCLOUD_EXPECT_EVIDENCE_OBJECT_LOCK").lower() in ("1", "true", "yes")
            try:
                ol = s3c.get_object_lock_configuration(Bucket=ev_bucket)
                olc = ol.get("ObjectLockConfiguration") or {}
                enabled = (olc.get("ObjectLockEnabled") or "") == "Enabled"
                mode = ((olc.get("Rule") or {}).get("DefaultRetention") or {}).get("Mode")
                days = ((olc.get("Rule") or {}).get("DefaultRetention") or {}).get("Days")
                exp_days = _env_strip("GOVCLOUD_EXPECT_EVIDENCE_OBJECT_LOCK_RETENTION_DAYS")
                if want_lock and enabled and mode == "COMPLIANCE" and exp_days:
                    try:
                        need = int(exp_days)
                        ok = days is not None and int(days) >= need
                        checks.append(
                            CheckResult(
                                "evidence_bucket_object_lock",
                                "Evidence bucket Object Lock (COMPLIANCE)",
                                CheckStatus.PASS if ok else CheckStatus.WARN,
                                f"Retention days={days} (expected >= {need})" if days is not None else "Retention days unknown",
                                evidence={"mode": mode, "days": days},
                                control_hints=["AU-9", "SI-12"],
                            )
                        )
                    except ValueError:
                        checks.append(
                            CheckResult(
                                "evidence_bucket_object_lock",
                                "Evidence bucket Object Lock (COMPLIANCE)",
                                CheckStatus.WARN,
                                "GOVCLOUD_EXPECT_EVIDENCE_OBJECT_LOCK_RETENTION_DAYS must be an integer",
                                control_hints=["AU-9"],
                            )
                        )
                elif want_lock:
                    checks.append(
                        CheckResult(
                            "evidence_bucket_object_lock",
                            "Evidence bucket Object Lock",
                            CheckStatus.PASS if enabled else CheckStatus.WARN,
                            "Object Lock enabled" if enabled else "Object Lock not enabled or mode/days not verified",
                            evidence={"ObjectLockEnabled": olc.get("ObjectLockEnabled"), "mode": mode, "days": days},
                            control_hints=["AU-9", "SI-12"],
                        )
                    )
                else:
                    checks.append(
                        CheckResult(
                            "evidence_bucket_object_lock",
                            "Evidence bucket Object Lock",
                            CheckStatus.SKIP,
                            "Set GOVCLOUD_EXPECT_EVIDENCE_OBJECT_LOCK=1 (and optional retention days) to enforce.",
                            evidence={"ObjectLockEnabled": olc.get("ObjectLockEnabled"), "mode": mode, "days": days},
                            control_hints=["AU-9"],
                        )
                    )
            except (BotoCoreError, ClientError) as e:
                code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
                if code in ("ObjectLockConfigurationNotFoundError", "NoSuchBucket"):
                    msg = "No object lock configuration" if code != "NoSuchBucket" else "Bucket not found"
                    checks.append(
                        CheckResult(
                            "evidence_bucket_object_lock",
                            "Evidence bucket Object Lock",
                            CheckStatus.WARN if want_lock else CheckStatus.SKIP,
                            msg,
                            control_hints=["AU-9", "SI-12"],
                        )
                    )
                else:
                    checks.append(
                        CheckResult(
                            "evidence_bucket_object_lock",
                            "Evidence bucket Object Lock",
                            CheckStatus.WARN,
                            _aws_error_detail(e),
                            control_hints=["AU-9"],
                        )
                    )
            try:
                bpab = s3c.get_public_access_block(Bucket=ev_bucket).get("PublicAccessBlockConfiguration") or {}
                bkeys = (
                    "BlockPublicAcls",
                    "IgnorePublicAcls",
                    "BlockPublicPolicy",
                    "RestrictPublicBuckets",
                )
                all_b = all(bpab.get(k) is True for k in bkeys)
                checks.append(
                    CheckResult(
                        "evidence_bucket_public_access_block",
                        f"S3 Block Public Access on evidence bucket {ev_bucket!r}",
                        CheckStatus.PASS if all_b else CheckStatus.WARN,
                        "All four bucket-level Block Public Access settings enabled"
                        if all_b
                        else f"Incomplete: {', '.join(f'{k}={bpab.get(k)!r}' for k in bkeys)}",
                        evidence=dict(bpab),
                        control_hints=["AC-3", "SC-7", "SI-12"],
                    )
                )
            except (BotoCoreError, ClientError) as e:
                code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
                if code == "NoSuchPublicAccessBlockConfiguration":
                    checks.append(
                        CheckResult(
                            "evidence_bucket_public_access_block",
                            f"S3 Block Public Access on evidence bucket {ev_bucket!r}",
                            CheckStatus.WARN,
                            "Bucket-level Block Public Access not configured",
                            control_hints=["AC-3", "SC-7", "SI-12"],
                        )
                    )
                else:
                    checks.append(
                        CheckResult(
                            "evidence_bucket_public_access_block",
                            f"S3 Block Public Access on evidence bucket {ev_bucket!r}",
                            CheckStatus.WARN,
                            _aws_error_detail(e),
                            control_hints=["AC-3", "SC-7"],
                        )
                    )
        else:
            checks.append(
                CheckResult(
                    "evidence_bucket_exists",
                    "CUI evidence bucket",
                    CheckStatus.SKIP,
                    "Set GOVCLOUD_EXPECTED_EVIDENCE_BUCKET (e.g. your-evidence-<12-digit-account-id>).",
                    control_hints=["AU-2", "SI-12"],
                )
            )

        min_standards = _env_strip("GOVCLOUD_MIN_ENABLED_SECURITY_HUB_STANDARDS")
        if min_standards:
            try:
                need_n = int(min_standards)
                sh = s.client("securityhub")
                subs: List[dict] = []
                token: Optional[str] = None
                while True:
                    kwargs: dict[str, Any] = {}
                    if token:
                        kwargs["NextToken"] = token
                    page = sh.get_enabled_standards(**kwargs)
                    subs.extend(page.get("StandardsSubscriptions") or [])
                    token = page.get("NextToken")
                    if not token:
                        break
                n = len(subs)
                checks.append(
                    CheckResult(
                        "securityhub_enabled_standards_count",
                        "Security Hub enabled standards count",
                        CheckStatus.PASS if n >= need_n else CheckStatus.WARN,
                        f"{n} enabled (minimum {need_n})",
                        evidence={"count": n},
                        control_hints=["SI-4", "RA-5"],
                    )
                )
            except ValueError:
                checks.append(
                    CheckResult(
                        "securityhub_enabled_standards_count",
                        "Security Hub enabled standards count",
                        CheckStatus.SKIP,
                        "GOVCLOUD_MIN_ENABLED_SECURITY_HUB_STANDARDS must be an integer",
                        control_hints=["SI-4"],
                    )
                )
            except (BotoCoreError, ClientError) as e:
                checks.append(
                    CheckResult(
                        "securityhub_enabled_standards_count",
                        "Security Hub enabled standards count",
                        CheckStatus.WARN,
                        _aws_error_detail(e),
                        control_hints=["SI-4"],
                    )
                )
        else:
            checks.append(
                CheckResult(
                    "securityhub_enabled_standards_count",
                    "Security Hub enabled standards count",
                    CheckStatus.SKIP,
                    "Set GOVCLOUD_MIN_ENABLED_SECURITY_HUB_STANDARDS (e.g. 7) to enforce.",
                    control_hints=["SI-4"],
                )
            )

        if _env_truthy("GOVCLOUD_CHECK_IAM_PASSWORD_POLICY"):
            try:
                pol = (s.client("iam").get_account_password_policy() or {}).get("PasswordPolicy") or {}
                need_len = 14
                raw_min = _env_strip("GOVCLOUD_EXPECT_IAM_PASSWORD_MIN_LENGTH")
                if raw_min:
                    try:
                        need_len = int(raw_min)
                    except ValueError:
                        need_len = 14
                got_len = int(pol.get("MinimumPasswordLength") or 0)
                len_ok = got_len >= need_len
                cls_req = (
                    "RequireUppercaseCharacters",
                    "RequireLowercaseCharacters",
                    "RequireNumbers",
                    "RequireSymbols",
                )
                cls_ok = all(pol.get(k) is True for k in cls_req)
                ok = len_ok and cls_ok
                checks.append(
                    CheckResult(
                        "iam_account_password_policy",
                        "IAM account password policy (local IAM users)",
                        CheckStatus.PASS if ok else CheckStatus.WARN,
                        f"min_length={got_len} (>= {need_len}), complexity flags OK"
                        if ok
                        else f"Strengthen policy: min_length={got_len} (want >= {need_len}), "
                        + ", ".join(f"{k}={pol.get(k)!r}" for k in cls_req),
                        evidence={"MinimumPasswordLength": got_len, **{k: pol.get(k) for k in cls_req}},
                        control_hints=["IA-5", "AC-2"],
                    )
                )
            except (BotoCoreError, ClientError) as e:
                code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
                if code == "NoSuchEntity":
                    checks.append(
                        CheckResult(
                            "iam_account_password_policy",
                            "IAM account password policy (local IAM users)",
                            CheckStatus.WARN,
                            "No account password policy — set one if local IAM users exist",
                            control_hints=["IA-5"],
                        )
                    )
                else:
                    checks.append(
                        CheckResult(
                            "iam_account_password_policy",
                            "IAM account password policy (local IAM users)",
                            CheckStatus.WARN,
                            _aws_error_detail(e),
                            control_hints=["IA-5"],
                        )
                    )

        if _env_truthy("GOVCLOUD_CHECK_ACCOUNT_SECURITY_CONTACT"):
            try:
                s.client("account").get_alternate_contact(AlternateContactType="SECURITY")
                checks.append(
                    CheckResult(
                        "account_alternate_security_contact",
                        "AWS account alternate SECURITY contact",
                        CheckStatus.PASS,
                        "Alternate SECURITY contact is configured",
                        control_hints=["IR-6", "SI-12"],
                    )
                )
            except (BotoCoreError, ClientError) as e:
                code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
                if code == "ResourceNotFoundException":
                    checks.append(
                        CheckResult(
                            "account_alternate_security_contact",
                            "AWS account alternate SECURITY contact",
                            CheckStatus.WARN,
                            "No alternate SECURITY contact — set in AWS Account management / Billing contact",
                            control_hints=["IR-6"],
                        )
                    )
                else:
                    checks.append(
                        CheckResult(
                            "account_alternate_security_contact",
                            "AWS account alternate SECURITY contact",
                            CheckStatus.WARN,
                            _aws_error_detail(e),
                            control_hints=["IR-6"],
                        )
                    )

        extra_buckets = [b.strip() for b in _env_strip("GOVCLOUD_S3_BUCKETS_VERIFY_PAB").split(",") if b.strip()]
        if extra_buckets:
            s3b = s.client("s3")
            bad: List[str] = []
            pab_keys = (
                "BlockPublicAcls",
                "IgnorePublicAcls",
                "BlockPublicPolicy",
                "RestrictPublicBuckets",
            )
            for bkt in extra_buckets[:20]:
                try:
                    cfg = s3b.get_public_access_block(Bucket=bkt).get("PublicAccessBlockConfiguration") or {}
                    if not all(cfg.get(k) is True for k in pab_keys):
                        bad.append(bkt)
                except (BotoCoreError, ClientError) as e:
                    code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
                    if code == "NoSuchPublicAccessBlockConfiguration":
                        bad.append(bkt)
                    else:
                        bad.append(f"{bkt}({code or 'error'})")
            checks.append(
                CheckResult(
                    "s3_named_buckets_public_access_block",
                    "S3 Block Public Access on named bucket(s)",
                    CheckStatus.PASS if not bad else CheckStatus.WARN,
                    "All listed buckets have four PAB settings enabled"
                    if not bad
                    else f"Incomplete or error: {bad[:15]}",
                    evidence={"checked": extra_buckets[:20], "failed": bad[:20]},
                    control_hints=["AC-3", "SC-7", "SI-12"],
                )
            )

        # Account-level data protection defaults (supplement org SCPs; CMMC / 800-171 SC family)
        try:
            acct = (s.client("sts").get_caller_identity() or {}).get("Account") or ""
        except (BotoCoreError, ClientError):
            acct = ""
        if acct:
            try:
                s3ctl = s.client("s3control", region_name=ctx.region)
                pab = s3ctl.get_public_access_block(AccountId=acct).get("PublicAccessBlockConfiguration") or {}
                keys = (
                    "BlockPublicAcls",
                    "IgnorePublicAcls",
                    "BlockPublicPolicy",
                    "RestrictPublicBuckets",
                )
                all_on = all(pab.get(k) is True for k in keys)
                checks.append(
                    CheckResult(
                        "account_s3_block_public_access",
                        "Account-wide S3 Block Public Access (all four settings)",
                        CheckStatus.PASS if all_on else CheckStatus.WARN,
                        "All four Block Public Access settings enabled"
                        if all_on
                        else f"S3 account PAB incomplete: {', '.join(f'{k}={pab.get(k)!r}' for k in keys)}",
                        evidence=dict(pab),
                        control_hints=["AC-3", "SC-7", "SI-12"],
                    )
                )
            except (BotoCoreError, ClientError) as e:
                code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
                if code == "NoSuchPublicAccessBlockConfiguration":
                    checks.append(
                        CheckResult(
                            "account_s3_block_public_access",
                            "Account-wide S3 Block Public Access",
                            CheckStatus.WARN,
                            "Account-level Block Public Access not configured",
                            control_hints=["AC-3", "SC-7", "SI-12"],
                        )
                    )
                else:
                    checks.append(
                        CheckResult(
                            "account_s3_block_public_access",
                            "Account-wide S3 Block Public Access",
                            CheckStatus.WARN,
                            f"Could not read account PAB: {_aws_error_detail(e)}",
                            control_hints=["AC-3", "SC-7"],
                        )
                    )
            try:
                ebs = s.client("ec2").get_ebs_encryption_by_default()
                on = ebs.get("EbsEncryptionByDefault") is True
                checks.append(
                    CheckResult(
                        "account_ebs_encryption_by_default",
                        "EBS encryption by default (account/region)",
                        CheckStatus.PASS if on else CheckStatus.WARN,
                        "EBS encryption by default enabled"
                        if on
                        else "EBS encryption by default is not enabled for this account in this region",
                        evidence={"EbsEncryptionByDefault": ebs.get("EbsEncryptionByDefault")},
                        control_hints=["SC-13", "SC-28"],
                    )
                )
            except (BotoCoreError, ClientError) as e:
                checks.append(
                    CheckResult(
                        "account_ebs_encryption_by_default",
                        "EBS encryption by default",
                        CheckStatus.WARN,
                        f"Could not read EBS default encryption: {_aws_error_detail(e)}",
                        control_hints=["SC-13"],
                    )
                )
        else:
            checks.append(
                CheckResult(
                    "account_s3_block_public_access",
                    "Account-wide S3 Block Public Access",
                    CheckStatus.SKIP,
                    "Could not resolve STS account id for S3 account PAB check.",
                    control_hints=["AC-3", "SC-7"],
                )
            )
            checks.append(
                CheckResult(
                    "account_ebs_encryption_by_default",
                    "EBS encryption by default",
                    CheckStatus.SKIP,
                    "Could not resolve STS account id for EBS default encryption check.",
                    control_hints=["SC-13"],
                )
            )

        return checks

    def _step_04(self, ctx: ValidationContext) -> List[CheckResult]:
        s = self._session(ctx)
        checks: List[CheckResult] = []

        def vpcs():
            c = s.client("ec2")
            return c.describe_vpcs()

        checks.append(
            self._safe_call(
                "ec2_vpcs",
                "EC2 VPCs listed in region",
                vpcs,
                control_hints=["SC-7"],
            )
        )

        vpc_id = _env_strip("GOVCLOUD_EXPECTED_VPC_ID")
        if vpc_id:

            def one_vpc():
                return s.client("ec2").describe_vpcs(VpcIds=[vpc_id])

            checks.append(
                self._safe_call(
                    "expected_vpc_id",
                    f"Expected VPC {vpc_id!r} exists",
                    one_vpc,
                    control_hints=["SC-7", "AC-4"],
                )
            )
        else:
            checks.append(
                CheckResult(
                    "expected_vpc_id",
                    "Expected workload VPC id",
                    CheckStatus.SKIP,
                    "Set GOVCLOUD_EXPECTED_VPC_ID to enforce (e.g. vpc-… from deployment inventory).",
                    control_hints=["SC-7"],
                )
            )

        min_subnets = _env_strip("GOVCLOUD_EXPECTED_VPC_SUBNET_COUNT")
        if vpc_id and min_subnets:
            try:
                need = int(min_subnets)
            except ValueError:
                checks.append(
                    CheckResult(
                        "expected_vpc_subnet_count",
                        "Subnet count for expected VPC",
                        CheckStatus.SKIP,
                        "GOVCLOUD_EXPECTED_VPC_SUBNET_COUNT must be an integer",
                        control_hints=["SC-7"],
                    )
                )
            else:
                try:
                    out = s.client("ec2").describe_subnets(
                        Filters=[{"Name": "vpc-id", "Values": [vpc_id]}]
                    )
                except (BotoCoreError, ClientError) as e:
                    checks.append(
                        CheckResult(
                            "expected_vpc_subnet_count",
                            f"Subnet count for VPC {vpc_id}",
                            CheckStatus.WARN,
                            f"Could not list subnets: {_aws_error_detail(e)}",
                            control_hints=["SC-7"],
                        )
                    )
                else:
                    sn = out.get("Subnets") or []
                    n = len(sn)
                    checks.append(
                        CheckResult(
                            "expected_vpc_subnet_count",
                            f"Subnet count for VPC {vpc_id}",
                            CheckStatus.PASS if n >= need else CheckStatus.WARN,
                            f"{n} subnet(s) (expected >= {need})",
                            evidence={"count": n},
                            control_hints=["SC-7"],
                        )
                    )
        elif min_subnets and not vpc_id:
            checks.append(
                CheckResult(
                    "expected_vpc_subnet_count",
                    "Subnet count for expected VPC",
                    CheckStatus.SKIP,
                    "Set GOVCLOUD_EXPECTED_VPC_ID together with GOVCLOUD_EXPECTED_VPC_SUBNET_COUNT.",
                    control_hints=["SC-7"],
                )
            )
        else:
            checks.append(
                CheckResult(
                    "expected_vpc_subnet_count",
                    "Subnet count for expected VPC",
                    CheckStatus.SKIP,
                    "Optional: set GOVCLOUD_EXPECTED_VPC_SUBNET_COUNT with GOVCLOUD_EXPECTED_VPC_ID.",
                    control_hints=["SC-7"],
                )
            )

        return checks

    def _step_05(self, ctx: ValidationContext) -> List[CheckResult]:
        s = self._session(ctx)

        def clusters():
            c = s.client("rds")
            return c.describe_db_clusters()

        return [
            self._safe_call(
                "rds_clusters",
                "RDS/Aurora clusters in region",
                clusters,
                control_hints=["SC-13", "SI-12"],
            ),
        ]

    def _step_06(self, ctx: ValidationContext) -> List[CheckResult]:
        s = self._session(ctx)

        def ecs_clusters():
            c = s.client("ecs")
            return c.list_clusters(maxResults=20)

        return [
            self._safe_call(
                "ecs_list_clusters",
                "ECS clusters listed (Fargate / runbook v2.1 Step 6)",
                ecs_clusters,
                control_hints=["SC-7"],
            ),
        ]

    def _step_07(self, ctx: ValidationContext) -> List[CheckResult]:
        s = self._session(ctx)

        def pools():
            c = s.client("cognito-idp")
            return c.list_user_pools(MaxResults=10)

        return [
            self._safe_call(
                "cognito_user_pools",
                "Cognito user pools listed",
                pools,
                control_hints=["IA-2", "AC-2"],
            ),
        ]

    def _step_08(self, ctx: ValidationContext) -> List[CheckResult]:
        s = self._session(ctx)
        checks: List[CheckResult] = []

        def keys():
            c = s.client("kms")
            return c.list_keys(Limit=20)

        checks.append(
            self._safe_call(
                "kms_list_keys",
                "KMS keys visible",
                keys,
                control_hints=["SC-13"],
            )
        )

        raw_aliases = _parse_comma_ids("GOVCLOUD_EXPECTED_KMS_ALIASES")
        if raw_aliases:
            want = set()
            for a in raw_aliases:
                a = a.strip()
                if not a.startswith("alias/"):
                    a = f"alias/{a}"
                want.add(a)
            try:
                kms = s.client("kms")
                have: set[str] = set()
                paginator = kms.get_paginator("list_aliases")
                for page in paginator.paginate():
                    for row in page.get("Aliases") or []:
                        an = row.get("AliasName")
                        if an:
                            have.add(str(an))
                missing = want - have
                checks.append(
                    CheckResult(
                        "expected_kms_aliases",
                        "Expected KMS key aliases present",
                        CheckStatus.PASS if not missing else CheckStatus.FAIL,
                        "All expected alias(es) found" if not missing else f"Missing aliases: {sorted(missing)}",
                        evidence={"expected": sorted(want), "sample_have": sorted(have)[:30]},
                        control_hints=["SC-13", "SI-12"],
                    )
                )
            except (BotoCoreError, ClientError) as e:
                checks.append(
                    CheckResult(
                        "expected_kms_aliases",
                        "Expected KMS key aliases present",
                        CheckStatus.WARN,
                        _aws_error_detail(e),
                        control_hints=["SC-13"],
                    )
                )
        else:
            checks.append(
                CheckResult(
                    "expected_kms_aliases",
                    "Expected KMS key aliases present",
                    CheckStatus.SKIP,
                    "Set GOVCLOUD_EXPECTED_KMS_ALIASES (comma-separated, with or without alias/ prefix).",
                    control_hints=["SC-13"],
                )
            )

        return checks

    def _step_09(self, ctx: ValidationContext) -> List[CheckResult]:
        s = self._session(ctx)

        def lbs():
            c = s.client("elbv2")
            return c.describe_load_balancers()

        return [
            self._safe_call(
                "elbv2_describe",
                "Application/Network load balancers listed",
                lbs,
                control_hints=["SC-7", "SC-8"],
            ),
        ]

    def _step_10(self, ctx: ValidationContext) -> List[CheckResult]:
        s = self._session(ctx)

        def repos():
            c = s.client("ecr")
            return c.describe_repositories(maxResults=20)

        return [
            self._safe_call(
                "ecr_repositories",
                "ECR repositories listed",
                repos,
                control_hints=["SA-10", "SI-7"],
            ),
        ]

    def _step_11(self, ctx: ValidationContext) -> List[CheckResult]:
        url = os.environ.get("ASAF_SMOKE_HEALTH_URL", "").strip()
        if not url:
            return [
                CheckResult(
                    "smoke_health_url",
                    "Smoke /healthz (set ASAF_SMOKE_HEALTH_URL)",
                    CheckStatus.SKIP,
                    "Set ASAF_SMOKE_HEALTH_URL to your deployed FastAPI health endpoint to verify",
                    control_hints=["SI-11"],
                )
            ]
        import urllib.error
        import urllib.request

        def ping():
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=10) as resp:
                return {"status_code": resp.status, "url": url}

        try:
            out = ping()
            status = CheckStatus.PASS if out.get("status_code") == 200 else CheckStatus.WARN
            return [
                CheckResult(
                    "http_health",
                    f"GET {url}",
                    status,
                    f"HTTP {out.get('status_code')}",
                    evidence=out,
                    control_hints=["SI-11"],
                )
            ]
        except urllib.error.URLError as e:
            return [
                CheckResult(
                    "http_health",
                    f"GET {url}",
                    CheckStatus.WARN,
                    str(e),
                    control_hints=["SI-11"],
                )
            ]

    def _step_12(self, ctx: ValidationContext) -> List[CheckResult]:
        checks: List[CheckResult] = []
        base = ctx.evidence_binder_path
        if base and base.is_dir():
            names = {p.name for p in base.iterdir() if p.is_file()}
            found = any(n.lower().startswith("boundary") or "boundary" in n.lower() for n in names)
            checks.append(
                CheckResult(
                    "binder_artifacts",
                    "Evidence binder directory has files",
                    CheckStatus.PASS if names else CheckStatus.WARN,
                    f"Files: {sorted(names)[:20]}",
                    evidence={"path": str(base), "count": len(names)},
                    control_hints=["AU-2", "CM-2"],
                )
            )
            if not found:
                checks.append(
                    CheckResult(
                        "boundary_diagram",
                        "System boundary artifact (recommended)",
                        CheckStatus.WARN,
                        "Add boundary diagram / narrative to binder path",
                    )
                )
        else:
            checks.append(
                CheckResult(
                    "binder_path",
                    "C3PAO evidence binder (local path)",
                    CheckStatus.SKIP,
                    "Pass --evidence-binder <dir> with Step 12 artifacts, or create ./evidence/binder",
                    control_hints=["AU-2"],
                )
            )
        return checks


def _evidence_blob(obj: Any) -> dict:
    if obj is None:
        return {}
    if isinstance(obj, dict):
        # trim huge responses
        out = {}
        for k in list(obj.keys())[:15]:
            v = obj[k]
            if isinstance(v, (str, int, float, bool)) or v is None:
                out[k] = v
            elif isinstance(v, list):
                out[k] = f"<list len={len(v)}>"
            else:
                out[k] = "<omitted>"
        return out
    return {"result": str(type(obj).__name__)}


register("aws-govcloud", AWSGovCloudValidator)
