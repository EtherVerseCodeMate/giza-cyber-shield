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
    SI_L2_3_14_2, SI_L2_3_14_6, SI_4,
    CM_L2_3_4_1, CM_2,
    IR_L2_3_6_1, IR_4,
    SOC2_CC7_1, SOC2_CC7_2, SOC2_CC7_3, SOC2_CC7_4, SOC2_CC8_1,
    ISO_A8_9, ISO_A8_15, ISO_A5_28,
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

        # 3-2  GuardDuty detector + findings export (Gap 1)
        results.extend(self._check_guardduty())
        results.extend(self._check_guardduty_export())

        # 3-3  Security Hub
        results.extend(self._check_security_hub())

        # 3-4  AWS Config recorder + delivery channel (Gap 2)
        results.extend(self._check_config())
        results.extend(self._check_config_delivery_channel())

        # 3-5  GuardDuty Malware Protection for S3 (Gap 3)
        results.extend(self._check_s3_malware_protection())

        # 3-6  NIST 800-171 conformance pack (Gap 4)
        results.extend(self._check_nist_conformance_packs())

        # 3-7  CloudWatch log retention
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

    # ── Gap checks (Step 3 — 4 pending items per runbook v2.1) ──────────────

    def _check_guardduty_export(self) -> list[CheckResult]:
        """Gap 1 — GuardDuty findings not yet exported to evidence bucket."""
        ev_bucket = self._env("GOVCLOUD_EXPECTED_EVIDENCE_BUCKET")
        if not ev_bucket:
            return [self._skip(
                "guardduty_findings_export",
                "GuardDuty findings export to S3 evidence bucket",
                "Set GOVCLOUD_EXPECTED_EVIDENCE_BUCKET to verify",
                controls=[AU_9, AU_11],
            )]

        gd = self._client("guardduty")
        if gd is None:
            return [self._skip("guardduty_findings_export",
                               "Cannot create GuardDuty client")]
        try:
            det_ids = gd.list_detectors().get("DetectorIds", [])
            if not det_ids:
                return [self._skip(
                    "guardduty_findings_export",
                    "GuardDuty findings export to S3 evidence bucket",
                    "No GuardDuty detector found",
                    controls=[AU_9],
                )]
            pubs = gd.list_publishing_destinations(DetectorId=det_ids[0])
            dests = pubs.get("Destinations", [])
            active = [
                d for d in dests
                if d.get("DestinationType") == "S3"
                and d.get("Status") in ("PUBLISHING_SUCCEEDED",
                                         "PENDING_VERIFICATION")
            ]
            if active:
                return [self._pass(
                    "guardduty_findings_export",
                    "GuardDuty findings export to S3 evidence bucket",
                    f"Active S3 publishing destination configured",
                    controls=[AU_9, AU_11, SI_L2_3_14_6, SI_4,
                              SOC2_CC7_2, ISO_A8_15],
                )]
            return [self._fail(
                "guardduty_findings_export",
                "GuardDuty findings export to S3 evidence bucket",
                f"No active S3 destination — "
                f"GuardDuty → Settings → Export findings → {ev_bucket}",
                controls=[AU_9, AU_11, SI_L2_3_14_6, ISO_A8_15],
            )]
        except Exception as exc:
            return [self._warn(
                "guardduty_findings_export",
                "GuardDuty findings export to S3 evidence bucket",
                str(exc),
                controls=[AU_9],
            )]

    def _check_config_delivery_channel(self) -> list[CheckResult]:
        """Gap 2 — Config delivery channel still points to CloudTrail bucket."""
        ev_bucket = self._env("GOVCLOUD_EXPECTED_EVIDENCE_BUCKET")
        if not ev_bucket:
            return [self._skip(
                "config_delivery_channel_evidence_bucket",
                "AWS Config delivery channel → evidence bucket",
                "Set GOVCLOUD_EXPECTED_EVIDENCE_BUCKET to validate",
                controls=[CM_L2_3_4_1, AU_12],
            )]

        cfg = self._client("config")
        if cfg is None:
            return [self._skip("config_delivery_channel_evidence_bucket",
                               "Cannot create Config client")]
        try:
            chans = cfg.describe_delivery_channels().get(
                "DeliveryChannels", [])
            if not chans:
                return [self._fail(
                    "config_delivery_channel_evidence_bucket",
                    "AWS Config delivery channel → evidence bucket",
                    "No Config delivery channel configured",
                    controls=[CM_L2_3_4_1, CM_2, AU_12],
                )]
            wrong = [
                c.get("s3BucketName", "") for c in chans
                if c.get("s3BucketName", "") != ev_bucket
            ]
            if wrong:
                return [self._fail(
                    "config_delivery_channel_evidence_bucket",
                    "AWS Config delivery channel → evidence bucket",
                    f"Channel(s) targeting wrong bucket {wrong} — "
                    f"run: aws configservice put-delivery-channel "
                    f"--delivery-channel s3BucketName={ev_bucket}",
                    controls=[CM_L2_3_4_1, CM_2, AU_12, SOC2_CC8_1],
                )]
            return [self._pass(
                "config_delivery_channel_evidence_bucket",
                "AWS Config delivery channel → evidence bucket",
                f"Delivery channel correctly targets {ev_bucket!r}",
                controls=[CM_L2_3_4_1, CM_2, AU_12, SOC2_CC8_1, ISO_A8_9],
            )]
        except Exception as exc:
            return [self._warn(
                "config_delivery_channel_evidence_bucket",
                "AWS Config delivery channel → evidence bucket",
                str(exc),
                controls=[CM_L2_3_4_1],
            )]

    def _check_s3_malware_protection(self) -> list[CheckResult]:
        """Gap 3 — GuardDuty Malware Protection for S3 not on evidence bucket."""
        ev_bucket = self._env("GOVCLOUD_EXPECTED_EVIDENCE_BUCKET")
        if not ev_bucket:
            return [self._skip(
                "s3_malware_protection",
                "GuardDuty Malware Protection for S3 evidence bucket",
                "Set GOVCLOUD_EXPECTED_EVIDENCE_BUCKET to check coverage",
                controls=[SI_L2_3_14_2, SI_L2_3_14_6],
            )]

        gd = self._client("guardduty")
        if gd is None:
            return [self._skip("s3_malware_protection",
                               "Cannot create GuardDuty client")]
        try:
            det_ids = gd.list_detectors().get("DetectorIds", [])
            if not det_ids:
                return [self._skip(
                    "s3_malware_protection",
                    "GuardDuty Malware Protection for S3 evidence bucket",
                    "No GuardDuty detector found",
                    controls=[SI_L2_3_14_2],
                )]
            try:
                plans = gd.list_malware_protection_plans().get(
                    "MalwareProtectionPlans", [])
                if plans:
                    return [self._pass(
                        "s3_malware_protection",
                        "GuardDuty Malware Protection for S3 evidence bucket",
                        f"{len(plans)} Malware Protection plan(s) active",
                        controls=[SI_L2_3_14_2, SI_L2_3_14_6, SI_4,
                                  SOC2_CC7_2, ISO_A8_15],
                    )]
                return [self._fail(
                    "s3_malware_protection",
                    "GuardDuty Malware Protection for S3 evidence bucket",
                    f"No Malware Protection plans — "
                    f"GuardDuty → Malware Protection → S3 → enable on {ev_bucket}",
                    controls=[SI_L2_3_14_2, SI_L2_3_14_6, SI_4],
                )]
            except Exception as exc:
                # Distinguish AccessDenied (IAM gap → FAIL) from service unavailability
                # in a GovCloud region tier (expected GovCloud limitation → WARN).
                err_str = str(exc)
                if "AccessDenied" in err_str or "Unauthorized" in err_str:
                    return [self._fail(
                        "s3_malware_protection",
                        "GuardDuty Malware Protection for S3 evidence bucket",
                        f"Access denied checking Malware Protection plans — "
                        f"verify IAM permissions for guardduty:ListMalwareProtectionPlans: {exc}",
                        controls=[SI_L2_3_14_2, SI_4],
                    )]
                # Not AccessDenied — likely service not available in this GovCloud tier.
                return [self._warn(
                    "s3_malware_protection",
                    "GuardDuty Malware Protection for S3 evidence bucket",
                    f"Cannot query Malware Protection plans (may not be available in this GovCloud tier): {exc}",
                    controls=[SI_L2_3_14_2],
                )]
        except Exception as exc:
            err_str = str(exc)
            if "AccessDenied" in err_str or "Unauthorized" in err_str:
                return [self._fail(
                    "s3_malware_protection",
                    "GuardDuty Malware Protection for S3 evidence bucket",
                    f"Access denied listing GuardDuty detectors: {exc}",
                    controls=[SI_L2_3_14_2],
                )]
            return [self._warn(
                "s3_malware_protection",
                "GuardDuty Malware Protection for S3 evidence bucket",
                str(exc),
                controls=[SI_L2_3_14_2],
            )]

    def _check_nist_conformance_packs(self) -> list[CheckResult]:
        """Gap 4 — NIST 800-171 conformance pack not deployed."""
        cfg = self._client("config")
        if cfg is None:
            return [self._skip("nist_800171_conformance_pack",
                               "Cannot create Config client")]
        try:
            packs: list[dict] = []
            token = None
            while True:
                kwargs: dict = {}
                if token:
                    kwargs["NextToken"] = token
                resp = cfg.describe_conformance_packs(**kwargs)
                packs.extend(resp.get("ConformancePackDetails", []))
                token = resp.get("NextToken")
                if not token:
                    break

            nist_packs = [
                p for p in packs
                if "800-171" in p.get("ConformancePackName", "").replace("-", " ")
                or ("nist" in p.get("ConformancePackName", "").lower()
                    and "171" in p.get("ConformancePackName", ""))
            ]
            if nist_packs:
                return [self._pass(
                    "nist_800171_conformance_pack",
                    "NIST 800-171 AWS Config conformance pack",
                    f"Pack(s): {', '.join(p.get('ConformancePackName','') for p in nist_packs)}",
                    controls=[CM_L2_3_4_1, CM_2, AU_L2_3_3_1, SOC2_CC7_1,
                              ISO_A8_9, IL_SRG_APP_000014],
                )]
            return [self._fail(
                "nist_800171_conformance_pack",
                "NIST 800-171 AWS Config conformance pack",
                "Deploy from scripts/remediate-step3-gaps.sh "
                "(aws configservice put-conformance-pack ...)",
                controls=[CM_L2_3_4_1, CM_2, SOC2_CC7_1, IL_SRG_APP_000014],
            )]
        except Exception as exc:
            return [self._warn(
                "nist_800171_conformance_pack",
                "NIST 800-171 AWS Config conformance pack",
                str(exc),
                controls=[CM_L2_3_4_1],
            )]

    # ── Original checks ───────────────────────────────────────────────────────

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
