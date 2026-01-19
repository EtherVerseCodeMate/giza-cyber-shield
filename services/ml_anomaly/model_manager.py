"""NIST AI RMF RECOVER: Model versioning and rollback."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional


@dataclass
class ModelValidation:
    passed: bool
    errors: list[str]


@dataclass
class DeploymentResult:
    success: bool
    version: Optional[str] = None
    validation_report: Optional[ModelValidation] = None
    error: Optional[str] = None
    rollback_performed: bool = False


class ModelValidationError(Exception):
    pass


class ModelManager:
    """
    Manage ML model versions with rollback capability.
    Implements NIST AI RMF RECOVER function.
    """

    def __init__(
        self,
        loader: Callable[[str], object] | None = None,
        validator: Callable[[object], ModelValidation] | None = None,
        deployer: Callable[[object, str], None] | None = None,
        backup: Callable[[], None] | None = None,
        rollback: Callable[[], None] | None = None,
    ) -> None:
        self._loader = loader or (lambda path: path)
        self._validator = validator or (lambda _model: ModelValidation(True, []))
        self._deployer = deployer or (lambda _model, _version: None)
        self._backup = backup or (lambda: None)
        self._rollback = rollback or (lambda: None)

    def deploy_model(self, model_path: str, version: str) -> DeploymentResult:
        """
        Deploy new model version with atomic rollback.
        """
        self._backup()

        try:
            new_model = self._load_model(model_path)
            validation = self._validate_model(new_model)

            if not validation.passed:
                raise ModelValidationError(
                    "; ".join(validation.errors) or "Model validation failed"
                )

            self._deploy_atomic(new_model, version)

            return DeploymentResult(
                success=True,
                version=version,
                validation_report=validation,
            )

        except Exception as exc:  # noqa: BLE001 - rollback safeguard
            self._rollback_to_previous()
            return DeploymentResult(
                success=False,
                error=str(exc),
                rollback_performed=True,
            )

    def _load_model(self, model_path: str) -> object:
        return self._loader(model_path)

    def _validate_model(self, model: object) -> ModelValidation:
        return self._validator(model)

    def _deploy_atomic(self, model: object, version: str) -> None:
        self._deployer(model, version)

    def _backup_current_model(self) -> None:
        self._backup()

    def _rollback_to_previous(self) -> None:
        self._rollback()
