"""Unit tests for the User entity.

Rewritten for the 3-role model (OWNER / ADMIN / MEMBER) introduced in
Phase 1 of the SaaS migration. The older test file referenced a 5-role
hierarchy (CEO / MD / OWNER / ADMIN / MEMBER) that predates the rewrite.
"""
import pytest

from contexts.user.domain.entities import User
from contexts.user.domain.value_objects import PRIVILEGED_ROLES, SystemRole


class TestUserEntity:
    def test_create_default_member(self):
        user = User.create(
            user_id="u-001",
            email="alice@example.com",
            name="Alice",
        )
        assert user.user_id == "u-001"
        assert user.email == "alice@example.com"
        assert user.name == "Alice"
        # Default role is MEMBER — explicit creators must opt into
        # elevated roles (the signup handler writes OWNER directly).
        assert user.system_role == SystemRole.MEMBER
        assert user.employee_id is None
        assert user.skills == []
        # create() stamps the same timestamp for both — it's one write,
        # so treat them as equal rather than asserting format
        assert user.created_at == user.updated_at

    def test_create_with_role_and_employee_id(self):
        user = User.create(
            user_id="u-002",
            email="bob@example.com",
            name="Bob",
            system_role=SystemRole.ADMIN,
            employee_id="EMP-0042",
            created_by="u-001",
        )
        assert user.system_role == SystemRole.ADMIN
        assert user.employee_id == "EMP-0042"
        assert user.created_by == "u-001"

    def test_to_dict_roundtrip(self):
        user = User.create(
            user_id="u-003",
            email="carol@example.com",
            name="Carol",
            system_role=SystemRole.OWNER,
        )
        d = user.to_dict()
        assert d["user_id"] == "u-003"
        assert d["system_role"] == "OWNER"
        assert d["email"] == "carol@example.com"
        assert d["skills"] == []
        assert d["avatar_url"] is None

    def test_custom_role_string_accepted(self):
        # Session 8: User.system_role was relaxed from a strict SystemRole
        # enum to a plain string so tenant-defined custom roles can be
        # assigned to users. The domain entity no longer enforces the
        # closed set — that moved to UpdateUserRoleUseCase which validates
        # the incoming role_id against the org's /settings/roles records.
        user = User.create(
            user_id="u-004",
            email="dave@example.com",
            name="Dave",
            system_role="tester",
        )
        assert user.system_role == "tester"

    def test_empty_role_falls_back_to_member(self):
        # The field validator collapses empty/None to MEMBER so a
        # corrupt DDB item doesn't blow up the mapper on load.
        user = User.create(
            user_id="u-005",
            email="eve@example.com",
            name="Eve",
            system_role="",
        )
        assert user.system_role == SystemRole.MEMBER.value


class TestSystemRoleEnum:
    def test_all_three_roles_defined(self):
        # Phase 4 collapsed the legacy 5-role hierarchy into three:
        # OWNER (org-wide admin + billing), ADMIN (org-wide admin minus
        # billing), MEMBER (day-to-day contributor). Custom tenant roles
        # are stored separately (see contexts/org/domain/role.py).
        assert len(SystemRole) == 3
        assert SystemRole.OWNER.value == "OWNER"
        assert SystemRole.ADMIN.value == "ADMIN"
        assert SystemRole.MEMBER.value == "MEMBER"

    def test_privileged_roles_are_owner_and_admin(self):
        # Deprecated compat shim — use `role_has(role, P.XXX)` in new
        # code. Tested here to catch accidental drift.
        assert SystemRole.OWNER.value in PRIVILEGED_ROLES
        assert SystemRole.ADMIN.value in PRIVILEGED_ROLES
        assert SystemRole.MEMBER.value not in PRIVILEGED_ROLES
