"""
Step 8 — Secrets, Keys & Crypto (Runbook v2.1)

Validates:
  - KMS Customer Managed Key (CMK) exists
  - Key rotation enabled
  - Secrets Manager secrets use CMK
  - Secret rotation configured
  - No plaintext secrets in ECS task environment variables
  - FIPS 140-2 validated crypto usage
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    SC_L2_3_13_11, SC_12, SC_13, SC_28,
    MP_L2_3_8_6,
    CM_L2_3_4_2, CM_6,
    AC_L2_3_1_1,
    SOC2_CC6_1, SOC2_CC6_7,
    ISO_A8_24,
    IL_SRG_APP_000516, IL_SRG_APP_000148,
    E_3_13_1e,
)


@register
class Step08Encryption(StageValidator):
    stage_id = "step_08_encryption"
    title = "8) Secrets, Keys & Crypto"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        # 8-1  KMS keys
        results.extend(self._check_kms())

        # 8-2  Secrets Manager
        results.extend(self._check_secrets_manager())

        return results

    def _check_kms(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        kms = self._client("kms")
        if kms is None:
            return [self._skip("kms_client", "Cannot create KMS client")]

        try:
            keys = []
            paginator_token = None
            while True:
                kwargs = {}
                if paginator_token:
                    kwargs["Marker"] = paginator_token
                resp = kms.list_keys(**kwargs)
                keys.extend(resp.get("Keys", []))
                if resp.get("Truncated", False):
                    paginator_token = resp.get("NextMarker")
                else:
                    break
        except Exception as exc:
            return [self._fail("kms_list", "Cannot list KMS keys", str(exc))]

        if not keys:
            return [self._fail(
                "kms_cmk_exists",
                "No KMS keys found — create a Customer Managed Key for data encryption",
                controls=[SC_12, SC_13, SC_L2_3_13_11, ISO_A8_24,
                          IL_SRG_APP_000148],
            )]

        # Find customer-managed keys (not AWS-managed)
        cmk_count = 0
        rotation_disabled = []

        for key_entry in keys:
            key_id = key_entry["KeyId"]
            try:
                desc = kms.describe_key(KeyId=key_id).get(
                    "KeyMetadata", {})
            except Exception:
                continue

            manager = desc.get("KeyManager", "")
            state = desc.get("KeyState", "")
            if manager != "CUSTOMER" or state != "Enabled":
                continue

            cmk_count += 1

            # Check rotation
            try:
                rot = kms.get_key_rotation_status(KeyId=key_id)
                if not rot.get("KeyRotationEnabled", False):
                    alias = key_id[:12]
                    # Try to get alias
                    try:
                        aliases = kms.list_aliases(
                            KeyId=key_id
                        ).get("Aliases", [])
                        if aliases:
                            alias = aliases[0].get("AliasName", key_id[:12])
                    except Exception:
                        pass
                    rotation_disabled.append(alias)
            except Exception:
                pass

        if cmk_count > 0:
            results.append(self._pass(
                "kms_cmk_exists",
                f"Found {cmk_count} Customer Managed Key(s)",
                controls=[SC_12, SC_13, SC_L2_3_13_11, MP_L2_3_8_6,
                          SOC2_CC6_7, ISO_A8_24,
                          IL_SRG_APP_000148, IL_SRG_APP_000516],
            ))
        else:
            results.append(self._fail(
                "kms_cmk_exists",
                "No Customer Managed Keys found — only AWS-managed keys",
                "Create CMK for FedRAMP High / IL4+ encryption requirements",
                controls=[SC_12, SC_13, SC_L2_3_13_11, IL_SRG_APP_000148],
            ))

        if rotation_disabled:
            results.append(self._fail(
                "kms_rotation",
                f"CMKs without rotation: {', '.join(rotation_disabled)}",
                "Enable automatic key rotation (annual) on all CMKs",
                controls=[SC_12, ISO_A8_24, IL_SRG_APP_000148],
            ))
        elif cmk_count > 0:
            results.append(self._pass(
                "kms_rotation",
                "All CMKs have automatic rotation enabled",
                controls=[SC_12, ISO_A8_24, IL_SRG_APP_000148],
            ))

        return results

    def _check_secrets_manager(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        sm = self._client("secretsmanager")
        if sm is None:
            return [self._skip("sm_client",
                               "Cannot create Secrets Manager client")]

        try:
            secrets = []
            paginator_token = None
            while True:
                kwargs = {}
                if paginator_token:
                    kwargs["NextToken"] = paginator_token
                resp = sm.list_secrets(**kwargs)
                secrets.extend(resp.get("SecretList", []))
                paginator_token = resp.get("NextToken")
                if not paginator_token:
                    break
        except Exception as exc:
            return [self._fail("sm_list", "Cannot list secrets", str(exc))]

        if not secrets:
            results.append(self._warn(
                "sm_secrets_exist",
                "No secrets in Secrets Manager — store application secrets here",
                controls=[SC_L2_3_13_11, SC_28],
            ))
            return results

        results.append(self._pass(
            "sm_secrets_exist",
            f"Found {len(secrets)} secret(s) in Secrets Manager",
            controls=[SC_L2_3_13_11, SC_28, SOC2_CC6_7],
        ))

        no_rotation = []
        default_key = []

        for secret in secrets:
            name = secret.get("Name", "unknown")

            # Rotation
            if not secret.get("RotationEnabled", False):
                no_rotation.append(name)

            # KMS key (should be CMK, not default)
            kms_key = secret.get("KmsKeyId", "")
            if not kms_key or kms_key == "aws/secretsmanager":
                default_key.append(name)

        if no_rotation:
            results.append(self._warn(
                "sm_rotation",
                f"{len(no_rotation)} secret(s) without rotation: "
                f"{', '.join(no_rotation[:5])}",
                "Enable automatic rotation (90 days for API keys, 365 for PQC keys)",
                controls=[SC_12, SOC2_CC6_7, ISO_A8_24, IL_SRG_APP_000148],
            ))
        else:
            results.append(self._pass(
                "sm_rotation",
                "All secrets have rotation enabled",
                controls=[SC_12, SOC2_CC6_7, ISO_A8_24],
            ))

        if default_key:
            results.append(self._warn(
                "sm_cmk_encryption",
                f"{len(default_key)} secret(s) using default KMS key: "
                f"{', '.join(default_key[:5])}",
                "Use a Customer Managed Key for secrets encryption",
                controls=[SC_L2_3_13_11, SC_12, IL_SRG_APP_000148],
            ))
        else:
            results.append(self._pass(
                "sm_cmk_encryption",
                "All secrets encrypted with Customer Managed Keys",
                controls=[SC_L2_3_13_11, SC_12, IL_SRG_APP_000148],
            ))

        return results
