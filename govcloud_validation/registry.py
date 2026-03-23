"""Register and resolve GovCloud / sovereign cloud validators by provider id."""

from __future__ import annotations

from typing import Dict, List, Type

from govcloud_validation.base import GovCloudValidator

_REGISTRY: Dict[str, Type[GovCloudValidator]] = {}


def register(provider_id: str, cls: Type[GovCloudValidator]) -> None:
    _REGISTRY[provider_id] = cls


def get_validator(provider_id: str) -> GovCloudValidator:
    if provider_id not in _REGISTRY:
        known = ", ".join(sorted(_REGISTRY)) or "(none)"
        raise KeyError(f"Unknown provider {provider_id!r}. Known: {known}")
    return _REGISTRY[provider_id]()


def list_providers() -> List[str]:
    return sorted(_REGISTRY.keys())
