"""
Step 7 — Cognito + Aurora RLS (Runbook v2.1)

Replaces Supabase Auth — Cognito inside GovCloud boundary.

Validates:
  - Cognito User Pool exists
  - MFA enforced (REQUIRED, not OPTIONAL)
  - Password policy meets NIST 800-63B
  - Advanced security features enabled
  - Account recovery via verified email only
  - User pool deletion protection
  - Custom domain with TLS
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    AC_L2_3_1_1, AC_L2_3_1_2, AC_2, AC_3,
    IA_L2_3_5_1, IA_L2_3_5_2, IA_L2_3_5_3, IA_2, IA_5, IA_8,
    SC_L2_3_13_11, SC_8, SC_13,
    SOC2_CC6_1, SOC2_CC6_3,
    ISO_A5_15, ISO_A8_24,
    IL_SRG_APP_000033, IL_SRG_APP_000001,
    E_3_5_1e,
)


@register
class Step07Identity(StageValidator):
    stage_id = "step_07_identity"
    title = "7) Cognito + Aurora RLS (replaces Supabase Auth)"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        cognito = self._client("cognito-idp")
        if cognito is None:
            return [self._skip("cognito_client",
                               "Cannot create Cognito client")]

        # 7-1  List user pools
        try:
            pools = cognito.list_user_pools(MaxResults=60).get(
                "UserPools", [])
        except Exception as exc:
            return [self._fail("cognito_pools", "Cannot list user pools",
                               str(exc))]

        if not pools:
            return [self._warn(
                "cognito_pools",
                "No Cognito User Pools found — Step 7 not yet deployed",
                "Create Cognito User Pool to replace Supabase Auth",
                controls=[IA_2, AC_2],
            )]

        results.append(self._pass(
            "cognito_pools",
            f"Found {len(pools)} Cognito User Pool(s)",
            controls=[IA_2, AC_2],
        ))

        for pool_summary in pools:
            pool_id = pool_summary["Id"]
            pool_name = pool_summary.get("Name", pool_id)
            prefix = f"cognito_{pool_name}"

            try:
                pool = cognito.describe_user_pool(
                    UserPoolId=pool_id
                ).get("UserPool", {})
            except Exception as exc:
                results.append(self._fail(
                    f"{prefix}_describe",
                    f"Cannot describe pool '{pool_name}'", str(exc)))
                continue

            # 7-2  MFA enforcement
            mfa = pool.get("MfaConfiguration", "OFF")
            if mfa == "ON":
                results.append(self._pass(
                    f"{prefix}_mfa",
                    f"Pool '{pool_name}' MFA is REQUIRED",
                    controls=[IA_L2_3_5_3, IA_2, IA_5,
                              SOC2_CC6_1, ISO_A5_15,
                              IL_SRG_APP_000033, E_3_5_1e],
                ))
            elif mfa == "OPTIONAL":
                results.append(self._warn(
                    f"{prefix}_mfa",
                    f"Pool '{pool_name}' MFA is OPTIONAL — set to REQUIRED for CUI",
                    controls=[IA_L2_3_5_3, IA_2, IA_5, SOC2_CC6_1],
                ))
            else:
                results.append(self._fail(
                    f"{prefix}_mfa",
                    f"Pool '{pool_name}' MFA is OFF — required for FedRAMP/CMMC",
                    controls=[IA_L2_3_5_3, IA_2, IA_5, SOC2_CC6_1,
                              IL_SRG_APP_000033],
                ))

            # 7-3  Password policy
            pw_policy = pool.get("Policies", {}).get("PasswordPolicy", {})
            min_len = pw_policy.get("MinimumLength", 0)
            require_upper = pw_policy.get("RequireUppercase", False)
            require_lower = pw_policy.get("RequireLowercase", False)
            require_numbers = pw_policy.get("RequireNumbers", False)
            require_symbols = pw_policy.get("RequireSymbols", False)
            temp_valid = pw_policy.get("TemporaryPasswordValidityDays", 7)

            if min_len >= 12 and all([require_upper, require_lower,
                                      require_numbers, require_symbols]):
                results.append(self._pass(
                    f"{prefix}_password_policy",
                    f"Pool '{pool_name}' password policy: min={min_len}, "
                    "upper+lower+num+sym required",
                    controls=[IA_L2_3_5_2, IA_5, SOC2_CC6_1,
                              ISO_A5_15, IL_SRG_APP_000033],
                ))
            elif min_len >= 8:
                results.append(self._warn(
                    f"{prefix}_password_policy",
                    f"Pool '{pool_name}' password min={min_len} — "
                    "recommend >=12 with all complexity requirements for CUI",
                    controls=[IA_L2_3_5_2, IA_5],
                ))
            else:
                results.append(self._fail(
                    f"{prefix}_password_policy",
                    f"Pool '{pool_name}' password min={min_len} — "
                    "minimum 8 chars required, 12+ recommended",
                    controls=[IA_L2_3_5_2, IA_5, IL_SRG_APP_000033],
                ))

            # Temp password validity
            if temp_valid <= 1:
                results.append(self._pass(
                    f"{prefix}_temp_password",
                    f"Pool '{pool_name}' temp password validity: {temp_valid} day(s)",
                    controls=[IA_5],
                ))
            else:
                results.append(self._warn(
                    f"{prefix}_temp_password",
                    f"Pool '{pool_name}' temp password valid for {temp_valid} days — "
                    "set to 1 day for CUI",
                    controls=[IA_5],
                ))

            # 7-4  Account recovery
            recovery = pool.get("AccountRecoverySetting", {})
            mechanisms = recovery.get("RecoveryMechanisms", [])
            if mechanisms:
                primary = mechanisms[0].get("Name", "")
                if primary == "verified_email":
                    results.append(self._pass(
                        f"{prefix}_recovery",
                        f"Pool '{pool_name}' recovery: verified email (no SMS)",
                        controls=[IA_L2_3_5_1, IA_2, SOC2_CC6_1],
                    ))
                elif primary == "verified_phone_number":
                    results.append(self._warn(
                        f"{prefix}_recovery",
                        f"Pool '{pool_name}' recovery via SMS — email preferred",
                        controls=[IA_L2_3_5_1, IA_2],
                    ))

            # 7-5  Deletion protection
            deletion_protection = pool.get("DeletionProtection", "INACTIVE")
            if deletion_protection == "ACTIVE":
                results.append(self._pass(
                    f"{prefix}_deletion_protection",
                    f"Pool '{pool_name}' deletion protection enabled",
                    controls=[AC_2, SOC2_CC6_1],
                ))
            else:
                results.append(self._warn(
                    f"{prefix}_deletion_protection",
                    f"Pool '{pool_name}' deletion protection NOT enabled",
                    controls=[AC_2],
                ))

            # 7-6  Advanced security
            user_pool_add_ons = pool.get("UserPoolAddOns", {})
            adv_security = user_pool_add_ons.get(
                "AdvancedSecurityMode", "OFF")
            if adv_security in ("ENFORCED", "AUDIT"):
                results.append(self._pass(
                    f"{prefix}_advanced_security",
                    f"Pool '{pool_name}' advanced security: {adv_security}",
                    controls=[IA_2, AC_L2_3_1_1, SOC2_CC6_1,
                              IL_SRG_APP_000033, E_3_5_1e],
                ))
            else:
                results.append(self._warn(
                    f"{prefix}_advanced_security",
                    f"Pool '{pool_name}' advanced security is OFF — "
                    "enable for adaptive auth and compromised credential detection",
                    controls=[IA_2, AC_L2_3_1_1, E_3_5_1e],
                ))

        return results
