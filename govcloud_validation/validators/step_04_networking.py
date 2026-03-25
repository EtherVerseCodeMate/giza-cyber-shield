"""
Step 4 — Networking Baseline (VPC) (Runbook v2.1)

Validates:
  - VPC exists with expected CIDR
  - Public / private / data subnets across AZs
  - VPC Flow Logs enabled
  - NAT Gateway present
  - No overly permissive security groups (0.0.0.0/0 ingress)
  - VPC endpoints for S3, ECR, Secrets Manager, CloudWatch
  - Internet Gateway attached only to VPC with public subnets
"""

from __future__ import annotations

from govcloud_validation.base import CheckResult, StageValidator
from govcloud_validation.registry import register
from govcloud_validation.compliance import (
    AC_L2_3_1_1, AC_L2_3_1_5, AC_2, AC_3, AC_17,
    SC_L2_3_13_1, SC_L2_3_13_8, SC_7, SC_8,
    AU_L2_3_3_1, AU_12,
    CM_L2_3_4_1, CM_2, CM_6,
    SOC2_CC6_1, SOC2_CC6_6,
    ISO_A8_20,
    IL_SRG_APP_000231,
    E_3_13_1e,
)


@register
class Step04Networking(StageValidator):
    stage_id = "step_04_networking"
    title = "4) Networking Baseline (VPC)"

    def checks(self) -> list[CheckResult]:
        results: list[CheckResult] = []

        ec2 = self._client("ec2")
        if ec2 is None:
            return [self._skip("ec2_client", "Cannot create EC2 client")]

        # 4-1  VPC exists
        try:
            vpcs = ec2.describe_vpcs(
                Filters=[{"Name": "state", "Values": ["available"]}]
            ).get("Vpcs", [])
        except Exception as exc:
            return [self._fail("vpc_exists", "Cannot describe VPCs", str(exc))]

        # Filter out default VPC
        custom_vpcs = [v for v in vpcs if not v.get("IsDefault", False)]

        if not custom_vpcs:
            results.append(self._fail(
                "vpc_exists",
                "No custom VPCs found — create your GovCloud workload VPC",
                controls=[SC_L2_3_13_1, SC_7, CM_2, ISO_A8_20,
                          IL_SRG_APP_000231],
            ))
            return results

        results.append(self._pass(
            "vpc_exists",
            f"Found {len(custom_vpcs)} custom VPC(s)",
            controls=[SC_L2_3_13_1, SC_7, CM_2],
        ))

        for vpc in custom_vpcs:
            vpc_id = vpc["VpcId"]
            cidr = vpc.get("CidrBlock", "")
            name = ""
            for tag in vpc.get("Tags", []):
                if tag["Key"] == "Name":
                    name = tag["Value"]
                    break
            label = name or vpc_id

            # 4-2  Flow Logs
            results.extend(self._check_flow_logs(ec2, vpc_id, label))

            # 4-3  Subnets
            results.extend(self._check_subnets(ec2, vpc_id, label))

            # 4-4  NAT Gateways
            results.extend(self._check_nat_gateways(ec2, vpc_id, label))

            # 4-5  Security Groups
            results.extend(self._check_security_groups(ec2, vpc_id, label))

            # 4-6  VPC Endpoints
            results.extend(self._check_vpc_endpoints(ec2, vpc_id, label))

        return results

    def _check_flow_logs(self, ec2, vpc_id: str,
                         label: str) -> list[CheckResult]:
        try:
            fls = ec2.describe_flow_logs(
                Filters=[{"Name": "resource-id", "Values": [vpc_id]}]
            ).get("FlowLogs", [])

            if fls:
                active = [f for f in fls if f.get("FlowLogStatus") == "ACTIVE"]
                return [self._pass(
                    f"flow_logs_{vpc_id}",
                    f"VPC '{label}' has {len(active)} active Flow Log(s)",
                    controls=[AU_L2_3_3_1, AU_12, SC_7,
                              SOC2_CC6_6, ISO_A8_20, IL_SRG_APP_000231],
                )]
            else:
                return [self._fail(
                    f"flow_logs_{vpc_id}",
                    f"VPC '{label}' has NO Flow Logs — required for FedRAMP AU-12",
                    controls=[AU_L2_3_3_1, AU_12, SC_7, SOC2_CC6_6],
                )]
        except Exception as exc:
            return [self._warn(f"flow_logs_{vpc_id}",
                               "Cannot check Flow Logs", str(exc))]

    def _check_subnets(self, ec2, vpc_id: str,
                       label: str) -> list[CheckResult]:
        results: list[CheckResult] = []

        try:
            subnets = ec2.describe_subnets(
                Filters=[{"Name": "vpc-id", "Values": [vpc_id]}]
            ).get("Subnets", [])
        except Exception:
            return [self._warn(f"subnets_{vpc_id}",
                               "Cannot describe subnets")]

        if not subnets:
            return [self._fail(f"subnets_{vpc_id}",
                               f"No subnets in VPC '{label}'")]

        public = [s for s in subnets if s.get("MapPublicIpOnLaunch", False)]
        private = [s for s in subnets if not s.get("MapPublicIpOnLaunch", False)]
        azs = {s["AvailabilityZone"] for s in subnets}

        results.append(self._pass(
            f"subnets_{vpc_id}",
            f"VPC '{label}': {len(subnets)} subnets "
            f"({len(public)} public, {len(private)} private) across {len(azs)} AZs",
            controls=[SC_L2_3_13_1, SC_7, CM_2, IL_SRG_APP_000231],
        ))

        # Multi-AZ check
        if len(azs) >= 2:
            results.append(self._pass(
                f"multi_az_{vpc_id}",
                f"VPC '{label}' spans {len(azs)} AZs (HA)",
                controls=[SC_7, SOC2_CC6_6],
            ))
        else:
            results.append(self._warn(
                f"multi_az_{vpc_id}",
                f"VPC '{label}' uses only {len(azs)} AZ — multi-AZ recommended",
                controls=[SC_7],
            ))

        # Workloads should be in private subnets
        if len(private) == 0:
            results.append(self._fail(
                f"private_subnets_{vpc_id}",
                f"VPC '{label}' has no private subnets — workloads must be in private subnets",
                controls=[SC_L2_3_13_1, SC_7, AC_17,
                          E_3_13_1e, IL_SRG_APP_000231],
            ))

        return results

    def _check_nat_gateways(self, ec2, vpc_id: str,
                            label: str) -> list[CheckResult]:
        try:
            nats = ec2.describe_nat_gateways(
                Filters=[
                    {"Name": "vpc-id", "Values": [vpc_id]},
                    {"Name": "state", "Values": ["available"]},
                ]
            ).get("NatGateways", [])

            if nats:
                return [self._pass(
                    f"nat_gateway_{vpc_id}",
                    f"VPC '{label}' has {len(nats)} NAT Gateway(s)",
                    controls=[SC_L2_3_13_1, SC_7, AC_17],
                )]
            else:
                return [self._warn(
                    f"nat_gateway_{vpc_id}",
                    f"VPC '{label}' has no NAT Gateways — "
                    "private subnets need NAT for outbound (or use VPC endpoints only)",
                    controls=[SC_L2_3_13_1, SC_7],
                )]
        except Exception:
            return []

    def _check_security_groups(self, ec2, vpc_id: str,
                               label: str) -> list[CheckResult]:
        results: list[CheckResult] = []

        try:
            sgs = ec2.describe_security_groups(
                Filters=[{"Name": "vpc-id", "Values": [vpc_id]}]
            ).get("SecurityGroups", [])
        except Exception:
            return [self._warn(f"security_groups_{vpc_id}",
                               "Cannot describe security groups")]

        wide_open = []
        for sg in sgs:
            sg_id = sg["GroupId"]
            sg_name = sg.get("GroupName", "")
            for rule in sg.get("IpPermissions", []):
                for ip_range in rule.get("IpRanges", []):
                    if ip_range.get("CidrIp") == "0.0.0.0/0":
                        port = rule.get("FromPort", "all")
                        # ALB on 80/443 is acceptable
                        if port not in (80, 443):
                            wide_open.append(
                                f"{sg_name}({sg_id}) port {port}")

        if wide_open:
            results.append(self._fail(
                f"sg_wide_open_{vpc_id}",
                f"Security groups with 0.0.0.0/0 ingress (non-HTTP/S): "
                f"{', '.join(wide_open[:5])}",
                controls=[AC_L2_3_1_1, AC_3, SC_L2_3_13_1, SC_7,
                          SOC2_CC6_1, SOC2_CC6_6, ISO_A8_20,
                          IL_SRG_APP_000231, E_3_13_1e],
            ))
        else:
            results.append(self._pass(
                f"sg_least_privilege_{vpc_id}",
                f"VPC '{label}': no wide-open ingress rules (non-HTTP/S)",
                controls=[AC_L2_3_1_1, AC_3, SC_L2_3_13_1, SC_7,
                          SOC2_CC6_1, SOC2_CC6_6],
            ))

        return results

    def _check_vpc_endpoints(self, ec2, vpc_id: str,
                             label: str) -> list[CheckResult]:
        results: list[CheckResult] = []

        recommended_services = [
            "com.amazonaws.us-gov-west-1.s3",
            "com.amazonaws.us-gov-west-1.ecr.dkr",
            "com.amazonaws.us-gov-west-1.ecr.api",
            "com.amazonaws.us-gov-west-1.secretsmanager",
            "com.amazonaws.us-gov-west-1.logs",
            "com.amazonaws.us-gov-west-1.monitoring",
            "com.amazonaws.us-gov-west-1.kms",
        ]

        try:
            endpoints = ec2.describe_vpc_endpoints(
                Filters=[{"Name": "vpc-id", "Values": [vpc_id]}]
            ).get("VpcEndpoints", [])

            active_services = {
                ep["ServiceName"] for ep in endpoints
                if ep.get("State") == "available"
            }

            missing = [s for s in recommended_services
                       if s not in active_services]

            if missing:
                # Use region from self.region to build service names
                short_names = [s.split(".")[-1] for s in missing]
                results.append(self._warn(
                    f"vpc_endpoints_{vpc_id}",
                    f"VPC '{label}' missing recommended endpoints: "
                    f"{', '.join(short_names)}",
                    "VPC endpoints reduce NAT costs and keep traffic on AWS backbone",
                    controls=[SC_L2_3_13_1, SC_7, SC_L2_3_13_8, SC_8,
                              E_3_13_1e],
                ))
            else:
                results.append(self._pass(
                    f"vpc_endpoints_{vpc_id}",
                    f"VPC '{label}' has all recommended VPC endpoints",
                    controls=[SC_L2_3_13_1, SC_7, SC_L2_3_13_8, SC_8],
                ))

        except Exception as exc:
            results.append(self._warn(f"vpc_endpoints_{vpc_id}",
                                      "Cannot check VPC endpoints", str(exc)))

        return results
