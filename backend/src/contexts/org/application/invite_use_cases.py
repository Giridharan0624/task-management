"""Invite use cases — send, accept, list, revoke.

Phase 2 invite flow:
  1. OWNER/ADMIN calls POST /orgs/current/invites with {email, role_id}
  2. SendInvite generates a URL-safe token, writes the Invite record,
     writes the global INVITE_TOKEN# lookup, and emails the recipient
     with a link to `/invite/{token}` on the frontend.
  3. Recipient clicks the link, lands on the invite acceptance page,
     fills in name + password, frontend POSTs to /invites/{token}/accept
  4. AcceptInvite resolves token -> org_id, creates the Cognito user
     with the password they chose, writes the User profile to DynamoDB
     scoped under their new org, marks the invite accepted.

Plan limit enforcement: SendInvite counts existing users + pending
unaccepted invites and refuses if the total would exceed the org's
`plan.max_users`.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from pydantic import BaseModel

from contexts.org.domain.default_roles import (
    ADMIN_ROLE_ID, MEMBER_ROLE_ID, OWNER_ROLE_ID,
)
from contexts.org.domain.entities import Invite
from contexts.org.domain.repository import IOrgRepository
from contexts.user.domain.entities import User
from contexts.user.domain.repository import IUserRepository
from contexts.org.domain import permissions as P
from contexts.user.domain.value_objects import SystemRole
from shared_kernel.permissions import role_has
from shared_kernel.errors import (
    AuthorizationError, NotFoundError, ValidationError,
)


INVITE_EXPIRY_DAYS = 7

# Roles that cannot be assigned via invite. OWNER is reserved for signup
# (first user of a new org) and the explicit ownership-transfer flow.
# Every other scope="system" role in the tenant's role records is fair
# game — enforced dynamically in SendInviteUseCase.execute().
INVITE_ROLE_BLOCKLIST = {OWNER_ROLE_ID}


class SendInviteRequest(BaseModel):
    email: str
    role_id: str = MEMBER_ROLE_ID


class AcceptInviteRequest(BaseModel):
    name: str
    password: str


class SendInviteUseCase:
    def __init__(
        self,
        org_repo: IOrgRepository,
        user_repo: IUserRepository,
        email_service=None,
    ) -> None:
        self._org_repo = org_repo
        self._user_repo = user_repo
        self._email = email_service  # may be None for unit tests

    def execute(
        self,
        req: SendInviteRequest,
        caller_user_id: str,
        caller_system_role: str,
        caller_org_id: str,
        app_url: str,
    ) -> dict:
        if not role_has(caller_system_role, P.USER_INVITE):
            raise AuthorizationError("Only owners and admins can invite users.")

        email = req.email.strip().lower()
        role_id = req.role_id.strip().lower()
        if "@" not in email or len(email) > 254:
            raise ValidationError("Invalid email address.")
        if role_id in INVITE_ROLE_BLOCKLIST:
            raise ValidationError(
                "The owner role cannot be assigned via invite. "
                "Use the ownership-transfer flow instead.",
            )
        # Validate against the tenant's live role records so custom
        # system-scope roles defined in /settings/roles can be invited
        # directly. Fail-closed: unknown role_ids reject.
        known_roles = self._org_repo.list_roles(caller_org_id)
        match = next(
            (r for r in known_roles if (r.get("role_id") or "").lower() == role_id),
            None,
        )
        if match is None:
            raise ValidationError(f"Unknown role: {role_id}")
        if match.get("scope", "system") != "system":
            raise ValidationError(
                f"Role '{role_id}' is not a system-scope role and cannot be assigned to a user."
            )

        # Plan-limit check: current active users + pending unaccepted invites
        # must not exceed max_users (None means unlimited).
        plan = self._org_repo.get_plan(caller_org_id)
        if plan and plan.max_users is not None:
            existing_count = len(self._user_repo.find_all())
            pending_count = sum(
                1 for i in self._org_repo.list_invites(caller_org_id)
                if not i.accepted_at
            )
            if existing_count + pending_count >= plan.max_users:
                raise ValidationError(
                    f"Your {plan.tier.value} plan is limited to "
                    f"{plan.max_users} users. Upgrade to invite more."
                )

        # Dupe check: no active invite for the same email in this org
        for existing in self._org_repo.list_invites(caller_org_id):
            if existing.email.lower() == email and not existing.accepted_at:
                raise ValidationError(
                    f"An invite for {email} is already pending. "
                    f"Revoke it first if you want to resend."
                )

        # Caller identity for the email body
        caller_user = self._user_repo.find_by_id(caller_user_id)
        inviter_name = caller_user.name if caller_user else "A teammate"
        org = self._org_repo.find_by_id(caller_org_id)
        org_name = org.name if org else "your workspace"

        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(days=INVITE_EXPIRY_DAYS)).isoformat()

        invite = Invite.create(
            org_id=caller_org_id,
            token=token,
            email=email,
            role_id=role_id,
            invited_by=caller_user_id,
            expires_at=expires_at,
        )
        self._org_repo.save_invite(invite)

        # Best-effort email send — if SMTP fails, the invite still exists
        # in DynamoDB and can be resent via revoke+send or the link can
        # be shared manually.
        if self._email is not None:
            try:
                self._email.send_invite_email(
                    recipient_email=email,
                    inviter_name=inviter_name,
                    org_name=org_name,
                    invite_token=token,
                    role=role_id,
                    app_url=app_url,
                )
            except Exception:
                pass

        return {
            "token": token,
            "email": email,
            "role_id": role_id,
            "expires_at": expires_at,
            "invited_by": caller_user_id,
        }


class AcceptInviteUseCase:
    def __init__(
        self,
        org_repo: IOrgRepository,
        cognito_service=None,
    ) -> None:
        self._org_repo = org_repo
        self._cognito = cognito_service

    def execute(self, token: str, req: AcceptInviteRequest) -> dict:
        name = req.name.strip()
        if not name:
            raise ValidationError("Name is required.")
        if len(req.password) < 8:
            raise ValidationError("Password must be at least 8 characters.")

        invite = self._org_repo.find_invite_by_token(token)
        if not invite:
            raise NotFoundError("Invite not found or has been revoked.")
        if invite.accepted_at:
            raise ValidationError("This invite has already been accepted.")

        # Expiry check
        now = datetime.now(timezone.utc)
        try:
            expires = datetime.fromisoformat(invite.expires_at)
        except ValueError:
            expires = now  # treat malformed as expired
        if now > expires:
            raise ValidationError("This invite has expired. Ask for a new one.")

        # Resolve the org so we can return its slug in the response.
        org = self._org_repo.find_by_id(invite.org_id)
        if not org:
            raise NotFoundError("Invited organization no longer exists.")

        # Map invite role_id to the stored form of `custom:systemRole`.
        # Built-in tiers use the legacy uppercase enum value for
        # backward compat; custom role_ids keep their canonical
        # lowercase form. The pre-token trigger mirrors whatever's stored
        # here into `custom:roleId` (always lowercased) for the
        # permission engine to resolve.
        builtin_map = {
            OWNER_ROLE_ID: SystemRole.OWNER.value,
            ADMIN_ROLE_ID: SystemRole.ADMIN.value,
            MEMBER_ROLE_ID: SystemRole.MEMBER.value,
        }
        system_role = builtin_map.get(invite.role_id, invite.role_id)

        # Create the Cognito user. If this is None (unit tests) fabricate a sub.
        import uuid
        if self._cognito is None:
            user_id = f"test_{uuid.uuid4().hex[:16]}"
        else:
            try:
                user_id = self._cognito.create_user_with_password(
                    email=invite.email,
                    name=name,
                    password=req.password,
                    org_id=invite.org_id,
                    system_role=system_role,
                )
            except Exception:
                # Common case: email already exists in the pool (someone
                # signed up or was invited twice). Let the exception
                # bubble up with the AWS error message.
                raise

        # Write the User profile record. Instantiate repo with explicit
        # org_id since we're in a public (pre-auth) handler — no JWT, so
        # the ContextVar is not set to the invite's org.
        from contexts.user.domain.entities import User
        from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository

        new_user = User.create(
            user_id=user_id,
            email=invite.email,
            name=name,
            # Plain string — User.system_role is no longer enum-typed
            # (Session 8 relaxed it so custom role_ids can be assigned).
            system_role=system_role,
        )
        try:
            user_repo = UserDynamoRepository(org_id=invite.org_id)
            user_repo.save(new_user)
        except Exception:
            # Roll back the Cognito user so the invite email can be retried.
            # By sub (user_id), not email: the alias index may not have
            # propagated for the just-created user, and a delete-by-email
            # would no-op and orphan the login.
            if self._cognito is not None:
                try:
                    self._cognito.rollback_user(user_id)
                except Exception:
                    pass
            raise

        # Mark the invite accepted so the token can't be reused
        self._org_repo.mark_invite_accepted(
            org_id=invite.org_id,
            token=token,
            accepted_at=now.isoformat(),
        )

        return {
            "org_id": invite.org_id,
            "slug": org.slug,
            "user_id": user_id,
            "email": invite.email,
            "redirect_url": f"/login?workspace={org.slug}&first_login=1",
        }
