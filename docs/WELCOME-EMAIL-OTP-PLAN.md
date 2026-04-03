# Welcome Email + One-Time Password + Force Password Change

## Overview

When an admin creates a new user, the system will:
1. Auto-generate a one-time password (OTP)
2. Create the user in Cognito with the OTP as a temporary password
3. Send a branded welcome email with credentials and login link
4. On first login, force the user to create their own password
5. After password creation, redirect to the dashboard

**No admin needs to manually create or share passwords.**

---

## Current Flow vs New Flow

### Current Flow (Problems)
```
Admin creates user → Sets password manually → Tells user the password verbally/chat
                                            → No email sent
                                            → User logs in with that password forever
```
**Issues:** Insecure (password shared verbally), no email trail, no forced password change.

### New Flow (Solution)
```
Admin creates user (no password needed)
  ↓
Backend auto-generates 12-char OTP
  ↓
Creates Cognito user with OTP as TemporaryPassword
(User is in FORCE_CHANGE_PASSWORD state)
  ↓
Sends welcome email via SES:
  ┌─────────────────────────────────┐
  │  Welcome to TaskFlow!           │
  │                                 │
  │  Name: Mohammed Asfar           │
  │  Employee ID: NS-DEV-26A7K3    │
  │  Email: asfar@gmail.com         │
  │  One-Time Password: Xk9mP2wR4n │
  │                                 │
  │  [Log In to TaskFlow →]         │
  │                                 │
  │  This password expires in 7 days│
  │  Powered by NEUROSTACK          │
  └─────────────────────────────────┘
  ↓
User receives email → Clicks login link
  ↓
Enters email/EMP-ID + OTP on login page
  ↓
Cognito returns NEW_PASSWORD_REQUIRED challenge
  ↓
Frontend shows "Create Your Password" form
  ┌─────────────────────────────────┐
  │  Create Your Password           │
  │                                 │
  │  New Password: [••••••••••] 👁  │
  │  Confirm:      [••••••••••] 👁  │
  │                                 │
  │  Requirements:                  │
  │  ✓ At least 8 characters        │
  │  ✓ 1 uppercase letter           │
  │  ✓ 1 lowercase letter           │
  │  ✓ 1 number                     │
  │  ✓ Passwords match              │
  │                                 │
  │  [Set Password]                 │
  └─────────────────────────────────┘
  ↓
User sets own password → Cognito confirms → Redirect to Dashboard
```

---

## Technical Implementation

### Phase 1: Backend Changes

#### 1.1 OTP Generation
**File:** `backend/src/application/user/use_cases.py`

```python
import secrets
import string

def _generate_otp(length=12) -> str:
    """Generate a random OTP that meets Cognito password policy."""
    alphabet = string.ascii_uppercase + string.ascii_lowercase + string.digits
    while True:
        otp = ''.join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.isupper() for c in otp) and
            any(c.islower() for c in otp) and
            any(c.isdigit() for c in otp)):
            return otp
```

- Uses `secrets` module (cryptographically secure)
- 12 characters: uppercase + lowercase + digits
- Validates against Cognito policy before returning
- Example output: `Xk9mP2wR4nBj`

#### 1.2 Remove Password from User Creation
**File:** `backend/src/handlers/user/create_user.py`

Remove `password` from the request model:
```python
class CreateUserRequest(BaseModel):
    email: str
    name: str
    system_role: str = "MEMBER"
    department: str
    # password field REMOVED
```

#### 1.3 Update CreateUserUseCase
**File:** `backend/src/application/user/use_cases.py`

Changes:
- Remove `password = dto["password"]` — no longer provided by admin
- Generate OTP: `otp = _generate_otp()`
- Pass OTP to Cognito as temporary password
- **Remove** `self._cognito.set_permanent_password(email, password)` — user stays in `FORCE_CHANGE_PASSWORD` state
- Send welcome email via SES after DynamoDB save

#### 1.4 Remove set_permanent_password from Cognito Service
**File:** `backend/src/infrastructure/cognito/cognito_service.py`

