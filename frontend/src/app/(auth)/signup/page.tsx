import { redirect } from 'next/navigation'

/**
 * Self-service signup is TEMPORARILY DISABLED.
 *
 * The authoritative gate is server-side: `POST /signup` returns 403 whenever a
 * deployment sets `signup_enabled: False` (backend/cdk/app_company_v2.py ->
 * SIGNUP_ENABLED -> contexts/org/handlers/signup_org.py). That route is public,
 * so the server is the control — this page merely stops users landing on a form
 * that cannot succeed.
 *
 * Redirect rather than delete: marketing CTAs across the landing, download, and
 * header components still link to /signup, so this keeps every one of those
 * links working instead of 404-ing.
 *
 * TO RE-ENABLE (both steps needed):
 *   1. backend: set `signup_enabled: True` (or drop the key) in the CDK app
 *      config and redeploy.
 *   2. frontend: revert this file. The form itself is untouched and still lives
 *      in `@/components/auth/SignupForm`.
 */
export default function SignupPage() {
  redirect('/login')
}
