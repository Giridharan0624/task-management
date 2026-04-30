from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from contexts.integrations.domain.entities import (
    ExternalLink,
    Integration,
    OutboxEntry,
    SyncEvent,
)
from contexts.integrations.domain.value_objects import ItemType


class IIntegrationRepository(ABC):
    @abstractmethod
    def save(self, integration: Integration) -> None: ...

    @abstractmethod
    def find_by_id(self, integration_id: str) -> Optional[Integration]: ...

    @abstractmethod
    def list_for_org(self, org_id: str) -> list[Integration]: ...

    @abstractmethod
    def count_active_for_org(self, org_id: str) -> int: ...

    @abstractmethod
    def update(self, integration: Integration) -> None: ...

    @abstractmethod
    def delete(self, integration_id: str) -> None: ...


class IExternalLinkRepository(ABC):
    @abstractmethod
    def save(self, link: ExternalLink) -> None: ...

    @abstractmethod
    def find_by_external(
        self, provider: str, external_id: str
    ) -> Optional[ExternalLink]: ...

    @abstractmethod
    def find_by_item(
        self, item_type: ItemType, item_id: str
    ) -> list[ExternalLink]: ...

    @abstractmethod
    def update(self, link: ExternalLink) -> None: ...

    @abstractmethod
    def delete(self, provider: str, external_id: str) -> None: ...


class ISyncEventRepository(ABC):
    @abstractmethod
    def save(self, event: SyncEvent, ttl_days: int = 30) -> None: ...

    @abstractmethod
    def list_for_integration(
        self, integration_id: str, limit: int = 50
    ) -> list[SyncEvent]: ...


class IOutboxRepository(ABC):
    @abstractmethod
    def put(self, entry: OutboxEntry, ttl_seconds: int = 300) -> None: ...

    @abstractmethod
    def find(self, integration_id: str, sync_id: str) -> Optional[OutboxEntry]: ...
