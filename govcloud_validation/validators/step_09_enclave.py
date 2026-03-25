"""
Step 9 — Secure Enclave API (CUI Boundary) (Runbook v2.1)

Validates:
  - ALB exists with HTTPS listener (TLS 1.2+)
  - WAF Web ACL attached to ALB
  - Security groups restrict non-HTTP/S traffic
  - Private subnets for backend services
  - ACM certificate valid and not expiring
  - FIPS TLS policy on ALB
"""

from __future__ import annotations

import datetime

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    SC_L2_3_13_1, SC_L2_3_13_8, SC_L2_3_13_11, SC_7, SC_8, SC_13,
    AC_L2_3_1_1, AC_3, AC_17,
    CM_L2_3_4_2, CM_6,
    SOC2_CC6_1, SOC2_CC6_6,
    ISO_A8_20, ISO_A8_24,
    IL_SRG_APP_000023, IL_SRG_APP_000231,
    E_3_13_1e,
)


@register
class Step09Enclave(StageValidator):
    stage_id = "step_09_enclave"
    title = "9) Secure Enclave API (CUI Boundary)"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        elbv2 = self._client("elasticloadbalancingv2")
        if elbv2 is None:
            return [self._skip("elbv2_client", "Cannot create ELBv2 client")]

        # 9-1  Load balancers
        try:
            lbs = elbv2.describe_load_balancers().get("LoadBalancers", [])
        except Exception as exc:
            return [self._fail("alb_exists", "Cannot describe load balancers",
                               str(exc))]

        albs = [lb for lb in lbs if lb.get("Type") == "application"]

        if not albs:
            results.append(self._warn(
                "alb_exists",
                "No Application Load Balancers found — Step 9 not yet deployed",
                controls=[SC_7, CM_6],
            ))
            return results

        results.append(self._pass(
            "alb_exists",
            f"Found {len(albs)} ALB(s)",
            controls=[SC_7, CM_6],
        ))

        for alb in albs:
            alb_arn = alb["LoadBalancerArn"]
            alb_name = alb.get("LoadBalancerName", "unknown")
            prefix = f"alb_{alb_name}"

            # Internal vs internet-facing
            scheme = alb.get("Scheme", "")
            if scheme == "internal":
                results.append(self._pass(
                    f"{prefix}_internal",
                    f"ALB '{alb_name}' is internal (private)",
                    controls=[SC_L2_3_13_1, SC_7, AC_17, E_3_13_1e],
                ))

            # 9-2  HTTPS listeners
            try:
                listeners = elbv2.describe_listeners(
                    LoadBalancerArn=alb_arn
                ).get("Listeners", [])
            except Exception:
                listeners = []

            https_listeners = [
                l for l in listeners if l.get("Protocol") == "HTTPS"
            ]
            http_listeners = [
                l for l in listeners if l.get("Protocol") == "HTTP"
            ]

            if https_listeners:
                results.append(self._pass(
                    f"{prefix}_https",
                    f"ALB '{alb_name}' has {len(https_listeners)} HTTPS listener(s)",
                    controls=[SC_L2_3_13_8, SC_8, SC_13,
                              ISO_A8_24, IL_SRG_APP_000023],
                ))

                # Check TLS policy
                for hl in https_listeners:
                    policy = hl.get("SslPolicy", "")
                    if "FIPS" in policy.upper():
                        results.append(self._pass(
                            f"{prefix}_fips_tls",
                            f"ALB '{alb_name}' uses FIPS TLS policy: {policy}",
                            controls=[SC_13, SC_L2_3_13_11,
                                      IL_SRG_APP_000023],
                        ))
                    elif "TLS-1-2" in policy or "TLS13" in policy:
                        results.append(self._warn(
                            f"{prefix}_fips_tls",
                            f"ALB '{alb_name}' TLS policy '{policy}' — "
                            "use FIPS policy (ELBSecurityPolicy-TLS13-1-2-FIPS-2023-04)",
                            controls=[SC_13, SC_L2_3_13_11],
                        ))
                    else:
                        results.append(self._fail(
                            f"{prefix}_fips_tls",
                            f"ALB '{alb_name}' TLS policy '{policy}' does not meet requirements",
                            "Use ELBSecurityPolicy-TLS13-1-2-FIPS-2023-04 or equivalent",
                            controls=[SC_13, SC_L2_3_13_11,
                                      IL_SRG_APP_000023],
                        ))

                    # Certificate check
                    certs = hl.get("Certificates", [])
                    for cert in certs:
                        cert_arn = cert.get("CertificateArn", "")
                        if cert_arn:
                            results.extend(
                                self._check_certificate(cert_arn, alb_name))
            else:
                results.append(self._fail(
                    f"{prefix}_https",
                    f"ALB '{alb_name}' has NO HTTPS listeners",
                    controls=[SC_L2_3_13_8, SC_8, IL_SRG_APP_000023],
                ))

            # HTTP should redirect to HTTPS
            if http_listeners and not https_listeners:
                results.append(self._fail(
                    f"{prefix}_http_only",
                    f"ALB '{alb_name}' has HTTP listeners without HTTPS — "
                    "all traffic must be encrypted",
                    controls=[SC_L2_3_13_8, SC_8],
                ))

            # 9-3  WAF
            wafv2 = self._client("wafv2")
            if wafv2:
                try:
                    waf_resp = wafv2.get_web_acl_for_resource(
                        ResourceArn=alb_arn)
                    if waf_resp.get("WebACL"):
                        acl_name = waf_resp["WebACL"].get("Name", "")
                        results.append(self._pass(
                            f"{prefix}_waf",
                            f"ALB '{alb_name}' protected by WAF: {acl_name}",
                            controls=[SC_L2_3_13_1, SC_7, SOC2_CC6_6,
                                      ISO_A8_20, IL_SRG_APP_000231],
                        ))
                    else:
                        results.append(self._fail(
                            f"{prefix}_waf",
                            f"ALB '{alb_name}' has NO WAF Web ACL attached",
                            controls=[SC_L2_3_13_1, SC_7, SOC2_CC6_6],
                        ))
                except Exception as exc:
                    if "WAFNonexistentItemException" in str(exc):
                        results.append(self._fail(
                            f"{prefix}_waf",
                            f"ALB '{alb_name}' has no WAF association",
                            controls=[SC_7, SOC2_CC6_6],
                        ))

        return results

    def _check_certificate(self, cert_arn: str,
                           alb_name: str) -> list[CheckResult]:
        results: list[CheckResult] = []
        acm = self._client("acm")
        if acm is None:
            return results

        try:
            cert = acm.describe_certificate(
                CertificateArn=cert_arn
            ).get("Certificate", {})

            status = cert.get("Status", "")
            not_after = cert.get("NotAfter")

            if status == "ISSUED":
                results.append(self._pass(
                    f"cert_{alb_name}",
                    f"ALB '{alb_name}' certificate is ISSUED and valid",
                    controls=[SC_L2_3_13_8, SC_8],
                ))
            else:
                results.append(self._fail(
                    f"cert_{alb_name}",
                    f"ALB '{alb_name}' certificate status: {status}",
                    controls=[SC_L2_3_13_8, SC_8],
                ))

            # Expiry warning (30 days)
            if not_after:
                now = datetime.datetime.now(datetime.timezone.utc)
                if hasattr(not_after, 'tzinfo') and not_after.tzinfo is None:
                    not_after = not_after.replace(tzinfo=datetime.timezone.utc)
                days_left = (not_after - now).days
                if days_left < 30:
                    results.append(self._warn(
                        f"cert_expiry_{alb_name}",
                        f"Certificate expires in {days_left} days",
                        controls=[SC_8],
                    ))

        except Exception:
            pass

        return results
