"""
Step 11 — First Smoke Test (Runbook v2.1)

Validates:
  - Health endpoint returns HTTP 200
  - HTTPS enforced (no plain HTTP 200)
  - Response time within acceptable threshold
  - Response includes expected headers (Strict-Transport-Security, etc.)
"""

from __future__ import annotations

import time

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    SC_L2_3_13_8, SC_8,
    SI_L2_3_14_1, SI_2,
    CM_L2_3_4_1, CM_2,
    SOC2_CC7_1,
    ISO_A8_9,
    IL_SRG_APP_000023,
)


@register
class Step11Smoke(StageValidator):
    stage_id = "step_11_smoke"
    title = "11) First Smoke Test"
    requires_boto3 = False  # This stage uses urllib, not boto3

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        health_url = self._env("ASAF_SMOKE_HEALTH_URL")
        if not health_url:
            return [self._skip(
                "smoke_url",
                "ASAF_SMOKE_HEALTH_URL not set — skipping smoke test",
                "Set to your API health endpoint (e.g. https://api.example.gov/health)",
                controls=[CM_2, SOC2_CC7_1],
            )]

        # 11-1  HTTPS enforcement
        if health_url.startswith("https://"):
            results.append(self._pass(
                "smoke_https",
                "Health URL uses HTTPS",
                controls=[SC_L2_3_13_8, SC_8, IL_SRG_APP_000023],
            ))
        elif health_url.startswith("http://"):
            results.append(self._fail(
                "smoke_https",
                "Health URL uses plain HTTP — must use HTTPS",
                controls=[SC_L2_3_13_8, SC_8, IL_SRG_APP_000023],
            ))

        # 11-2  HTTP GET health check
        import urllib.request
        import urllib.error

        try:
            start = time.monotonic()
            req = urllib.request.Request(health_url, method="GET")
            req.add_header("User-Agent", "govcloud-validation/2.1")
            resp = urllib.request.urlopen(req, timeout=30)
            elapsed_ms = int((time.monotonic() - start) * 1000)

            status_code = resp.getcode()
            headers = dict(resp.headers)

            if status_code == 200:
                results.append(self._pass(
                    "smoke_health",
                    f"Health endpoint returned 200 OK ({elapsed_ms}ms)",
                    controls=[SI_L2_3_14_1, SI_2, CM_2, SOC2_CC7_1, ISO_A8_9],
                ))
            else:
                results.append(self._fail(
                    "smoke_health",
                    f"Health endpoint returned {status_code} ({elapsed_ms}ms)",
                    controls=[SI_2, CM_2, SOC2_CC7_1],
                ))

            # 11-3  Response time
            if elapsed_ms <= 5000:
                results.append(self._pass(
                    "smoke_latency",
                    f"Response time {elapsed_ms}ms (threshold: 5000ms)",
                    controls=[SOC2_CC7_1],
                ))
            else:
                results.append(self._warn(
                    "smoke_latency",
                    f"Response time {elapsed_ms}ms exceeds 5000ms threshold",
                    controls=[SOC2_CC7_1],
                ))

            # 11-4  Security headers
            hsts = headers.get("Strict-Transport-Security", "")
            if hsts:
                results.append(self._pass(
                    "smoke_hsts",
                    f"HSTS header present: {hsts}",
                    controls=[SC_L2_3_13_8, SC_8, IL_SRG_APP_000023],
                ))
            else:
                results.append(self._warn(
                    "smoke_hsts",
                    "Strict-Transport-Security header missing",
                    "Add HSTS header with max-age>=31536000",
                    controls=[SC_L2_3_13_8, SC_8],
                ))

            x_content_type = headers.get("X-Content-Type-Options", "")
            if x_content_type.lower() == "nosniff":
                results.append(self._pass(
                    "smoke_xcto",
                    "X-Content-Type-Options: nosniff present",
                    controls=[SC_8],
                ))

            x_frame = headers.get("X-Frame-Options", "")
            if x_frame:
                results.append(self._pass(
                    "smoke_xfo",
                    f"X-Frame-Options: {x_frame}",
                    controls=[SC_8],
                ))

            server = headers.get("Server", "")
            if server and server.lower() not in ("", "cloudfront"):
                results.append(self._warn(
                    "smoke_server_header",
                    f"Server header exposes: '{server}' — consider removing",
                    controls=[CM_L2_3_4_1],
                ))

        except urllib.error.HTTPError as exc:
            results.append(self._fail(
                "smoke_health",
                f"Health endpoint returned HTTP {exc.code}",
                str(exc),
                controls=[SI_2, CM_2, SOC2_CC7_1],
            ))
        except Exception as exc:
            results.append(self._fail(
                "smoke_health",
                "Health endpoint unreachable",
                str(exc),
                controls=[SI_2, CM_2, SOC2_CC7_1],
            ))

        return results
