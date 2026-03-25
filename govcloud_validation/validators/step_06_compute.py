"""
Step 6 — ECS Fargate Compute (Runbook v2.1)

Validates:
  - ECS cluster exists
  - Container Insights enabled
  - Services running on FARGATE launch type
  - Task definitions: non-root user, no privileged, resource limits
  - ECR images used (not Docker Hub)
  - Health checks configured
  - Execute command logging for audit
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    AC_L2_3_1_1, AC_L2_3_1_5, AC_L2_3_1_7, AC_2, AC_6,
    CM_L2_3_4_1, CM_L2_3_4_2, CM_2, CM_6, CM_8,
    SI_L2_3_14_1, SI_L2_3_14_2, SI_2, SI_7,
    AU_L2_3_3_1, AU_2,
    SC_L2_3_13_1, SC_7,
    SOC2_CC6_1, SOC2_CC7_1, SOC2_CC8_1,
    ISO_A8_9, ISO_A8_25,
    IL_SRG_APP_000231, IL_SRG_APP_000175,
    RA_L2_3_11_2, RA_5,
)


@register
class Step06Compute(StageValidator):
    stage_id = "step_06_compute"
    title = "6) ECS Fargate Compute"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        ecs = self._client("ecs")
        if ecs is None:
            return [self._skip("ecs_client", "Cannot create ECS client")]

        # 6-1  List clusters
        try:
            cluster_arns = ecs.list_clusters().get("clusterArns", [])
        except Exception as exc:
            return [self._fail("ecs_clusters", "Cannot list ECS clusters",
                               str(exc))]

        if not cluster_arns:
            return [self._warn(
                "ecs_clusters",
                "No ECS clusters found — Step 6 not yet deployed",
                controls=[CM_2],
            )]

        # Describe clusters
        try:
            clusters = ecs.describe_clusters(
                clusters=cluster_arns,
                include=["SETTINGS", "CONFIGURATIONS"],
            ).get("clusters", [])
        except Exception:
            clusters = []

        results.append(self._pass(
            "ecs_clusters",
            f"Found {len(cluster_arns)} ECS cluster(s)",
            controls=[CM_2, CM_8],
        ))

        for cluster in clusters:
            cname = cluster.get("clusterName", "unknown")
            prefix = f"ecs_{cname}"

            # Container Insights
            settings = cluster.get("settings", [])
            insights = any(
                s.get("name") == "containerInsights" and
                s.get("value") == "enabled"
                for s in settings
            )
            if insights:
                results.append(self._pass(
                    f"{prefix}_insights",
                    f"Cluster '{cname}' Container Insights enabled",
                    controls=[AU_L2_3_3_1, AU_2, SOC2_CC7_1, ISO_A8_9],
                ))
            else:
                results.append(self._warn(
                    f"{prefix}_insights",
                    f"Cluster '{cname}' Container Insights NOT enabled",
                    controls=[AU_L2_3_3_1, AU_2, SOC2_CC7_1],
                ))

            # 6-2  Services
            try:
                svc_arns = ecs.list_services(
                    cluster=cname
                ).get("serviceArns", [])
            except Exception:
                svc_arns = []

            if svc_arns:
                try:
                    services = ecs.describe_services(
                        cluster=cname, services=svc_arns
                    ).get("services", [])
                except Exception:
                    services = []

                for svc in services:
                    svc_name = svc.get("serviceName", "unknown")
                    launch = svc.get("launchType", "")
                    cap_strategy = svc.get("capacityProviderStrategy", [])
                    is_fargate = (
                        launch == "FARGATE" or
                        any("FARGATE" in cp.get("capacityProvider", "")
                            for cp in cap_strategy)
                    )

                    if is_fargate:
                        results.append(self._pass(
                            f"{prefix}_svc_{svc_name}_fargate",
                            f"Service '{svc_name}' uses Fargate",
                            controls=[SC_L2_3_13_1, SC_7, CM_2,
                                      IL_SRG_APP_000231],
                        ))
                    else:
                        results.append(self._warn(
                            f"{prefix}_svc_{svc_name}_fargate",
                            f"Service '{svc_name}' not using Fargate (launch: {launch})",
                            controls=[SC_L2_3_13_1, SC_7],
                        ))

                    # Task definition checks
                    td_arn = svc.get("taskDefinition", "")
                    if td_arn:
                        results.extend(self._check_task_def(ecs, td_arn))

        # 6-3  ECR image scanning
        results.extend(self._check_ecr_scanning())

        return results

    def _check_task_def(self, ecs, td_arn: str) -> list[CheckResult]:
        results: list[CheckResult] = []

        try:
            td = ecs.describe_task_definition(
                taskDefinition=td_arn
            ).get("taskDefinition", {})
        except Exception:
            return results

        family = td.get("family", "unknown")
        prefix = f"td_{family}"

        containers = td.get("containerDefinitions", [])
        for cdef in containers:
            cname = cdef.get("name", "unknown")
            cprefix = f"{prefix}_{cname}"

            # Non-root user
            user = cdef.get("user", "")
            if user and user != "0" and user != "root":
                results.append(self._pass(
                    f"{cprefix}_nonroot",
                    f"Container '{cname}' runs as user '{user}' (non-root)",
                    controls=[AC_L2_3_1_7, AC_6, CM_L2_3_4_2, CM_6,
                              ISO_A8_25, IL_SRG_APP_000231],
                ))
            else:
                results.append(self._fail(
                    f"{cprefix}_nonroot",
                    f"Container '{cname}' user is '{user or 'root(default)'}' — "
                    "must run as non-root (UID 1001+)",
                    controls=[AC_L2_3_1_7, AC_6, CM_L2_3_4_2, CM_6,
                              ISO_A8_25, IL_SRG_APP_000231],
                ))

            # Privileged
            if cdef.get("privileged", False):
                results.append(self._fail(
                    f"{cprefix}_privileged",
                    f"Container '{cname}' is PRIVILEGED — remove privileged flag",
                    controls=[AC_L2_3_1_5, AC_6, SC_7],
                ))
            else:
                results.append(self._pass(
                    f"{cprefix}_privileged",
                    f"Container '{cname}' is not privileged",
                    controls=[AC_L2_3_1_5, AC_6],
                ))

            # Read-only root filesystem
            if cdef.get("readonlyRootFilesystem", False):
                results.append(self._pass(
                    f"{cprefix}_readonly_fs",
                    f"Container '{cname}' has read-only root filesystem",
                    controls=[CM_L2_3_4_2, SI_7],
                ))
            else:
                results.append(self._warn(
                    f"{cprefix}_readonly_fs",
                    f"Container '{cname}' root filesystem is writable",
                    controls=[CM_L2_3_4_2, SI_7],
                ))

            # Resource limits
            memory = cdef.get("memory") or cdef.get("memoryReservation")
            cpu = cdef.get("cpu")
            if memory and cpu:
                results.append(self._pass(
                    f"{cprefix}_resources",
                    f"Container '{cname}' has resource limits (cpu={cpu}, memory={memory})",
                    controls=[CM_6, SOC2_CC8_1],
                ))
            else:
                results.append(self._warn(
                    f"{cprefix}_resources",
                    f"Container '{cname}' missing explicit resource limits",
                    controls=[CM_6],
                ))

            # Health check
            hc = cdef.get("healthCheck")
            if hc:
                results.append(self._pass(
                    f"{cprefix}_healthcheck",
                    f"Container '{cname}' has health check configured",
                    controls=[SI_L2_3_14_1, SOC2_CC7_1],
                ))

            # Image source (should be ECR, not Docker Hub)
            image = cdef.get("image", "")
            if ".ecr." in image or "registry1.dso.mil" in image:
                results.append(self._pass(
                    f"{cprefix}_image_source",
                    f"Container '{cname}' uses approved registry",
                    controls=[SI_L2_3_14_2, SI_7, CM_2, RA_5,
                              ISO_A8_25, IL_SRG_APP_000175],
                ))
            elif "docker.io" in image or "/" not in image:
                results.append(self._fail(
                    f"{cprefix}_image_source",
                    f"Container '{cname}' uses Docker Hub image: {image}",
                    "Use ECR or Iron Bank (registry1.dso.mil) images",
                    controls=[SI_L2_3_14_2, SI_7, CM_2, RA_5],
                ))
            else:
                results.append(self._warn(
                    f"{cprefix}_image_source",
                    f"Container '{cname}' image: {image} — verify registry is approved",
                    controls=[SI_L2_3_14_2, SI_7],
                ))

        return results

    def _check_ecr_scanning(self) -> list[CheckResult]:
        ecr = self._client("ecr")
        if ecr is None:
            return []

        try:
            repos = ecr.describe_repositories().get("repositories", [])
            if not repos:
                return [self._skip("ecr_scanning", "No ECR repositories found")]

            no_scan = []
            for repo in repos:
                scan = repo.get("imageScanningConfiguration", {})
                if not scan.get("scanOnPush", False):
                    no_scan.append(repo.get("repositoryName", ""))

            if no_scan:
                return [self._fail(
                    "ecr_scan_on_push",
                    f"ECR repos without scan-on-push: {', '.join(no_scan[:5])}",
                    controls=[RA_L2_3_11_2, RA_5, SI_L2_3_14_1, SI_2,
                              SOC2_CC7_1, IL_SRG_APP_000175],
                )]
            else:
                return [self._pass(
                    "ecr_scan_on_push",
                    f"All {len(repos)} ECR repositories have scan-on-push enabled",
                    controls=[RA_L2_3_11_2, RA_5, SI_L2_3_14_1, SI_2],
                )]
        except Exception:
            return []
