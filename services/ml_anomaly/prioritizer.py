"""
SouHimBou AGI - Task Prioritization Engine
"The Scale that Weighs the Urgency of All Things"

Responsibility:
    - Reorder task queue by composite risk score
    - Implement the "Prioritization Agent" from BabyAGI pattern
    - Balance anomaly scores, CVSS, compliance impact, and age

NIST AI RMF Alignment:
    - MANAGE: Risk-based prioritization for resource allocation
    - MEASURE: Quantifiable scoring with audit trail
    - Explainable: Each score component transparent
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any
from .task_recommender import TaskRecommendation, TaskPriority


@dataclass
class PrioritizedTask:
    """Task with computed priority score and breakdown."""
    task: TaskRecommendation
    composite_score: float = 0.0
    score_breakdown: Dict[str, float] = field(default_factory=dict)
    rank: int = 0


@dataclass
class PrioritizationConfig:
    """Configuration for prioritization weights."""
    anomaly_weight: float = 0.30
    cvss_weight: float = 0.25
    compliance_weight: float = 0.20
    business_weight: float = 0.15
    age_weight: float = 0.10

    # Thresholds
    age_boost_hours: float = 1.0  # Tasks older than this get age boost
    max_age_boost_hours: float = 24.0  # Maximum age for full boost

    # Priority multipliers
    priority_multipliers: Dict[TaskPriority, float] = field(default_factory=lambda: {
        TaskPriority.CRITICAL: 1.0,
        TaskPriority.HIGH: 0.75,
        TaskPriority.MEDIUM: 0.5,
        TaskPriority.LOW: 0.25,
    })


class TaskPrioritizer:
    """
    Risk-based task prioritization engine.
    Uses anomaly scores + CVSS + business context.

    Design Principles:
    - Multi-factor: No single metric dominates
    - Transparent: Score breakdown available for audit
    - Configurable: Weights adjustable per deployment
    - Time-aware: Aging tasks gain priority
    """

    def __init__(self, config: Optional[PrioritizationConfig] = None):
        """
        Initialize prioritizer with optional custom config.

        Args:
            config: PrioritizationConfig or None for defaults
        """
        self.config = config or PrioritizationConfig()

    def prioritize(
        self, tasks: List[TaskRecommendation]
    ) -> List[PrioritizedTask]:
        """
        Reorder tasks by composite risk score.

        Args:
            tasks: List of TaskRecommendation objects

        Returns:
            List of PrioritizedTask sorted by score (highest first)
        """
        prioritized = []

        for task in tasks:
            score, breakdown = self._calculate_score(task)
            prioritized.append(PrioritizedTask(
                task=task,
                composite_score=score,
                score_breakdown=breakdown,
            ))

        # Sort by composite score (descending)
        prioritized.sort(key=lambda p: p.composite_score, reverse=True)

        # Assign ranks
        for i, p in enumerate(prioritized):
            p.rank = i + 1

        return prioritized

    def _calculate_score(
        self, task: TaskRecommendation
    ) -> tuple[float, Dict[str, float]]:
        """
        Calculate composite priority score for a task.

        Returns:
            Tuple of (total_score, breakdown_dict)
        """
        breakdown: Dict[str, float] = {}

        # 1. Anomaly contribution (0-1 normalized)
        anomaly_component = task.anomaly_score * self.config.anomaly_weight
        breakdown["anomaly"] = anomaly_component

        # 2. CVSS contribution (0-10 normalized to 0-1)
        if task.cvss_score is not None:
            cvss_normalized = task.cvss_score / 10.0
            cvss_component = cvss_normalized * self.config.cvss_weight
        else:
            # Default based on priority if no CVSS
            cvss_component = self.config.priority_multipliers.get(
                task.priority, 0.5
            ) * self.config.cvss_weight * 0.5
        breakdown["cvss"] = cvss_component

        # 3. Compliance/Priority impact
        priority_value = self.config.priority_multipliers.get(
            task.priority, 0.5
        )
        compliance_component = priority_value * self.config.compliance_weight
        breakdown["compliance"] = compliance_component

        # 4. Business criticality (based on affected systems)
        if task.affected_systems >= 10:
            business_value = 1.0
        elif task.affected_systems >= 5:
            business_value = 0.75
        elif task.affected_systems >= 2:
            business_value = 0.5
        else:
            business_value = 0.25
        business_component = business_value * self.config.business_weight
        breakdown["business"] = business_component

        # 5. Time sensitivity (age boost)
        age_hours = self._get_task_age_hours(task)
        if age_hours > self.config.age_boost_hours:
            age_ratio = min(
                age_hours / self.config.max_age_boost_hours,
                1.0
            )
            age_component = age_ratio * self.config.age_weight
        else:
            age_component = 0.0
        breakdown["age"] = age_component

        # Total score
        total = sum(breakdown.values())

        # Apply confidence modifier (reduce score for low-confidence tasks)
        confidence_modifier = 0.5 + (task.confidence * 0.5)  # Range: 0.5-1.0
        total *= confidence_modifier
        breakdown["confidence_modifier"] = confidence_modifier

        return total, breakdown

    def _get_task_age_hours(self, task: TaskRecommendation) -> float:
        """Calculate task age in hours."""
        now = datetime.now()
        delta = now - task.created_at
        return delta.total_seconds() / 3600.0

    def get_top_n(
        self, tasks: List[TaskRecommendation], n: int = 5
    ) -> List[PrioritizedTask]:
        """
        Get top N highest priority tasks.

        Args:
            tasks: List of tasks to prioritize
            n: Number of top tasks to return

        Returns:
            Top N PrioritizedTask objects
        """
        prioritized = self.prioritize(tasks)
        return prioritized[:n]

    def explain_priority(self, prioritized_task: PrioritizedTask) -> str:
        """
        Generate human-readable explanation of priority score.

        Args:
            prioritized_task: PrioritizedTask with score breakdown

        Returns:
            Formatted explanation string
        """
        task = prioritized_task.task
        breakdown = prioritized_task.score_breakdown

        lines = [
            f"PRIORITY ANALYSIS: {task.description}",
            f"{'=' * 50}",
            f"Composite Score: {prioritized_task.composite_score:.3f}",
            f"Rank: #{prioritized_task.rank}",
            "",
            "Score Components:",
        ]

        component_names = {
            "anomaly": "Anomaly Risk",
            "cvss": "Vulnerability Severity",
            "compliance": "Compliance Impact",
            "business": "Business Criticality",
            "age": "Time Sensitivity",
        }

        for key, name in component_names.items():
            value = breakdown.get(key, 0)
            bar_length = int(value * 20)
            bar = "#" * bar_length + "-" * (20 - bar_length)
            lines.append(f"  {name:.<25} [{bar}] {value:.3f}")

        confidence = breakdown.get("confidence_modifier", 1.0)
        lines.append(f"\nConfidence Modifier: {confidence:.2f}")
        lines.append(f"Adinkra Symbol: {task.symbol.value}")
        lines.append(f"Source: {task.source}")

        return "\n".join(lines)

    def rebalance_weights(
        self, feedback: Dict[str, float]
    ) -> None:
        """
        Adjust weights based on operational feedback.
        Used for continuous improvement of prioritization.

        Args:
            feedback: Dictionary with weight adjustments
                e.g., {"anomaly": 0.05, "cvss": -0.02}
        """
        if "anomaly" in feedback:
            self.config.anomaly_weight = max(0.0, min(1.0,
                self.config.anomaly_weight + feedback["anomaly"]
            ))

        if "cvss" in feedback:
            self.config.cvss_weight = max(0.0, min(1.0,
                self.config.cvss_weight + feedback["cvss"]
            ))

        if "compliance" in feedback:
            self.config.compliance_weight = max(0.0, min(1.0,
                self.config.compliance_weight + feedback["compliance"]
            ))

        if "business" in feedback:
            self.config.business_weight = max(0.0, min(1.0,
                self.config.business_weight + feedback["business"]
            ))

        if "age" in feedback:
            self.config.age_weight = max(0.0, min(1.0,
                self.config.age_weight + feedback["age"]
            ))

        # Normalize weights to sum to 1.0
        self._normalize_weights()

    def _normalize_weights(self) -> None:
        """Normalize weights to sum to 1.0."""
        total = (
            self.config.anomaly_weight +
            self.config.cvss_weight +
            self.config.compliance_weight +
            self.config.business_weight +
            self.config.age_weight
        )

        if total > 0:
            self.config.anomaly_weight /= total
            self.config.cvss_weight /= total
            self.config.compliance_weight /= total
            self.config.business_weight /= total
            self.config.age_weight /= total

    def get_config_snapshot(self) -> Dict[str, Any]:
        """
        Get current configuration for audit trail.

        Returns:
            Dictionary of current configuration values
        """
        return {
            "weights": {
                "anomaly": self.config.anomaly_weight,
                "cvss": self.config.cvss_weight,
                "compliance": self.config.compliance_weight,
                "business": self.config.business_weight,
                "age": self.config.age_weight,
            },
            "thresholds": {
                "age_boost_hours": self.config.age_boost_hours,
                "max_age_boost_hours": self.config.max_age_boost_hours,
            },
            "priority_multipliers": {
                p.value: v for p, v in self.config.priority_multipliers.items()
            },
        }
