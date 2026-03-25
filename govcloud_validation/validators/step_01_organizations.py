"""
Step 1 — Landing Zone — Organizations & OUs (Runbook v2.1)

Validates:
  - AWS Organization exists
  - Organization ID matches expected
  - Root ID matches expected
  - All expected OUs exist under root
  - OU structure matches SecRed landing zone
  - Organization features include ALL (not just billing)
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    AC_L2_3_1_1, AC_L2_3_1_5, AC_2, AC_3, AC_6,
    CM_L2_3_4_1, CM_2, CM_6,
    SOC2_CC6_1, SOC2_CC6_3, SOC2_CC8_1,
    ISO_A5_23, ISO_A8_9,
    IL_SRG_APP_000231,
    E_3_1_1e,
)


@register
class Step01Organizations(StageValidator):
    stage_id = "step_01_organizations"
    title = "1) Landing Zone — Organizations & OUs"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        org_client = self._client("organizations")
        if org_client is None:
            results.append(self._skip(
                "org_client", "Cannot create Organizations client"))
            return results

        # 1-1  Organization exists
        try:
            resp = org_client.describe_organization()
            org = resp.get("Organization", {})
        except Exception as exc:
            err_str = str(exc)
            if "AWSOrganizationsNotInUseException" in err_str:
                results.append(self._fail(
                    "org_exists",
                    "AWS Organizations is not enabled",
                    "Enable Organizations in the GovCloud console",
                    controls=[AC_2, CM_2, SOC2_CC6_1],
                ))
            else:
                results.append(self._fail(
                    "org_exists", "Failed to describe organization",
                    err_str, controls=[AC_2, CM_2],
                ))
            return results

        org_id = org.get("Id", "")
        feature_set = org.get("FeatureSet", "")

        results.append(self._pass(
            "org_exists",
            f"Organization found: {org_id}",
            controls=[AC_2, CM_2, SOC2_CC6_1, ISO_A5_23],
        ))

        # 1-2  Feature set should be ALL (not CONSOLIDATED_BILLING)
        if feature_set == "ALL":
            results.append(self._pass(
                "org_feature_set",
                "Organization feature set is ALL (SCPs, delegated admin supported)",
                controls=[AC_L2_3_1_5, AC_6, CM_6],
            ))
        else:
            results.append(self._warn(
                "org_feature_set",
                f"Feature set is '{feature_set}' — expected ALL for SCP support",
                controls=[AC_L2_3_1_5, AC_6, CM_6],
            ))

        # 1-3  Org ID drift check
        expected_org_id = self._env("GOVCLOUD_EXPECTED_ORG_ID")
        if expected_org_id:
            if org_id == expected_org_id:
                results.append(self._pass(
                    "org_id_match",
                    f"Org ID matches expected ({expected_org_id})",
                    controls=[CM_L2_3_4_1, CM_2],
                ))
            else:
                results.append(self._fail(
                    "org_id_match",
                    f"Org ID {org_id} != expected {expected_org_id}",
                    controls=[CM_L2_3_4_1, CM_2],
                ))
        else:
            results.append(self._skip(
                "org_id_match",
                "GOVCLOUD_EXPECTED_ORG_ID not set",
                controls=[CM_L2_3_4_1],
            ))

        # 1-4  Root ID
        try:
            roots_resp = org_client.list_roots()
            roots = roots_resp.get("Roots", [])
        except Exception as exc:
            results.append(self._fail(
                "org_root", "Failed to list roots", str(exc)))
            return results

        if not roots:
            results.append(self._fail(
                "org_root", "No organization root found",
                controls=[CM_2, AC_2],
            ))
            return results

        root_id = roots[0].get("Id", "")
        results.append(self._pass(
            "org_root", f"Organization root: {root_id}",
            controls=[CM_2, AC_2],
        ))

        expected_root_id = self._env("GOVCLOUD_EXPECTED_ROOT_ID")
        if expected_root_id:
            if root_id == expected_root_id:
                results.append(self._pass(
                    "root_id_match",
                    f"Root ID matches expected ({expected_root_id})",
                    controls=[CM_L2_3_4_1, CM_2],
                ))
            else:
                results.append(self._fail(
                    "root_id_match",
                    f"Root ID {root_id} != expected {expected_root_id}",
                    controls=[CM_L2_3_4_1, CM_2],
                ))
        else:
            results.append(self._skip(
                "root_id_match",
                "GOVCLOUD_EXPECTED_ROOT_ID not set",
                controls=[CM_L2_3_4_1],
            ))

        # 1-5  OU structure check
        results.extend(self._check_ous(org_client, root_id))

        return results

    def _check_ous(self, client, root_id: str) -> list[CheckResult]:
        results: list[CheckResult] = []

        expected_ous = self._env_list("GOVCLOUD_EXPECTED_OU_IDS")
        if not expected_ous:
            results.append(self._skip(
                "ou_structure",
                "GOVCLOUD_EXPECTED_OU_IDS not set",
                "Set comma-separated OU ids for landing zone drift check",
                controls=[CM_L2_3_4_1, AC_L2_3_1_1],
            ))
            return results

        # Recursively collect all OUs under root
        all_ous = set()
        self._collect_ous(client, root_id, all_ous)

        missing = []
        found = []
        for ou_id in expected_ous:
            if ou_id in all_ous:
                found.append(ou_id)
            else:
                missing.append(ou_id)

        if missing:
            results.append(self._fail(
                "ou_structure",
                f"Missing OUs: {', '.join(missing)}",
                f"Found OUs: {', '.join(found)}",
                controls=[CM_L2_3_4_1, CM_2, AC_L2_3_1_1, E_3_1_1e,
                          SOC2_CC6_3, ISO_A5_23, IL_SRG_APP_000231],
            ))
        else:
            results.append(self._pass(
                "ou_structure",
                f"All {len(expected_ous)} expected OUs found under root",
                f"OUs: {', '.join(found)}",
                controls=[CM_L2_3_4_1, CM_2, AC_L2_3_1_1, E_3_1_1e,
                          SOC2_CC6_3, ISO_A5_23, IL_SRG_APP_000231],
            ))

        return results

    def _collect_ous(self, client, parent_id: str, result_set: set):
        """Recursively list all OU ids under parent_id."""
        try:
            paginator = client.get_paginator(
                "list_organizational_units_for_parent")
            for page in paginator.paginate(ParentId=parent_id):
                for ou in page.get("OrganizationalUnits", []):
                    ou_id = ou["Id"]
                    result_set.add(ou_id)
                    self._collect_ous(client, ou_id, result_set)
        except Exception:
            pass
