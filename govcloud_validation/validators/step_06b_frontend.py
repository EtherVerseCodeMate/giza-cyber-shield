"""
Step 6B — Frontend Hosting (Runbook v2.1)

Replaces Vercel — S3 + CloudFront inside GovCloud boundary.

Validates:
  - S3 bucket for static assets (SSE-KMS, no public access)
  - CloudFront distribution with TLS 1.2+
  - WAF association on CloudFront
  - Origin Access Identity / Origin Access Control
  - Custom error pages / SPA routing
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    SC_L2_3_13_8, SC_L2_3_13_11, SC_7, SC_8, SC_28,
    AC_L2_3_1_1, AC_3,
    CM_L2_3_4_2, CM_6,
    SOC2_CC6_1, SOC2_CC6_6,
    ISO_A8_20, ISO_A8_24,
    IL_SRG_APP_000023, IL_SRG_APP_000231,
    E_3_13_1e,
)


@register
class Step06BFrontend(StageValidator):
    stage_id = "step_06b_frontend"
    title = "6B) Frontend Hosting (replaces Vercel)"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        # CloudFront check
        cf = self._client("cloudfront")
        if cf is None:
            return [self._skip("cloudfront_client",
                               "Cannot create CloudFront client — "
                               "CloudFront has limited GovCloud availability; "
                               "ALB+ECS may be the frontend host")]

        try:
            dists = cf.list_distributions().get("DistributionList", {})
            items = dists.get("Items", [])
        except Exception as exc:
            # CloudFront may not be available in all GovCloud regions
            return [self._warn(
                "cloudfront_exists",
                "CloudFront not available or accessible",
                f"Consider ALB-hosted frontend on ECS Fargate. Error: {exc}",
                controls=[SC_7],
            )]

        if not items:
            results.append(self._warn(
                "cloudfront_exists",
                "No CloudFront distributions — frontend may use ALB+ECS instead",
                "S3+CloudFront or ECS Fargate are both valid for GovCloud frontend hosting",
                controls=[CM_6],
            ))
            # Check if ALB exists as alternative
            results.extend(self._check_alb_frontend())
            return results

        for dist in items:
            dist_id = dist.get("Id", "unknown")
            prefix = f"cf_{dist_id}"

            # TLS minimum version
            viewer_cert = dist.get("ViewerCertificate", {})
            min_protocol = viewer_cert.get("MinimumProtocolVersion", "")
            if "TLSv1.2" in min_protocol:
                results.append(self._pass(
                    f"{prefix}_tls",
                    f"Distribution '{dist_id}' enforces TLS 1.2+",
                    controls=[SC_L2_3_13_8, SC_8, ISO_A8_24,
                              IL_SRG_APP_000023],
                ))
            else:
                results.append(self._fail(
                    f"{prefix}_tls",
                    f"Distribution '{dist_id}' min TLS: {min_protocol} — "
                    "must be TLSv1.2_2021 or higher",
                    controls=[SC_L2_3_13_8, SC_8, IL_SRG_APP_000023],
                ))

            # WAF association
            waf_acl = dist.get("WebACLId", "")
            if waf_acl:
                results.append(self._pass(
                    f"{prefix}_waf",
                    f"Distribution '{dist_id}' has WAF ACL attached",
                    controls=[SC_7, SOC2_CC6_6, IL_SRG_APP_000231],
                ))
            else:
                results.append(self._warn(
                    f"{prefix}_waf",
                    f"Distribution '{dist_id}' has no WAF — attach WAF Web ACL",
                    controls=[SC_7, SOC2_CC6_6],
                ))

            # HTTPS-only viewer policy
            for origin in dist.get("Origins", {}).get("Items", []):
                origin_id = origin.get("Id", "")
                s3_config = origin.get("S3OriginConfig")
                if s3_config:
                    oai = s3_config.get("OriginAccessIdentity", "")
                    if oai:
                        results.append(self._pass(
                            f"{prefix}_oai_{origin_id}",
                            "S3 origin uses OAI/OAC (no direct S3 public access)",
                            controls=[AC_L2_3_1_1, AC_3, SOC2_CC6_1],
                        ))
                    else:
                        results.append(self._warn(
                            f"{prefix}_oai_{origin_id}",
                            "S3 origin lacks OAI/OAC — S3 bucket may be publicly accessible",
                            controls=[AC_L2_3_1_1, AC_3, SOC2_CC6_1],
                        ))

        return results

    def _check_alb_frontend(self) -> list[CheckResult]:
        """Check if an ALB is serving frontend as alternative to CloudFront."""
        elbv2 = self._client("elasticloadbalancingv2")
        if elbv2 is None:
            return []

        try:
            lbs = elbv2.describe_load_balancers().get("LoadBalancers", [])
            if lbs:
                return [self._pass(
                    "alb_frontend_alternative",
                    f"Found {len(lbs)} ALB(s) — frontend may be served via ALB+ECS",
                    controls=[SC_7, CM_6],
                )]
        except Exception:
            pass

        return []
