import type { Metadata } from 'next'
import { ShieldCheck, Lock, KeyRound, Layers, AlertTriangle, Eye } from 'lucide-react'
import {
  LegalShell,
  LegalSection,
  LegalToc,
  LegalContactCard,
} from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Security at TaskFlow',
  description:
    'How TaskFlow protects your data — authentication, encryption, tenant isolation, access control, monitoring, and incident response.',
}

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'encryption', label: 'Encryption' },
  { id: 'isolation', label: 'Tenant isolation' },
  { id: 'access-control', label: 'Access control' },
  { id: 'monitoring', label: 'Monitoring and logging' },
  { id: 'incident', label: 'Incident response' },
  { id: 'disclosure', label: 'Vulnerability disclosure' },
  { id: 'roadmap', label: 'Compliance roadmap' },
  { id: 'contact', label: 'Contacting us' },
]

const HIGHLIGHTS = [
  {
    Icon: KeyRound,
    title: 'SRP authentication',
    blurb:
      'Passwords never leave the browser. Credentials are verified via Secure Remote Password, not transmitted to our servers.',
  },
  {
    Icon: Lock,
    title: 'End-to-end encryption in transit',
    blurb:
      'Every connection between the client, the API, and storage enforces TLS 1.3. The desktop application refuses to operate on older TLS versions.',
  },
  {
    Icon: Layers,
    title: 'Architectural tenant isolation',
    blurb:
      'Every database record is prefixed with your organization id. Presigned S3 URLs refuse any key outside your organization prefix.',
  },
  {
    Icon: Eye,
    title: 'No model training on your data',
    blurb:
      'Content inside your workspace is never used to train machine-learning models. AI summaries process only your own session data.',
  },
]

