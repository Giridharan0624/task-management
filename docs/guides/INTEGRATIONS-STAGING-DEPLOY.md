# Integrations — Staging Deploy Checklist

One-page checklist for deploying the integration platform to the staging
stack and verifying it end-to-end. Open this in a side pane while running
the deploy.

> Time budget: ~10 min for steps 1–6 (deploy + smoke test), +15 min for
> the Freshdesk dev-account dance (steps 7–10).
>
> Profile: **default** (personal AWS account) per the staging-deploy memory.

---

## 0. Pre-flight (already verified, recorded here for the record)

- ✅ `cdk synth --app "python app_staging.py"` generates 4 templates
  (parent + Org/Workflow/Integrations nested) cleanly. Verified offline
  before this checklist was written.
- ✅ All 92 backend tests pass.
- ✅ `app_staging.py` has `integrations_enabled: True`.
- ✅ Prod entry points (`app.py`, `app_company.py`) untouched — no
  `integrations_enabled` flag set.

## 1. Deploy

```bash
cd backend/cdk

# First-time only (idempotent if already bootstrapped)
cdk bootstrap

# Deploy
cdk deploy --app "python app_staging.py"
```

Expect ~3–4 minutes. You'll see CFN events for the parent stack and the
Org/Workflow/Integrations nested stacks.

## 2. Capture the new outputs

The deploy prints a block like:

```
task-management-staging.IntegrationsIntegrationsApiUrl... = https://abc123.execute-api.ap-south-1.amazonaws.com/staging/
task-management-staging.IntegrationsIntegrationsOutboundQueueUrl... = https://sqs.ap-south-1.amazonaws.com/.../IntegrationsOutboundQueue...
task-management-staging.IntegrationsIntegrationsCredKmsKeyId... = abcd1234-...
```

Copy these into your scratch notes:

```
INTEGRATIONS_API_URL=___
INTEGRATIONS_OUTBOUND_QUEUE_URL=___
INTEGRATIONS_CRED_KMS_KEY_ID=___
```

## 3. Run smoke test (no JWT yet)

```bash
export INTEGRATIONS_API_URL="https://abc123.execute-api.ap-south-1.amazonaws.com/staging"
./scripts/integrations_smoke.sh
```

Expect checks 1 and 2 to pass; checks 3 and 4 will print SKIPPED (need a
JWT). If checks 1 or 2 fail, **stop** — the deploy is broken and the rest
won't help.

## 4. Wire frontend env

Edit `frontend/.env.local` (local dev) AND set in Vercel staging project:

```
NEXT_PUBLIC_INTEGRATIONS_API_URL=<paste IntegrationsApiUrl, no trailing slash>
```

Re-run `npm run dev` (or trigger a Vercel redeploy).

## 5. Authenticated smoke test

In the staging frontend, log in to a Pro-plan workspace. Open browser
DevTools → Application → Local Storage → copy the `auth_token` value.

```bash
export TASKFLOW_JWT="<paste auth_token>"
./scripts/integrations_smoke.sh
```

Now all 4 checks should pass and print `ALL CHECKS PASSED`.

## 6. Verify the UI catalog renders Freshdesk

In the staging frontend: **Settings → Integrations → Browse providers**.
You should see Freshdesk listed with capability badges.

## 7. Sign up for a free Freshdesk dev account

1. Go to https://freshworks.com/freshdesk/signup-free/
2. Sign up with a throwaway email. You get a 21-day free trial.
3. Note the subdomain — your URL is `<subdomain>.freshdesk.com`.
4. **Profile (top-right avatar) → Profile Settings → API Key** — copy.

## 8. Connect Freshdesk to the staging workspace

In the staging frontend:

1. Settings → Integrations → Browse → Freshdesk → **Connect**.
2. Paste subdomain, API key, leave Product as `Freshdesk`.
3. Submit — you should land on the success screen with:
   - **Webhook URL** to copy
   - **Bearer token** (one-time) to copy
   - The Freshdesk Workflow Automator setup guide

## 9. Configure the Workflow Automator rule in Freshdesk

In your Freshdesk:

1. **Admin → Workflows → Workflow Automator → New Rule** (Ticket Updates tab).
2. Trigger: *Ticket is created or updated*.
3. Action: **Trigger Webhook**.
4. Paste the URL from step 8 into the URL field.
5. Method: **POST**, Encoding: **JSON**.
6. Add custom header `Authorization` with value `Bearer <token from step 8>`.
7. Body (paste the template the success screen shows):
   ```json
   {
     "ticket_id": "{{ticket.id}}",
     "event": "{{Triggered event}}",
     "subdomain": "{{helpdesk_name}}",
     "updated_at": "{{ticket.updated_at}}"
   }
   ```
8. **Save** the rule.

## 10. End-to-end verification

1. In Freshdesk, **create a new ticket** (Tickets → New Ticket).
2. Wait ~5 seconds.
3. In the staging TaskFlow workspace, navigate to the linked project (or
   the My Tasks view if no project was specified).
4. **A new task should appear**, mirroring the ticket subject + status +
   priority. Assignee is set if your Freshdesk agent's email matches a
   TaskFlow user.

If the task does not appear:

- Check **CloudWatch Logs** for the `WebhookRouterFn` and `SyncWorkerFn`
  Lambdas for errors.
- Check **DynamoDB** `TaskManagementTable-staging` for SK pattern
  `INTEGRATION#<id>#EVENT#...` rows — those are the audit trail of every
  inbound webhook.
- Check the **integrations-sync-events DLQ** in SQS for poisoned
  messages.

## 11. Update todo list

When end-to-end passes, mark these phases complete in the integration
plan TODO:

- 1a.5 — staging connect/disconnect verified
- 1b.6 — inbound flow verified
- 1d.6 — UI dogfood done

(Outbound flow, 1c.5, gets verified by editing the linked task in
TaskFlow and confirming the Freshdesk ticket reflects the change.)
