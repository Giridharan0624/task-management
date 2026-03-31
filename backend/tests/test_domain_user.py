import pytest
from domain.user.entities import User
from domain.user.value_objects import SystemRole, TOP_TIER_ROLES, PRIVILEGED_ROLES


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
        assert user.system_role == SystemRole.MEMBER
        assert user.employee_id is None
        assert user.skills == []
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
            system_role=SystemRole.CEO,
        )
        d = user.to_dict()
        assert d["user_id"] == "u-003"
        assert d["system_role"] == "CEO"
        assert d["email"] == "carol@example.com"
        assert d["skills"] == []
        assert d["avatar_url"] is None

    def test_invalid_role_rejected(self):
        with pytest.raises(ValueError):
            User.create(
                user_id="u-004",
                email="dave@example.com",
                name="Dave",
                system_role="SUPERUSER",
            )


class TestSystemRoleHierarchy:
    def test_top_tier_roles(self):
        assert SystemRole.OWNER in TOP_TIER_ROLES
        assert SystemRole.CEO in TOP_TIER_ROLES
        assert SystemRole.MD in TOP_TIER_ROLES
        assert SystemRole.ADMIN not in TOP_TIER_ROLES
        assert SystemRole.MEMBER not in TOP_TIER_ROLES

    def test_privileged_roles(self):
        assert SystemRole.OWNER.value in PRIVILEGED_ROLES
        assert SystemRole.CEO.value in PRIVILEGED_ROLES
        assert SystemRole.MD.value in PRIVILEGED_ROLES
        assert SystemRole.ADMIN.value in PRIVILEGED_ROLES
        assert SystemRole.MEMBER.value not in PRIVILEGED_ROLES

    def test_all_roles_defined(self):
        assert len(SystemRole) == 5
