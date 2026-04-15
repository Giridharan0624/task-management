"""Default role identifiers aligned with the existing SystemRole enum.

Full permission matrix lands in Phase 4. During Phase 1 these constants exist
only so signup can assign a role_id to the first OWNER user in a way that
forward-migrates to the Phase 4 model without rewrites.
"""

OWNER_ROLE_ID = "owner"
ADMIN_ROLE_ID = "admin"
MEMBER_ROLE_ID = "member"

DEFAULT_ROLE_IDS = (OWNER_ROLE_ID, ADMIN_ROLE_ID, MEMBER_ROLE_ID)