Delete the `set_permanent_password` method. The `create_user` method already uses `TemporaryPassword` with `MessageAction="SUPPRESS"`. Without `set_permanent_password`, the user stays in `FORCE_CHANGE_PASSWORD` state — exactly what we want.

#### 1.5 Create Email Service (SES)
**New files:**
- `backend/src/infrastructure/email/__init__.py`
- `backend/src/infrastructure/email/ses_service.py`
- `backend/src/infrastructure/email/email_templates.py`

**Welcome email template includes:**
- TaskFlow branding header (indigo gradient)
- "Welcome to TaskFlow, {name}!" greeting
- Credentials box: Employee ID, Email, One-Time Password
- "Log In to TaskFlow" button linking to `{APP_URL}/login`
- Password requirements note
- "This password expires in 7 days" warning
- "Powered by NEUROSTACK" footer

#### 1.6 CDK Stack Updates
**File:** `backend/cdk/stack.py`

- Add `SENDER_EMAIL` and `APP_URL` environment variables to CreateUser Lambda
- Add SES `SendEmail` IAM permission to CreateUser Lambda
- Remove `AdminSetUserPassword` from Cognito policies (no longer needed)

---

### Phase 2: Frontend Changes

#### 2.1 Handle NEW_PASSWORD_REQUIRED in Cognito Client
**File:** `frontend/src/lib/auth/cognitoClient.ts`

The `authenticateUser` method from `amazon-cognito-identity-js` supports a `newPasswordRequired` callback. Currently only `onSuccess` and `onFailure` are handled.

**Add:**
```typescript
// Return type becomes a union:
type SignInResult =
  | { type: 'SUCCESS'; tokens: AuthTokens }
  | { type: 'NEW_PASSWORD_REQUIRED'; cognitoUser: CognitoUser; userAttributes: Record<string, string> }

// New function to complete the challenge:
function completeNewPassword(cognitoUser, newPassword, userAttributes): Promise<AuthTokens>
```

The `newPasswordRequired` callback is called by Cognito when the user is in `FORCE_CHANGE_PASSWORD` state. We capture the `cognitoUser` instance (needed to complete the challenge) and resolve the promise with a discriminated result.

#### 2.2 Update Auth Provider
**File:** `frontend/src/lib/auth/AuthProvider.tsx`

Add new state and functions:
- `pendingPasswordChange` state — holds the Cognito user instance
- `needsPasswordChange` boolean — derived from state
- `completePasswordChange(newPassword)` function — calls `completeNewPassword`, stores tokens, sets user

**Flow:**
1. User calls `signIn(email, otp)`
2. If result is `NEW_PASSWORD_REQUIRED` → set `pendingPasswordChange` state, don't set tokens yet
3. Login form detects `needsPasswordChange` → shows "Create Password" form
4. User submits new password → calls `completePasswordChange(newPassword)`
5. Tokens received → stored in localStorage → user state set → redirect to dashboard

#### 2.3 Update Login Form — Two-Phase UI
**File:** `frontend/src/components/auth/LoginForm.tsx`

**Phase 1 (Default):** Current login form — Email/Employee ID + Password (OTP)
**Phase 2 (Password Change):** When `needsPasswordChange` is true:
- "Create Your Password" heading
- New Password field (with eye toggle)
- Confirm Password field (with eye toggle)
- Live password requirements checklist:
  - ✓/✗ At least 8 characters
  - ✓/✗ 1 uppercase letter
  - ✓/✗ 1 lowercase letter
  - ✓/✗ 1 number
  - ✓/✗ Passwords match
- "Set Password" button (disabled until all requirements met)

#### 2.4 Update Login Page Heading
**File:** `frontend/src/app/(auth)/login/page.tsx`

Conditionally change:
- "Welcome back" → "Create Your Password" (when `needsPasswordChange`)
- "Sign in to continue to your workspace" → "Please set a new password to continue"

#### 2.5 Remove Password from Admin Create User
**File:** `frontend/src/app/(dashboard)/admin/users/page.tsx`

