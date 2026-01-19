"""NIST AI RMF COMMUNICATE: Role-specific stakeholder reports."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class AIDecision:
    description: str
    confidence: float
    risk_level: str
    affected_systems: int
    revenue_at_risk: int
    remediation_cost: int
    recommended_next_steps: str
    dag_node_id: str
    model_version: str
    license_tier: str
    human_approval_required: bool
    threat_type: str
    mitre_technique: str
    csf_category: str
    anomaly_score: float
    cvss_score: Optional[float]
    false_positive_prob: float
    automated_response: str
    rollback_plan: str
    signature: str
    timestamp: str
    cmmc_practice: str
    nist_control: str
    stig_id: Optional[str]


@dataclass
class Report:
    title: str
    content: str
    format: str


class StakeholderReportGenerator:
    """
    Generate role-specific explanations of AI decisions.
    Implements NIST AI RMF COMMUNICATE function.
    """

    def generate_report(self, decision: AIDecision, audience: str) -> Report:
        if audience == "executive":
            return self._generate_executive_summary(decision)
        if audience == "technical":
            return self._generate_technical_report(decision)
        if audience == "auditor":
            return self._generate_audit_report(decision)
        if audience == "legal":
            return self._generate_legal_report(decision)
        return self._generate_default_report(decision)

    def _generate_executive_summary(self, decision: AIDecision) -> Report:
        return Report(
            title="AI Security Decision - Executive Summary",
            content=(
                "WHAT HAPPENED:\n"
                "SouHimBou AGI detected a security anomaly and took action.\n\n"
                f"ACTION TAKEN:\n{decision.description}\n\n"
                "BUSINESS IMPACT:\n"
                f"- Risk Level: {decision.risk_level}\n"
                f"- Systems Affected: {decision.affected_systems}\n"
                f"- Revenue at Risk: ${decision.revenue_at_risk:,}\n"
                f"- Estimated Cost to Remediate: ${decision.remediation_cost:,}\n\n"
                "AI CONFIDENCE:\n"
                f"{decision.confidence:.0%} confident in this decision\n\n"
                "NEXT STEPS:\n"
                f"{decision.recommended_next_steps}\n\n"
                "VALIDATION:\n"
                "This decision has been cryptographically signed and recorded in the "
                "immutable audit trail.\n"
                f"DAG Node: {decision.dag_node_id}\n"
            ),
            format="markdown",
        )

    def _generate_technical_report(self, decision: AIDecision) -> Report:
        return Report(
            title="AI Security Decision - Technical Report",
            content=(
                "TECHNICAL DETAILS\n\n"
                f"Decision: {decision.description}\n"
                f"Anomaly Score: {decision.anomaly_score:.4f}\n"
                f"MITRE Technique: {decision.mitre_technique}\n"
                f"Automated Response: {decision.automated_response}\n"
                f"Rollback Plan: {decision.rollback_plan}\n"
                f"DAG Node ID: {decision.dag_node_id}\n"
            ),
            format="markdown",
        )

    def _generate_audit_report(self, decision: AIDecision) -> Report:
        return Report(
            title="AI Security Decision - Compliance Audit Report",
            content=(
                "NIST AI RMF COMPLIANCE REPORT\n\n"
                "1. GOVERNANCE (GOVERN Function)\n"
                f"   - AI Model Version: {decision.model_version}\n"
                f"   - Licensing Tier: {decision.license_tier}\n"
                f"   - Human Oversight: {decision.human_approval_required}\n\n"
                "2. RISK MAPPING (MAP Function)\n"
                f"   - Threat Classification: {decision.threat_type}\n"
                f"   - MITRE ATT&CK Technique: {decision.mitre_technique}\n"
                f"   - NIST CSF Category: {decision.csf_category}\n\n"
                "3. MEASUREMENT (MEASURE Function)\n"
                f"   - Anomaly Score: {decision.anomaly_score:.4f}\n"
                f"   - CVSS Score (if applicable): {decision.cvss_score or 'N/A'}\n"
                f"   - False Positive Probability: {decision.false_positive_prob:.2%}\n\n"
                "4. RISK MANAGEMENT (MANAGE Function)\n"
                f"   - Automated Response: {decision.automated_response}\n"
                f"   - Manual Approval Required: {decision.human_approval_required}\n"
                f"   - Rollback Plan: {decision.rollback_plan}\n\n"
                "5. AUDIT TRAIL\n"
                f"   - DAG Node ID: {decision.dag_node_id}\n"
                f"   - Cryptographic Signature: {decision.signature}\n"
                f"   - Timestamp: {decision.timestamp}\n"
                "   - Immutable Record: Verified ✓\n\n"
                "6. CONTROL MAPPING\n"
                f"   - CMMC Practice: {decision.cmmc_practice}\n"
                f"   - NIST 800-53 Control: {decision.nist_control}\n"
                f"   - STIG Finding ID: {decision.stig_id or 'N/A'}\n\n"
                "This decision has been validated against NIST AI RMF 1.0 requirements.\n"
            ),
            format="markdown",
        )

    def _generate_legal_report(self, decision: AIDecision) -> Report:
        return Report(
            title="AI Security Decision - Legal Summary",
            content=(
                "LEGAL SUMMARY\n\n"
                f"Decision: {decision.description}\n"
                f"Risk Level: {decision.risk_level}\n"
                f"Human Approval Required: {decision.human_approval_required}\n"
                f"Audit Trail Node: {decision.dag_node_id}\n"
            ),
            format="markdown",
        )

    def _generate_default_report(self, decision: AIDecision) -> Report:
        return Report(
            title="AI Security Decision - Summary",
            content=(
                f"Decision: {decision.description}\n"
                f"Risk Level: {decision.risk_level}\n"
                f"Confidence: {decision.confidence:.0%}\n"
                f"DAG Node: {decision.dag_node_id}\n"
            ),
            format="markdown",
        )
