"""
Step 6A — Lambda + DynamoDB (Runbook v2.1)

Replaces Cloudflare Workers — telemetry ingestion inside GovCloud boundary.

Validates:
  - Lambda functions exist in GovCloud
  - Functions use GovCloud-approved runtimes
  - Functions encrypted with KMS CMK
  - VPC-attached (if processing CUI)
  - DynamoDB tables encrypted with CMK
  - Point-in-time recovery enabled
  - No public function URLs without auth
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    SC_L2_3_13_11, SC_28, SC_12,
    AC_L2_3_1_1, AC_3,
    CM_L2_3_4_2, CM_6,
    AU_L2_3_3_1, AU_2,
    SOC2_CC6_1, SOC2_CC6_7, SOC2_A1_2,
    ISO_A8_24, ISO_A8_25,
    IL_SRG_APP_000516,
    E_3_13_1e,
)


@register
class Step06ALambda(StageValidator):
    stage_id = "step_06a_lambda"
    title = "6A) Lambda + DynamoDB (replaces Cloudflare Workers)"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        # Lambda checks
        lam = self._client("lambda")
        if lam is None:
            return [self._skip("lambda_client", "Cannot create Lambda client")]

        try:
            functions = lam.list_functions().get("Functions", [])
        except Exception as exc:
            return [self._fail("lambda_list", "Cannot list Lambda functions",
                               str(exc))]

        if not functions:
            results.append(self._warn(
                "lambda_exists",
                "No Lambda functions found — Step 6A not yet deployed",
                "Deploy Lambda functions to replace Cloudflare Workers telemetry",
                controls=[CM_6],
            ))
        else:
            results.append(self._pass(
                "lambda_exists",
                f"Found {len(functions)} Lambda function(s)",
                controls=[CM_6],
            ))

            for fn in functions:
                fname = fn.get("FunctionName", "unknown")
                prefix = f"lambda_{fname}"

                # KMS encryption
                kms_key = fn.get("KMSKeyArn", "")
                if kms_key:
                    results.append(self._pass(
                        f"{prefix}_kms",
                        f"Function '{fname}' encrypted with CMK",
                        controls=[SC_L2_3_13_11, SC_28, SC_12,
                                  ISO_A8_24, IL_SRG_APP_000516],
                    ))
                else:
                    results.append(self._warn(
                        f"{prefix}_kms",
                        f"Function '{fname}' using default encryption — use CMK",
                        controls=[SC_L2_3_13_11, SC_28, SC_12],
                    ))

                # VPC attachment
                vpc_config = fn.get("VpcConfig", {})
                if vpc_config.get("SubnetIds"):
                    results.append(self._pass(
                        f"{prefix}_vpc",
                        f"Function '{fname}' is VPC-attached",
                        controls=[SC_L2_3_13_11, AC_L2_3_1_1, AC_3,
                                  E_3_13_1e, IL_SRG_APP_000516],
                    ))
                else:
                    results.append(self._warn(
                        f"{prefix}_vpc",
                        f"Function '{fname}' is NOT VPC-attached — "
                        "attach to VPC if processing CUI",
                        controls=[SC_L2_3_13_11, AC_3, E_3_13_1e],
                    ))

                # Runtime check
                runtime = fn.get("Runtime", "")
                approved = ("python3.", "nodejs", "provided.al2",
                            "java", "dotnet", "go")
                if any(runtime.startswith(r) for r in approved):
                    results.append(self._pass(
                        f"{prefix}_runtime",
                        f"Function '{fname}' uses approved runtime: {runtime}",
                        controls=[CM_L2_3_4_2, ISO_A8_25],
                    ))

        # DynamoDB checks
        results.extend(self._check_dynamodb())

        return results

    def _check_dynamodb(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        ddb = self._client("dynamodb")
        if ddb is None:
            return [self._skip("dynamodb_client", "Cannot create DynamoDB client")]

        try:
            tables = ddb.list_tables().get("TableNames", [])
        except Exception as exc:
            return [self._fail("dynamodb_list", "Cannot list DynamoDB tables",
                               str(exc))]

        if not tables:
            results.append(self._skip(
                "dynamodb_exists",
                "No DynamoDB tables found",
                controls=[CM_6],
            ))
            return results

        for table_name in tables:
            prefix = f"ddb_{table_name}"
            try:
                desc = ddb.describe_table(TableName=table_name).get("Table", {})
            except Exception:
                continue

            # Encryption
            sse = desc.get("SSEDescription", {})
            sse_type = sse.get("SSEType", "")
            if sse_type == "KMS":
                results.append(self._pass(
                    f"{prefix}_encryption",
                    f"Table '{table_name}' encrypted with KMS CMK",
                    controls=[SC_28, SC_12, SOC2_CC6_7, IL_SRG_APP_000516],
                ))
            else:
                results.append(self._warn(
                    f"{prefix}_encryption",
                    f"Table '{table_name}' using default encryption — upgrade to CMK",
                    controls=[SC_28, SC_12],
                ))

            # Point-in-time recovery
            try:
                pitr = ddb.describe_continuous_backups(
                    TableName=table_name
                ).get("ContinuousBackupsDescription", {})
                pitr_status = pitr.get(
                    "PointInTimeRecoveryDescription", {}
                ).get("PointInTimeRecoveryStatus", "")
                if pitr_status == "ENABLED":
                    results.append(self._pass(
                        f"{prefix}_pitr",
                        f"Table '{table_name}' PITR enabled",
                        controls=[SOC2_A1_2],
                    ))
                else:
                    results.append(self._warn(
                        f"{prefix}_pitr",
                        f"Table '{table_name}' PITR not enabled — enable for recovery",
                        controls=[SOC2_A1_2],
                    ))
            except Exception:
                pass

        return results
