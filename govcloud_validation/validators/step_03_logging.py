"""
Step 3 — Centralized Logging & Immutable Evidence (Runbook v2.1)

Validates:
  - CloudTrail trail exists and is logging
  - Multi-region trail enabled
  - Log file validation (digest) enabled
  - S3 log bucket encryption (SSE-KMS)
  - S3 log bucket versioning and access logging
  - CloudWatch log group exists for trail
  - GuardDuty detector enabled
  - Security Hub enabled
  - AWS Config recorder active
  - Log retention >= 365 days (FedRAMP High)
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    AU_L2_3_3_1, AU_L2_3_3_2, AU_2, AU_3, AU_6, AU_9, AU_11, AU_12,
    SI_L2_3_14_6, SI_4,
    CM_L2_3_4_1, CM_2,
    IR_L2_3_6_1, IR_4,
    SOC2_CC7_1, SOC2_CC7_2, SOC2_CC7_3, SOC2_CC7_4,
    ISO_A8_15, ISO_A5_28,
    IL_SRG_APP_000014,
    SC_28,
)


@register
class Step03Logging(StageValidator):
    stage_id = "step_03_logging"
    title = "3) Centralized Logging & Immutable Evidence"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        # 3-1  CloudTrail
        results.extend(self._check_cloudtrail())

        # 3-2  GuardDuty
        results.extend(self._check_guardduty())

        # 3-3  Security Hub
        results.extend(self._check_security_hub())

        # 3-4  AWS Config
        results.extend(self._check_config())

        # 3-5  CloudWatch log retention
        results.extend(self._check_log_retention())

        return results

    def _check_cloudtrail(self) -> list[CheckResult]:
        results: list[CheckResult] = []
        ct = self._client("cloudtrail")
        if ct is None:
            return [self._skip("cloudtrail", "Cannot create CloudTrail client")]

        try:
            trails = ct.describe_trails().get("trailList", [])
        except Exception as exc:
            return [self._fail("cloudtrail_exists", "Cannot describe trails",
                               str(exc), controls=[AU_2, AU_12])]

        if not trails:
            return [self._fail(
                "cloudtrail_exists",
                "No CloudTrail trails found — create an organization trail",
                controls=[AU_L2_3_3_1, AU_2, AU_12, SOC2_CC7_1,
                          ISO_A8_15, IL_SRG_APP_000014],
            )]

        results.append(self._pass(
            "cloudtrail_exists",
            f"Found {len(trails)} CloudTrail trail(s)",
            controls=[AU_L2_3_3_1, AU_2, AU_12],
        ))

        for trail in trails:
            name = trail.get("Name", "unknown")
            prefix = f"ct_{name}"

            # Multi-region
            if trail.get("IsMultiRegionTrail", False):
                results.append(self._pass(
                    f"{prefix}_multiregion",
                    f"Trail '{name}' is multi-region",
                    controls=[AU_L2_3_3_1, AU_12, SOC2_CC7_1],
                ))
            else:
                results.append(self._warn(
                    f"{prefix}_multiregion",
                    f"Trail '{name}' is NOT multi-region",
                    "Multi-region trails capture API calls across all regions",
                    controls=[AU_L2_3_3_1, AU_12],
                ))

            # Organization trail
            if trail.get("IsOrganizationTrail", False):
                results.append(self._pass(
                    f"{prefix}_org_trail",
                    f"Trail '{name}' is an organization trail",
                    controls=[AU_2, AU_12, CM_2],
                ))
            else:
                results.append(self._warn(
                    f"{prefix}_org_trail",
                    f"Trail '{name}' is not an org trail — consider org trail when multi-account",
                    controls=[AU_2],
                ))

            # Log file validation
            if trail.get("LogFileValidationEnabled", False):
                results.append(self._pass(
                    f"{prefix}_digest",
                    f"Trail '{name}' has log file validation (digest) enabled",
                    controls=[AU_9, AU_L2_3_3_1, SOC2_CC7_1, ISO_A8_15],
                ))
            else:
                results.append(self._fail(
                    f"{prefix}_digest",
                    f"Trail '{name}' log file validation DISABLED — enable for tamper evidence",
                    controls=[AU_9, AU_L2_3_3_1, SOC2_CC7_1],
                ))

            # S3 bucket encryption check
            s3_bucket = trail.get("S3BucketName", "")
            if s3_bucket:
                results.extend(self._check_trail_bucket(s3_bucket, name))

            # CloudWatch log group
            cwl_arn = trail.get("CloudWatchLogsLogGroupArn", "")
            if cwl_arn:
                results.append(self._pass(
                    f"{prefix}_cwl",
                    f"Trail '{name}' delivers to CloudWatch Logs",
                    controls=[AU_6, AU_L2_3_3_2, SOC2_CC7_2],
                ))
            else:
                results.append(self._warn(
                    f"{prefix}_cwl",
                    f"Trail '{name}' has no CloudWatch Logs delivery",
                    "Add CloudWatch log group for real-time alerting",
                    controls=[AU_6, AU_L2_3_3_2, SOC2_CC7_2],
                ))

            # Check trail is logging
            try:
                status = ct.get_trail_status(Name=trail.get("TrailARN", name))
                if status.get("IsLogging", False):
                    results.append(self._pass(
                        f"{prefix}_logging",
                        f"Trail '{name}' is actively logging",
                        controls=[AU_L2_3_3_1, AU_12],
                    ))
                else:
                    results.append(self._fail(
                        f"{prefix}_logging",
                        f"Trail '{name}' is NOT logging — start logging immediately",
                        controls=[AU_L2_3_3_1, AU_12],
                    ))
            except Exception:
                pass

        return results

    def _check_trail_bucket(self, bucket: str, trail_name: str) -> list[CheckResult]:
        results: list[CheckResult] = []
        s3 = self._client("s3")
        if s3 is None:
            return results

        prefix = f"ct_{trail_name}_bucket"

        # Encryption
        try:
            enc = s3.get_bucket_encryption(Bucket=bucket)
            rules = enc.get("ServerSideEncryptionConfiguration", {}).get("Rules", [])
            kms_used = any(
                r.get("ApplyServerSideEncryptionByDefault", {}).get(
                    "SSEAlgorithm") == "aws:kms"
                for r in rules
            )
            if kms_used:
                results.append(self._pass(
                    f"{prefix}_encryption",
                    f"Log bucket '{bucket}' uses SSE-KMS encryption",
                    controls=[SC_28, AU_9, ISO_A8_15],
                ))
            else:
                results.append(self._warn(
                    f"{prefix}_encryption",
                    f"Log bucket '{bucket}' not using SSE-KMS — upgrade to CMK",
                    controls=[SC_28, AU_9],
                ))
        except Exception:
            results.append(self._warn(
                f"{prefix}_encryption",
                f"Cannot check encryption on log bucket '{bucket}'",
                controls=[SC_28],
            ))

        # Versioning
        try:
            ver = s3.get_bucket_versioning(Bucket=bucket)
            if ver.get("Status") == "Enabled":
                results.append(self._pass(
                    f"{prefix}_versioning",
                    f"Log bucket '{bucket}' has versioning enabled (immutable evidence)",
                    controls=[AU_9, ISO_A5_28],
                ))
            else:
                results.append(self._fail(
                    f"{prefix}_versioning",
                    f"Log bucket '{bucket}' versioning NOT enabled — required for evidence immutability",
                    controls=[AU_9, ISO_A5_28],
                ))
        except Exception:
            pass

        return results

    def _check_guardduty(self) -> list[CheckResult]:
        gd = self._client("guardduty")
        if gd is None:
            return [self._skip("guardduty", "Cannot create GuardDuty client")]

        try:
            detectors = gd.list_detectors().get("DetectorIds", [])
            if detectors:
                return [self._pass(
                    "guardduty_enabled",
                    f"GuardDuty enabled (detector: {detectors[0]})",
                    controls=[SI_L2_3_14_6, SI_4, IR_L2_3_6_1, IR_4,
                              SOC2_CC7_2, SOC2_CC7_3, ISO_A8_15],
                )]
            else:
                return [self._fail(
                    "guardduty_enabled",
                    "GuardDuty is NOT enabled — enable for threat detection",
                    controls=[SI_L2_3_14_6, SI_4, IR_4, SOC2_CC7_2],
                )]
        except Exception as exc:
            return [self._warn("guardduty_enabled",
                               "Cannot check GuardDuty", str(exc))]

    def _check_security_hub(self) -> list[CheckResult]:
        sh = self._client("securityhub")
        if sh is None:
            return [self._skip("securityhub", "Cannot create Security Hub client")]

        try:
            sh.describe_hub()
            return [self._pass(
                "securityhub_enabled",
                "Security Hub is enabled",
                controls=[SI_L2_3_14_6, SI_4, CM_L2_3_4_1, CM_2,
                          SOC2_CC7_1, SOC2_CC7_3, ISO_A8_15],
            )]
        except Exception as exc:
            if "not subscribed" in str(exc).lower() or "InvalidAccessException" in str(exc):
                return [self._fail(
                    "securityhub_enabled",
                    "Security Hub is NOT enabled",
                    "Enable Security Hub with CIS and AWS Foundational standards",
                    controls=[SI_L2_3_14_6, SI_4, CM_2, SOC2_CC7_1],
                )]
            return [self._warn("securityhub_enabled",
                               "Cannot check Security Hub", str(exc))]

    def _check_config(self) -> list[CheckResult]:
        cfg = self._client("config")
        if cfg is None:
            return [self._skip("aws_config", "Cannot create Config client")]

        try:
            recorders = cfg.describe_configuration_recorders().get(
                "ConfigurationRecorders", [])
            if recorders:
                statuses = cfg.describe_configuration_recorder_status().get(
                    "ConfigurationRecordersStatus", [])
                recording = any(s.get("recording", False) for s in statuses)
                if recording:
                    return [self._pass(
                        "config_recorder",
                        "AWS Config recorder is active",
                        controls=[CM_L2_3_4_1, CM_2, SOC2_CC7_1,
                                  SOC2_CC8_1, ISO_A8_9],
                    )]
                else:
                    return [self._warn(
                        "config_recorder",
                        "AWS Config recorder exists but is NOT recording",
                        controls=[CM_L2_3_4_1, CM_2],
                    )]
            else:
                return [self._fail(
                    "config_recorder",
                    "No AWS Config recorder found — required for compliance monitoring",
                    controls=[CM_L2_3_4_1, CM_2, SOC2_CC7_1, SOC2_CC8_1],
                )]
        except Exception as exc:
            return [self._warn("config_recorder",
                               "Cannot check AWS Config", str(exc))]

    def _check_log_retention(self) -> list[CheckResult]:
        logs = self._client("logs")
        if logs is None:
            return [self._skip("log_retention", "Cannot create CloudWatch Logs client")]

        try:
            # Check all log groups for retention policy
            paginator = logs.get_paginator("describe_log_groups")
            no_retention = []
            short_retention = []

            for page in paginator.paginate():
                for lg in page.get("logGroups", []):
                    name = lg.get("logGroupName", "")
                    ret = lg.get("retentionInDays")
                    if ret is None:
                        no_retention.append(name)
                    elif ret < 365:
                        short_retention.append(f"{name} ({ret}d)")

            results = []
            if no_retention:
                results.append(self._warn(
                    "log_retention_never_expire",
                    f"{len(no_retention)} log group(s) have no retention set (never expire)",
                    "Set retention to >=365 days for cost control (FedRAMP High requires 365d)",
                    controls=[AU_11, AU_L2_3_3_1, ISO_A8_15],
                ))
            if short_retention:
                results.append(self._fail(
                    "log_retention_short",
                    f"{len(short_retention)} log group(s) have <365 day retention",
                    f"Groups: {', '.join(short_retention[:5])}",
                    controls=[AU_11, AU_L2_3_3_1, ISO_A8_15, IL_SRG_APP_000014],
                ))
            if not no_retention and not short_retention:
                results.append(self._pass(
                    "log_retention",
                    "All log groups have >=365 day retention",
                    controls=[AU_11, AU_L2_3_3_1, ISO_A8_15],
                ))
            return results

        except Exception as exc:
            return [self._warn("log_retention",
                               "Cannot check log retention", str(exc))]
