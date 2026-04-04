from __future__ import annotations
from abc import ABC, abstractmethod


class IIdentityService(ABC):
    """Port for identity-provider operations (Cognito, Auth0, etc.)."""

    @abstractmethod
    def create_user(self, email: str, name: str, temp_password: str, system_role: str) -> str:
        """Create a user in the identity provider and return their unique ID."""

    @abstractmethod
    def delete_user(self, email: str) -> None:
        """Delete a user from the identity provider."""

    @abstractmethod
    def update_user_role(self, email: str, system_role: str) -> None:
        """Update the user's role attribute in the identity provider."""