- Remove password input field from the Add User modal
- Remove `newPassword` state variable
- Remove password validation
- Add success message: "Welcome email sent to {email}" after user creation
- Update `createUserMutation` data to exclude password

#### 2.6 Update API Types
**File:** `frontend/src/lib/api/userApi.ts`

Remove `password` from `createUser` function parameter type.

---

### Phase 3: SES Setup (Manual/Operational)

1. **Verify sender email in SES** (ap-south-1):
   - Go to AWS Console → SES → Verified Identities
   - Add email address (e.g., `noreply@neurostack.in`)
   - Click verification link sent to that email

2. **Request production access** (if in SES sandbox):
   - SES sandbox only allows sending to verified emails
   - Submit production access request via AWS Console
   - Typically approved within 24 hours

3. **Set environment variables** in CDK stack:
   - `SENDER_EMAIL` = verified SES email
   - `APP_URL` = frontend URL (e.g., `https://taskflow.neurostack.in`)

---

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| SES fails to send email | User is created but email not sent. Admin sees warning. Can resend manually. |
| OTP expires (7 days default) | Admin needs to reset via "Resend Welcome Email" button (future feature) |
| User enters wrong OTP | Cognito returns auth error, same as wrong password |
| User's email doesn't exist | Create user fails at Cognito level |
| Duplicate email | Caught by existing email uniqueness check |
| Employee ID login + OTP | Works via existing `/resolve-employee` → email → Cognito auth |
| Existing users (already confirmed) | Unaffected — they don't see FORCE_CHANGE_PASSWORD |
| Admin tries to set password | Can't — password field removed from UI and API |

---

## Files to Modify

### Backend (6 files + 3 new)
| File | Action |
|------|--------|
| `backend/src/application/user/use_cases.py` | Modify — OTP generation, remove password, add email sending |
| `backend/src/infrastructure/cognito/cognito_service.py` | Modify — Remove `set_permanent_password` |
| `backend/src/handlers/user/create_user.py` | Modify — Remove password from request, wire email service |
| `backend/cdk/stack.py` | Modify — SES permissions, env vars |
| `backend/src/domain/user/identity_service.py` | Modify — Remove `set_permanent_password` from interface |
| `backend/src/infrastructure/email/__init__.py` | **New** — Package init |
| `backend/src/infrastructure/email/ses_service.py` | **New** — SES send email |
| `backend/src/infrastructure/email/email_templates.py` | **New** — HTML + text templates |

### Frontend (7 files)
| File | Action |
|------|--------|
| `frontend/src/lib/auth/cognitoClient.ts` | Modify — Handle `newPasswordRequired` challenge |
| `frontend/src/lib/auth/AuthProvider.tsx` | Modify — Add password change state + function |
| `frontend/src/components/auth/LoginForm.tsx` | Modify — Two-phase UI (login → create password) |
| `frontend/src/app/(auth)/login/page.tsx` | Modify — Conditional heading |
| `frontend/src/app/(dashboard)/admin/users/page.tsx` | Modify — Remove password field |
| `frontend/src/lib/api/userApi.ts` | Modify — Remove password from createUser |
| `frontend/src/lib/hooks/useUsers.ts` | Modify — Remove password from mutation type |

---

## Security Benefits

1. **No shared passwords** — Admin never sees the real password
2. **One-time use** — OTP only works once (Cognito enforces this)
3. **Auto-expiry** — OTP expires in 7 days if unused
4. **User-owned password** — Only the user knows their permanent password
5. **Email verification** — User must have access to their email to get the OTP
6. **Audit trail** — Email is logged via SES, creation tracked in DynamoDB
7. **Cognito-enforced** — Password requirements validated by Cognito, not custom code

---

## Cost

| Component | Cost |
|-----------|------|
| SES emails | $0.10 per 1000 emails |
| Lambda invocations | Negligible (same as current) |
| DynamoDB | No change (no new entities) |
| **Total** | ~$0.01 per new user |
