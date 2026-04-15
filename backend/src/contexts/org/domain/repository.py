from abc import ABC, abstractmethod
from typing import Optional

from contexts.org.domain.entities import Invite, Organization, OrgSettings, Plan


class IOrgRepository(ABC):
    @abstractmethod
    def find_by_id(self, org_id: str) -> Optional[Organization]:
        ...

    @abstractmethod
    def find_by_slug(self, slug: str) -> Optional[Organization]:
        ...

    @abstractmethod
    def save(self, org: Organization) -> None:
        ...

    @abstractmethod
    def save_settings(self, settings: OrgSettings) -> None:
        ...

    @abstractmethod
    def get_settings(self, org_id: str) -> Optional[OrgSettings]:
        ...

    @abstractmethod
    def save_plan(self, plan: Plan) -> None:
        ...

    @abstractmethod
    def get_plan(self, org_id: str) -> Optional[Plan]:
        ...

    @abstractmethod
    def save_invite(self, invite: Invite) -> None:
        ...

    @abstractmethod
    def find_invite_by_token(self, token: str) -> Optional[Invite]:
        ...