export default function SecurityPage() {
  return (
    <LegalShell
      badge="Security"
      title="Security at TaskFlow"
      updated="Last reviewed: April 22, 2026"
      lead="TaskFlow is built to protect the confidentiality and integrity of every workspace. This page outlines the technical and operational controls we apply, and the responsibilities we hold toward our customers."
      aside={<LegalToc items={SECTIONS} />}
    >
      <LegalSection id="overview" title="1. Overview">
        <p>
          We operate TaskFlow as a single multi-tenant platform that places
          security controls at every layer — from credential handling at the
          browser, to request authorization at the API, to storage isolation
          in our data layer. Below is a summary of the core controls.
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {HIGHLIGHTS.map((h) => (
            <li
              key={h.title}
              className="rounded-2xl border border-border/70 bg-card p-4"
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                <h.Icon className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <p className="text-sm font-bold text-foreground">{h.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {h.blurb}
              </p>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="infrastructure" title="2. Infrastructure">
        <p>
          TaskFlow runs on Amazon Web Services in the Asia-Pacific (Mumbai)
          region. The backend is a Python 3.12 Lambda monolith behind Amazon
          API Gateway, with DynamoDB as the primary database, S3 for object
          storage, CloudFront for content delivery, and Secrets Manager for
          sensitive configuration. The web application is served by Vercel.
        </p>
        <p>
          All production deployments are reproducible from source-controlled
          AWS CDK templates. Infrastructure changes follow a pull-request
          workflow and are verified on an isolated staging environment before
          reaching production.
        </p>
      </LegalSection>

      <LegalSection id="authentication" title="3. Authentication">
        <p>
          User authentication is handled by Amazon Cognito. Passwords are
          never sent in plaintext — TaskFlow implements the Secure Remote
          Password (SRP) protocol, which exchanges only cryptographic proofs
          that are worthless if intercepted.
        </p>
        <p>
          Each session issues a short-lived JSON Web Token that encodes the
          user’s organization id and role. On every authenticated request,
          the backend re-reads the user’s role from the database rather than
          trusting the token claim alone — so role changes take effect
          immediately, without the user needing to sign in again.
        </p>
      </LegalSection>

      <LegalSection id="encryption" title="4. Encryption">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>In transit.</strong> TLS 1.3 is enforced for all client,
            API, and storage connections. Modern cipher suites are required;
            legacy protocols are rejected at the load balancer.
          </li>
          <li>
            <strong>At rest.</strong> DynamoDB and S3 storage are encrypted
            server-side using AWS-managed keys. Backups inherit the same
            encryption properties.
          </li>
          <li>
            <strong>Secrets.</strong> API keys, credentials for upstream
            services, and signing keys are stored in AWS Secrets Manager.
            Application code retrieves secrets at runtime; they are never
            written to disk or embedded in deployment artifacts.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="isolation" title="5. Tenant isolation">
        <p>
          Multi-tenancy is enforced at the data layer rather than at the
          application layer. Every database record is prefixed with the
          customer’s organization identifier, and every authenticated
          request carries that identifier through a request-scoped context
          that is impossible for application code to forge.
        </p>
        <p>
          S3 objects are stored under an organization-scoped prefix. The
          presigned-URL handler validates the target key against the
          requesting user’s organization before signing — a request for an
          object outside your organization fails before a signature is ever
          produced.
        </p>
      </LegalSection>

      <LegalSection id="access-control" title="6. Access control">
        <p>
          TaskFlow implements a three-tier role model — owner, admin, and
          member — plus per-project memberships. Authorization is enforced
          at the application boundary of every endpoint. Endpoints that
          modify organization-wide resources require an owner or admin role
          and are gated by explicit authorization checks, not implicit
          route-prefix conventions.
        </p>
        <p>
          Internal employee access to production data is restricted to
          authorized personnel on a need-to-know basis. Administrative
          access is audited and reviewed periodically.
        </p>
      </LegalSection>

      <LegalSection id="monitoring" title="7. Monitoring and logging">
        <p>
          We monitor the TaskFlow platform for availability, latency, and
          error rates. Security-relevant events — authentication failures,
          authorization denials, unusual access patterns — are logged to a
          separate stream with extended retention. Alerts are configured for
          anomalies that may indicate abuse or compromise.
        </p>
        <p>
          Workspace administrators can review their own audit log from
          within the application, including sign-ins, role changes, and
          destructive actions performed by their members.
        </p>
      </LegalSection>

      <LegalSection id="incident" title="8. Incident response">
        <p>
          In the event of a security incident affecting customer data, we
          follow an internal response plan that prioritizes containment,
          forensics, recovery, and notification. Affected workspace
          administrators are notified in accordance with applicable law and
          the severity of the incident, typically within seventy-two (72)
          hours of confirmation.
        </p>
        <div className="mt-2 flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-foreground/85">
            If you believe you have discovered a security incident or a
            vulnerability in TaskFlow, contact us immediately at{' '}
            <a
              href="mailto:security@neurostack.in"
              className="font-semibold text-primary hover:underline"
            >
              security@neurostack.in
            </a>
            . We will acknowledge receipt within one business day.
          </p>
        </div>
      </LegalSection>

      <LegalSection id="disclosure" title="9. Vulnerability disclosure">
        <p>
          We welcome reports from security researchers. If you believe you
          have discovered a vulnerability, please email{' '}
          <a
            href="mailto:security@neurostack.in"
            className="font-semibold text-primary hover:underline"
          >
            security@neurostack.in
          </a>{' '}
          with a detailed description, reproduction steps, and any supporting
          evidence. Do not disclose the issue publicly until we have had a
          reasonable opportunity to investigate and remediate.
        </p>
        <p>
          We commit to responding to responsible disclosures promptly,
          validating the report, and communicating the outcome back to the
          reporter.
        </p>
      </LegalSection>

      <LegalSection id="roadmap" title="10. Compliance roadmap">
        <p>
          TaskFlow is not yet formally certified against SOC 2, ISO 27001, or
          comparable standards. We design our controls to meet the substance
          of those frameworks and are progressing toward formal attestation
          as the customer base expands. Enterprise customers evaluating
          TaskFlow can request a current security questionnaire at any time.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="11. Contacting us">
        <p className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <span>
            Reach our security team at{' '}
            <a
              href="mailto:security@neurostack.in"
              className="font-semibold text-primary hover:underline"
            >
              security@neurostack.in
            </a>
            . For general questions or customer support, contact{' '}
            <a
              href="mailto:support@neurostack.in"
              className="font-semibold text-primary hover:underline"
            >
              support@neurostack.in
            </a>
            .
          </span>
        </p>
      </LegalSection>

      <LegalContactCard
        title="Need our security questionnaire?"
        body="Enterprise customers evaluating TaskFlow can request our current security documentation and the status of our compliance roadmap."
        email="security@neurostack.in"
      />
    </LegalShell>
  )
}
