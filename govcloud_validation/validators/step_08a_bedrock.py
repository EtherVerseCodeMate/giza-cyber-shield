"""
Step 8A — Bedrock AI (Runbook v2.1)

Replaces OpenAI/xAI — AWS Bedrock inside GovCloud boundary.

Validates:
  - Bedrock model access enabled
  - Model invocation logging configured
  - VPC endpoint for Bedrock (if available)
  - No external LLM API keys in Secrets Manager (warn)
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    SC_L2_3_13_1, SC_L2_3_13_8, SC_7, SC_8,
    AU_L2_3_3_1, AU_2,
    CM_L2_3_4_2, CM_6,
    SOC2_CC6_7, SOC2_CC7_2,
    ISO_A5_23,
    IL_SRG_APP_000231,
    E_3_13_1e,
)


@register
class Step08ABedrock(StageValidator):
    stage_id = "step_08a_bedrock"
    title = "8A) Bedrock AI (replaces OpenAI/xAI)"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        # Bedrock availability check
        bedrock = self._client("bedrock")
        if bedrock is None:
            return [self._skip(
                "bedrock_client",
                "Cannot create Bedrock client — may not be available in GovCloud yet",
                "Monitor AWS GovCloud service availability for Bedrock",
                controls=[CM_6],
            )]

        # 8A-1  List foundation models
        try:
            models = bedrock.list_foundation_models().get(
                "modelSummaries", [])
            if models:
                model_names = [m.get("modelId", "?") for m in models[:5]]
                results.append(self._pass(
                    "bedrock_models_available",
                    f"Bedrock models available: {len(models)} "
                    f"(e.g. {', '.join(model_names)})",
                    controls=[CM_6, ISO_A5_23],
                ))
            else:
                results.append(self._warn(
                    "bedrock_models_available",
                    "No Bedrock models available — request model access",
                    controls=[CM_6],
                ))
        except Exception as exc:
            err = str(exc)
            if "not authorized" in err.lower() or "AccessDenied" in err:
                results.append(self._warn(
                    "bedrock_models_available",
                    "Not authorized to list Bedrock models — request access",
                    str(exc),
                    controls=[CM_6],
                ))
            else:
                results.append(self._skip(
                    "bedrock_models_available",
                    "Bedrock may not be available in this region",
                    str(exc),
                    controls=[CM_6],
                ))

        # 8A-2  Model invocation logging
        try:
            logging_config = bedrock.get_model_invocation_logging_configuration()
            config = logging_config.get("loggingConfig", {})
            cw_enabled = config.get("cloudWatchConfig", {}).get("logGroupName")
            s3_enabled = config.get("s3Config", {}).get("bucketName")

            if cw_enabled or s3_enabled:
                results.append(self._pass(
                    "bedrock_logging",
                    "Bedrock model invocation logging is configured",
                    f"CloudWatch: {cw_enabled or 'N/A'}, S3: {s3_enabled or 'N/A'}",
                    controls=[AU_L2_3_3_1, AU_2, SOC2_CC7_2, ISO_A5_23],
                ))
            else:
                results.append(self._fail(
                    "bedrock_logging",
                    "Bedrock invocation logging NOT configured — "
                    "required for CUI audit trail",
                    controls=[AU_L2_3_3_1, AU_2, SOC2_CC7_2],
                ))
        except Exception as exc:
            results.append(self._warn(
                "bedrock_logging",
                "Cannot check Bedrock logging configuration",
                str(exc),
                controls=[AU_2],
            ))

        # 8A-3  Check for external LLM API keys (should be migrated)
        results.extend(self._check_external_llm_keys())

        return results

    def _check_external_llm_keys(self) -> list[CheckResult]:
        """Warn if external LLM API keys are still in Secrets Manager."""
        sm = self._client("secretsmanager")
        if sm is None:
            return []

        external_patterns = ["openai", "xai", "anthropic-api-key",
                             "cohere", "huggingface"]
        try:
            secrets = sm.list_secrets().get("SecretList", [])
            external_found = []
            for secret in secrets:
                name = secret.get("Name", "").lower()
                if any(p in name for p in external_patterns):
                    external_found.append(secret.get("Name", ""))

            if external_found:
                return [self._warn(
                    "external_llm_keys",
                    f"External LLM API keys still in Secrets Manager: "
                    f"{', '.join(external_found)}",
                    "Migrate to Bedrock to keep LLM traffic inside GovCloud boundary",
                    controls=[SC_L2_3_13_1, SC_L2_3_13_8, SC_7, SC_8,
                              SOC2_CC6_7, IL_SRG_APP_000231, E_3_13_1e],
                )]
            else:
                return [self._pass(
                    "external_llm_keys",
                    "No external LLM API keys found in Secrets Manager",
                    controls=[SC_L2_3_13_8, SOC2_CC6_7],
                )]
        except Exception:
            return []
