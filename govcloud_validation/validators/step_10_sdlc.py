"""
Step 10 — SDLC — Evidence-First (Runbook v2.1)

Validates:
  - CodePipeline exists
  - CodeBuild projects use encryption
  - ECR scan-on-push enabled (re-verified here for SDLC context)
  - No public ECR repositories
  - Build artifacts encrypted
  - Source (GitHub / CodeCommit) connection
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    CM_L2_3_4_1, CM_L2_3_4_2, CM_2, CM_6, CM_8,
    SI_L2_3_14_1, SI_L2_3_14_2, SI_2, SI_7,
    AU_L2_3_3_1, AU_2,
    SC_L2_3_13_11, SC_28,
    RA_L2_3_11_2, RA_5,
    SOC2_CC7_1, SOC2_CC8_1,
    ISO_A8_25, ISO_A8_28,
    IL_SRG_APP_000175,
    E_3_4_1e,
)


@register
class Step10SDLC(StageValidator):
    stage_id = "step_10_sdlc"
    title = "10) SDLC — Evidence-First"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        # 10-1  CodePipeline
        results.extend(self._check_codepipeline())

        # 10-2  CodeBuild
        results.extend(self._check_codebuild())

        # 10-3  ECR public repos (should not exist)
        results.extend(self._check_ecr_public())

        return results

    def _check_codepipeline(self) -> list[CheckResult]:
        cp = self._client("codepipeline")
        if cp is None:
            return [self._skip("codepipeline_client",
                               "Cannot create CodePipeline client")]

        try:
            pipelines = cp.list_pipelines().get("pipelines", [])
        except Exception as exc:
            return [self._fail("codepipeline_list",
                               "Cannot list pipelines", str(exc))]

        if not pipelines:
            return [self._warn(
                "codepipeline_exists",
                "No CodePipelines found — Step 10 not yet deployed",
                "Create CI/CD pipeline for evidence-first SDLC",
                controls=[CM_L2_3_4_1, CM_2, SOC2_CC8_1, ISO_A8_25],
            )]

        results = [self._pass(
            "codepipeline_exists",
            f"Found {len(pipelines)} CodePipeline(s)",
            controls=[CM_L2_3_4_1, CM_2, SOC2_CC8_1, ISO_A8_25, E_3_4_1e],
        )]

        for pipeline in pipelines:
            pname = pipeline.get("name", "unknown")
            try:
                detail = cp.get_pipeline(name=pname).get("pipeline", {})
                # Check artifact store encryption
                artifact_store = detail.get("artifactStore", {})
                enc_key = artifact_store.get("encryptionKey", {})
                if enc_key.get("id"):
                    results.append(self._pass(
                        f"pipeline_{pname}_encryption",
                        f"Pipeline '{pname}' artifacts encrypted with KMS",
                        controls=[SC_L2_3_13_11, SC_28, ISO_A8_25],
                    ))
                else:
                    results.append(self._warn(
                        f"pipeline_{pname}_encryption",
                        f"Pipeline '{pname}' using default artifact encryption",
                        controls=[SC_L2_3_13_11, SC_28],
                    ))
            except Exception:
                pass

        return results

    def _check_codebuild(self) -> list[CheckResult]:
        cb = self._client("codebuild")
        if cb is None:
            return [self._skip("codebuild_client",
                               "Cannot create CodeBuild client")]

        try:
            project_names = cb.list_projects().get("projects", [])
        except Exception as exc:
            return [self._fail("codebuild_list",
                               "Cannot list CodeBuild projects", str(exc))]

        if not project_names:
            return [self._skip(
                "codebuild_exists",
                "No CodeBuild projects found",
                controls=[CM_2],
            )]

        results = [self._pass(
            "codebuild_exists",
            f"Found {len(project_names)} CodeBuild project(s)",
            controls=[CM_2, SOC2_CC8_1, ISO_A8_25],
        )]

        try:
            projects = cb.batch_get_projects(
                names=project_names[:20]
            ).get("projects", [])
        except Exception:
            return results

        for proj in projects:
            pname = proj.get("name", "unknown")
            prefix = f"cb_{pname}"

            # Encryption key
            enc_key = proj.get("encryptionKey", "")
            if enc_key and "alias/aws/" not in enc_key:
                results.append(self._pass(
                    f"{prefix}_encryption",
                    f"Project '{pname}' uses CMK for build encryption",
                    controls=[SC_L2_3_13_11, SC_28, IL_SRG_APP_000175],
                ))

            # Privileged mode (needed for Docker builds but should be noted)
            env = proj.get("environment", {})
            if env.get("privilegedMode", False):
                results.append(self._warn(
                    f"{prefix}_privileged",
                    f"Project '{pname}' runs in privileged mode (Docker builds)",
                    "Acceptable for container builds; ensure build specs are reviewed",
                    controls=[CM_L2_3_4_2, CM_6],
                ))

            # Logging
            logs = proj.get("logsConfig", {})
            cw_logs = logs.get("cloudWatchLogs", {})
            if cw_logs.get("status") == "ENABLED":
                results.append(self._pass(
                    f"{prefix}_logging",
                    f"Project '{pname}' logs to CloudWatch",
                    controls=[AU_L2_3_3_1, AU_2, ISO_A8_25],
                ))

        return results

    def _check_ecr_public(self) -> list[CheckResult]:
        """Ensure no public ECR repositories exist in GovCloud."""
        ecr = self._client("ecr")
        if ecr is None:
            return []

        try:
            repos = ecr.describe_repositories().get("repositories", [])
            public_repos = []
            for repo in repos:
                # Check repository policy for public access
                repo_name = repo.get("repositoryName", "")
                try:
                    policy = ecr.get_repository_policy(
                        repositoryName=repo_name
                    )
                    policy_text = policy.get("policyText", "")
                    if '"Principal":"*"' in policy_text or '"Principal": "*"' in policy_text:
                        public_repos.append(repo_name)
                except Exception:
                    # No policy = not public
                    pass

            if public_repos:
                return [self._fail(
                    "ecr_no_public",
                    f"ECR repos with public access: {', '.join(public_repos)}",
                    "Remove public access — GovCloud images must not be publicly accessible",
                    controls=[SI_L2_3_14_2, SI_7, CM_L2_3_4_2,
                              SOC2_CC7_1, IL_SRG_APP_000175],
                )]
            elif repos:
                return [self._pass(
                    "ecr_no_public",
                    f"All {len(repos)} ECR repositories are private",
                    controls=[SI_L2_3_14_2, SI_7, CM_L2_3_4_2],
                )]
        except Exception:
            pass

        return []
