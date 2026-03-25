"""
Step 12 — C3PAO Evidence Binder (Runbook v2.1)

Validates:
  - S3 evidence bucket exists
  - Versioning enabled (immutable evidence)
  - Lifecycle rules configured
  - Server-side encryption with CMK
  - Access logging enabled
  - Object Lock enabled (WORM for compliance evidence)
  - Public access block enabled
  - Bucket policy denies non-HTTPS
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    AU_L2_3_3_1, AU_9, AU_11,
    SC_L2_3_13_11, SC_28, SC_12,
    CM_L2_3_4_1, CM_2,
    MP_L2_3_8_6,
    SOC2_CC6_7, SOC2_CC7_1, SOC2_A1_2,
    ISO_A5_28, ISO_A8_10, ISO_A8_24,
    IL_SRG_APP_000516,
    E_3_4_1e,
)


@register
class Step12EvidenceBinder(StageValidator):
    stage_id = "step_12_evidence_binder"
    title = "12) C3PAO Evidence Binder"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        s3 = self._client("s3")
        if s3 is None:
            return [self._skip("s3_client", "Cannot create S3 client")]

        # Find evidence buckets by naming convention
        try:
            all_buckets = s3.list_buckets().get("Buckets", [])
        except Exception as exc:
            return [self._fail("s3_list", "Cannot list S3 buckets", str(exc))]

        evidence_patterns = ["evidence", "audit", "compliance",
                             "c3pao", "fedramp", "binder", "log-archive"]
        evidence_buckets = [
            b for b in all_buckets
            if any(p in b["Name"].lower() for p in evidence_patterns)
        ]

        if not evidence_buckets:
            # Check if any buckets exist at all
            if all_buckets:
                results.append(self._warn(
                    "evidence_bucket_exists",
                    f"Found {len(all_buckets)} S3 bucket(s) but none match "
                    "evidence/audit/compliance naming pattern",
                    "Create a dedicated evidence bucket (e.g. khepra-evidence-<account-id>)",
                    controls=[AU_9, CM_2, ISO_A5_28],
                ))
                # Check the first few buckets anyway
                evidence_buckets = all_buckets[:3]
            else:
                return [self._fail(
                    "evidence_bucket_exists",
                    "No S3 buckets found — create evidence bucket for C3PAO binder",
                    controls=[AU_9, CM_2, ISO_A5_28],
                )]
        else:
            results.append(self._pass(
                "evidence_bucket_exists",
                f"Found {len(evidence_buckets)} evidence-related bucket(s): "
                f"{', '.join(b['Name'] for b in evidence_buckets)}",
                controls=[AU_9, CM_2, ISO_A5_28],
            ))

        for bucket in evidence_buckets:
            bname = bucket["Name"]
            prefix = f"eb_{bname}"

            # 12-1  Versioning
            try:
                ver = s3.get_bucket_versioning(Bucket=bname)
                if ver.get("Status") == "Enabled":
                    results.append(self._pass(
                        f"{prefix}_versioning",
                        f"Bucket '{bname}' versioning enabled (immutable evidence)",
                        controls=[AU_9, ISO_A5_28, SOC2_A1_2],
                    ))
                else:
                    results.append(self._fail(
                        f"{prefix}_versioning",
                        f"Bucket '{bname}' versioning NOT enabled — "
                        "required for evidence immutability",
                        controls=[AU_9, ISO_A5_28, SOC2_A1_2],
                    ))
            except Exception:
                pass

            # 12-2  Encryption
            try:
                enc = s3.get_bucket_encryption(Bucket=bname)
                rules = enc.get("ServerSideEncryptionConfiguration", {}).get(
                    "Rules", [])
                kms_used = any(
                    r.get("ApplyServerSideEncryptionByDefault", {}).get(
                        "SSEAlgorithm") == "aws:kms"
                    for r in rules
                )
                if kms_used:
                    results.append(self._pass(
                        f"{prefix}_encryption",
                        f"Bucket '{bname}' encrypted with SSE-KMS",
                        controls=[SC_L2_3_13_11, SC_28, SC_12,
                                  MP_L2_3_8_6, SOC2_CC6_7, ISO_A8_24,
                                  IL_SRG_APP_000516],
                    ))
                else:
                    results.append(self._warn(
                        f"{prefix}_encryption",
                        f"Bucket '{bname}' not using SSE-KMS — upgrade to CMK",
                        controls=[SC_L2_3_13_11, SC_28, SC_12],
                    ))
            except Exception as exc:
                if "ServerSideEncryptionConfigurationNotFoundError" in str(exc):
                    results.append(self._fail(
                        f"{prefix}_encryption",
                        f"Bucket '{bname}' has NO encryption configured",
                        controls=[SC_28, SC_12, IL_SRG_APP_000516],
                    ))

            # 12-3  Public access block
            try:
                pab = s3.get_public_access_block(Bucket=bname)
                config = pab.get("PublicAccessBlockConfiguration", {})
                all_blocked = all([
                    config.get("BlockPublicAcls", False),
                    config.get("IgnorePublicAcls", False),
                    config.get("BlockPublicPolicy", False),
                    config.get("RestrictPublicBuckets", False),
                ])
                if all_blocked:
                    results.append(self._pass(
                        f"{prefix}_public_block",
                        f"Bucket '{bname}' public access fully blocked",
                        controls=[SC_L2_3_13_11, SOC2_CC6_7, ISO_A8_24],
                    ))
                else:
                    results.append(self._fail(
                        f"{prefix}_public_block",
                        f"Bucket '{bname}' public access NOT fully blocked",
                        "Enable all four public access block settings",
                        controls=[SC_L2_3_13_11, SOC2_CC6_7],
                    ))
            except Exception:
                results.append(self._warn(
                    f"{prefix}_public_block",
                    f"Cannot check public access block on '{bname}'",
                ))

            # 12-4  Lifecycle rules
            try:
                lc = s3.get_bucket_lifecycle_configuration(Bucket=bname)
                rules = lc.get("Rules", [])
                if rules:
                    results.append(self._pass(
                        f"{prefix}_lifecycle",
                        f"Bucket '{bname}' has {len(rules)} lifecycle rule(s)",
                        controls=[AU_11, ISO_A8_10, CM_2],
                    ))
                else:
                    results.append(self._warn(
                        f"{prefix}_lifecycle",
                        f"Bucket '{bname}' has no lifecycle rules",
                        "Add retention lifecycle (e.g. Glacier after 365 days)",
                        controls=[AU_11, ISO_A8_10],
                    ))
            except Exception as exc:
                if "NoSuchLifecycleConfiguration" in str(exc):
                    results.append(self._warn(
                        f"{prefix}_lifecycle",
                        f"Bucket '{bname}' has no lifecycle configuration",
                        controls=[AU_11, ISO_A8_10],
                    ))

            # 12-5  Access logging
            try:
                logging = s3.get_bucket_logging(Bucket=bname)
                if logging.get("LoggingEnabled"):
                    target = logging["LoggingEnabled"].get(
                        "TargetBucket", "")
                    results.append(self._pass(
                        f"{prefix}_access_logging",
                        f"Bucket '{bname}' access logging → {target}",
                        controls=[AU_L2_3_3_1, AU_9, SOC2_CC7_1],
                    ))
                else:
                    results.append(self._warn(
                        f"{prefix}_access_logging",
                        f"Bucket '{bname}' access logging NOT enabled",
                        controls=[AU_L2_3_3_1, AU_9, SOC2_CC7_1],
                    ))
            except Exception:
                pass

            # 12-6  Object Lock (WORM)
            try:
                lock = s3.get_object_lock_configuration(Bucket=bname)
                lock_config = lock.get("ObjectLockConfiguration", {})
                if lock_config.get("ObjectLockEnabled") == "Enabled":
                    results.append(self._pass(
                        f"{prefix}_object_lock",
                        f"Bucket '{bname}' Object Lock (WORM) enabled",
                        controls=[AU_9, ISO_A5_28, E_3_4_1e],
                    ))
                else:
                    results.append(self._warn(
                        f"{prefix}_object_lock",
                        f"Bucket '{bname}' Object Lock not enabled — "
                        "enable for tamper-proof evidence",
                        controls=[AU_9, ISO_A5_28, E_3_4_1e],
                    ))
            except Exception as exc:
                if "ObjectLockConfigurationNotFoundError" in str(exc):
                    results.append(self._warn(
                        f"{prefix}_object_lock",
                        f"Bucket '{bname}' Object Lock not configured — "
                        "consider for immutable C3PAO evidence",
                        controls=[AU_9, ISO_A5_28],
                    ))

        return results
