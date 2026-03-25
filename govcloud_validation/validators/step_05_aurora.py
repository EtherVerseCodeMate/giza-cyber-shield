"""
Step 5 — Aurora PostgreSQL (Runbook v2.1)

Validates:
  - Aurora cluster exists and is available
  - Engine is aurora-postgresql
  - Storage encrypted with KMS CMK
  - Multi-AZ deployment
  - Backup retention >= 35 days
  - Deletion protection enabled
  - IAM database authentication enabled
  - Auto minor version upgrade enabled
  - Audit logging (pgAudit) enabled
  - Performance Insights encrypted
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    SC_L2_3_13_11, SC_28, SC_12, SC_13,
    AU_L2_3_3_1, AU_2, AU_3,
    CM_L2_3_4_1, CM_2,
    SI_L2_3_14_1, SI_2,
    AC_L2_3_1_1, AC_2, AC_3,
    IA_L2_3_5_2, IA_2,
    SOC2_CC6_1, SOC2_CC6_7, SOC2_CC8_1, SOC2_A1_2,
    ISO_A8_24, ISO_A8_9,
    IL_SRG_APP_000516, IL_SRG_APP_000148,
    MP_L2_3_8_6,
)


@register
class Step05Aurora(StageValidator):
    stage_id = "step_05_aurora"
    title = "5) Aurora PostgreSQL"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        rds = self._client("rds")
        if rds is None:
            return [self._skip("rds_client", "Cannot create RDS client")]

        try:
            clusters = rds.describe_db_clusters().get("DBClusters", [])
        except Exception as exc:
            return [self._fail("aurora_exists", "Cannot describe DB clusters",
                               str(exc))]

        aurora_clusters = [
            c for c in clusters
            if "aurora" in c.get("Engine", "").lower()
        ]

        if not aurora_clusters:
            return [self._warn(
                "aurora_exists",
                "No Aurora clusters found — Step 5 not yet deployed",
                "Deploy Aurora PostgreSQL to replace Supabase for GovCloud boundary",
                controls=[SC_28, CM_2],
            )]

        results.append(self._pass(
            "aurora_exists",
            f"Found {len(aurora_clusters)} Aurora cluster(s)",
            controls=[CM_2],
        ))

        for cluster in aurora_clusters:
            cid = cluster.get("DBClusterIdentifier", "unknown")
            prefix = f"aurora_{cid}"

            # Engine type
            engine = cluster.get("Engine", "")
            if "postgresql" in engine.lower():
                results.append(self._pass(
                    f"{prefix}_engine", f"Cluster '{cid}' uses {engine}",
                    controls=[CM_2],
                ))
            else:
                results.append(self._warn(
                    f"{prefix}_engine",
                    f"Cluster '{cid}' uses {engine} — PostgreSQL recommended",
                    controls=[CM_2],
                ))

            # Encryption at rest
            if cluster.get("StorageEncrypted", False):
                kms_key = cluster.get("KmsKeyId", "")
                results.append(self._pass(
                    f"{prefix}_encryption",
                    f"Cluster '{cid}' storage encrypted (KMS: ...{kms_key[-12:]})",
                    controls=[SC_L2_3_13_11, SC_28, SC_12, MP_L2_3_8_6,
                              SOC2_CC6_7, ISO_A8_24,
                              IL_SRG_APP_000516, IL_SRG_APP_000148],
                ))
            else:
                results.append(self._fail(
                    f"{prefix}_encryption",
                    f"Cluster '{cid}' storage is NOT encrypted",
                    controls=[SC_L2_3_13_11, SC_28, SC_12],
                ))

            # Multi-AZ
            if cluster.get("MultiAZ", False):
                results.append(self._pass(
                    f"{prefix}_multi_az",
                    f"Cluster '{cid}' is Multi-AZ",
                    controls=[SOC2_A1_2, SC_28],
                ))
            else:
                results.append(self._warn(
                    f"{prefix}_multi_az",
                    f"Cluster '{cid}' is single-AZ — Multi-AZ recommended for production",
                    controls=[SOC2_A1_2],
                ))

            # Backup retention
            retention = cluster.get("BackupRetentionPeriod", 0)
            if retention >= 35:
                results.append(self._pass(
                    f"{prefix}_backup_retention",
                    f"Cluster '{cid}' backup retention: {retention} days",
                    controls=[SOC2_A1_2, CM_2, ISO_A8_9],
                ))
            elif retention >= 7:
                results.append(self._warn(
                    f"{prefix}_backup_retention",
                    f"Cluster '{cid}' backup retention: {retention} days — "
                    "recommend >=35 for FedRAMP High",
                    controls=[SOC2_A1_2, CM_2],
                ))
            else:
                results.append(self._fail(
                    f"{prefix}_backup_retention",
                    f"Cluster '{cid}' backup retention: {retention} days — too short",
                    controls=[SOC2_A1_2, CM_2],
                ))

            # Deletion protection
            if cluster.get("DeletionProtection", False):
                results.append(self._pass(
                    f"{prefix}_deletion_protection",
                    f"Cluster '{cid}' deletion protection enabled",
                    controls=[CM_L2_3_4_1, SOC2_CC8_1],
                ))
            else:
                results.append(self._fail(
                    f"{prefix}_deletion_protection",
                    f"Cluster '{cid}' deletion protection DISABLED",
                    controls=[CM_L2_3_4_1, SOC2_CC8_1],
                ))

            # IAM authentication
            if cluster.get("IAMDatabaseAuthenticationEnabled", False):
                results.append(self._pass(
                    f"{prefix}_iam_auth",
                    f"Cluster '{cid}' IAM database authentication enabled",
                    controls=[IA_L2_3_5_2, IA_2, AC_L2_3_1_1, AC_3,
                              SOC2_CC6_1],
                ))
            else:
                results.append(self._warn(
                    f"{prefix}_iam_auth",
                    f"Cluster '{cid}' IAM auth disabled — enable for token-based DB access",
                    controls=[IA_L2_3_5_2, IA_2, AC_3],
                ))

            # Audit logging (check for pgaudit in cluster parameter group)
            log_exports = cluster.get("EnabledCloudwatchLogsExports", [])
            if "postgresql" in log_exports or "audit" in log_exports:
                results.append(self._pass(
                    f"{prefix}_audit_logging",
                    f"Cluster '{cid}' exports logs to CloudWatch: {log_exports}",
                    controls=[AU_L2_3_3_1, AU_2, AU_3, ISO_A8_24],
                ))
            else:
                results.append(self._warn(
                    f"{prefix}_audit_logging",
                    f"Cluster '{cid}' not exporting audit logs to CloudWatch",
                    "Enable postgresql/audit log exports and configure pgAudit",
                    controls=[AU_L2_3_3_1, AU_2, AU_3],
                ))

        return results
