"""Register and resolve GovCloud / sovereign cloud validators by provider id."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Type

from govcloud_validation.base import GovCloudValidator

# Provider registry  (id → GovCloudValidator subclass)
_REGISTRY: Dict[str, Type[GovCloudValidator]] = {}

# Stage registry     (stage_id → StageValidator subclass)
_STAGE_REGISTRY: Dict[str, Any] = {}


def register(provider_id_or_cls: Any, cls: Optional[Type[GovCloudValidator]] = None) -> Any:
    """Register a provider validator or decorate a StageValidator subclass.

    Two call forms:

    1. Two-argument — registers a GovCloudValidator provider::

           register("aws-govcloud", AWSGovCloudValidator)

    2. One-argument (class decorator) — registers a StageValidator subclass
       using its ``stage_id`` attribute::

           @register
           class Step06ALambda(StageValidator):
               stage_id = "step_06a_lambda"
               ...
    """
    if cls is None:
        # Decorator form: register(SomeClass)
        klass = provider_id_or_cls
        sid = getattr(klass, "stage_id", None)
        if sid:
            _STAGE_REGISTRY[sid] = klass
        return klass
    else:
        # Two-arg form: register("provider-id", ProviderClass)
        _REGISTRY[provider_id_or_cls] = cls
        return cls


def get_validator(provider_id: str) -> GovCloudValidator:
    if provider_id not in _REGISTRY:
        known = ", ".join(sorted(_REGISTRY)) or "(none)"
        raise KeyError(f"Unknown provider {provider_id!r}. Known: {known}")
    return _REGISTRY[provider_id]()


def get_stage_validator(stage_id: str) -> Any:
    """Return an instantiated StageValidator for *stage_id*, or ``None``."""
    klass = _STAGE_REGISTRY.get(stage_id)
    if klass is None:
        return None
    return klass()


def list_providers() -> List[str]:
    return sorted(_REGISTRY.keys())


def list_stage_validators() -> List[str]:
    return sorted(_STAGE_REGISTRY.keys())
