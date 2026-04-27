from datetime import datetime, timezone, timedelta

from shared_kernel.response import build_success, build_error
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.permissions import require_feature
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository


def handler(event, context):
    """Return today's birthdays and upcoming birthdays (next 7 days)."""
    try:
        auth = extract_auth_context(event)
        # birthday_wishes is a pure read feature — no separate "create"
        # path. When the OWNER toggles it off, the read endpoint itself
        # is what we gate, so the BirthdayBanner UI sees an empty
        # response (or the FeatureGate hides the affordance entirely).
        require_feature(auth, "birthday_wishes")

        user_repo = UserDynamoRepository()
        users = user_repo.find_all()

        now = datetime.now(timezone.utc)
        today = (now.month, now.day)

        today_birthdays = []
        upcoming_birthdays = []

        for user in users:
            if not user.date_of_birth:
                continue

            try:
                dob = datetime.strptime(user.date_of_birth, "%Y-%m-%d")
            except ValueError:
                continue

            bday_month_day = (dob.month, dob.day)

            user_info = {
                "user_id": user.user_id,
                "name": user.name,
                "avatar_url": user.avatar_url,
                "designation": user.designation,
                "department": user.department,
                "date_of_birth": user.date_of_birth,
            }

            if bday_month_day == today:
                today_birthdays.append(user_info)
            else:
                # Check if birthday is in the next 7 days
                this_year_bday = dob.replace(year=now.year)
                if this_year_bday < now:
                    this_year_bday = dob.replace(year=now.year + 1)

                days_until = (this_year_bday.date() - now.date()).days
                if 1 <= days_until <= 7:
                    user_info["days_until"] = days_until
                    upcoming_birthdays.append(user_info)

        # Sort upcoming by days_until
        upcoming_birthdays.sort(key=lambda x: x["days_until"])

        return build_success(200, {
            "today": today_birthdays,
            "upcoming": upcoming_birthdays,
        })
    except Exception as e:
        return build_error(e)
