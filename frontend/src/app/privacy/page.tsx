import type { Metadata } from 'next'
import {
  LegalShell,
  LegalSection,
  LegalToc,
  LegalContactCard,
} from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Privacy Policy — TaskFlow',
  description:
    'How TaskFlow collects, uses, stores, and protects the personal information of workspace members and end users.',
}

const SECTIONS = [
  { id: 'scope', label: 'Scope of this policy' },
  { id: 'collect', label: 'Information we collect' },
  { id: 'use', label: 'How we use information' },
  { id: 'share', label: 'How information is shared' },
  { id: 'storage', label: 'Storage and retention' },
  { id: 'security', label: 'Security measures' },
  { id: 'rights', label: 'Your rights and choices' },
  { id: 'cookies', label: 'Cookies and tracking' },
  { id: 'children', label: 'Children’s privacy' },
  { id: 'changes', label: 'Changes to this policy' },
  { id: 'contact', label: 'Contacting us' },
]

export default function PrivacyPage() {
  return (
    <LegalShell
      badge="Privacy"
      title="Privacy Policy"
      updated="Last updated: April 22, 2026"
      lead="This Privacy Policy describes how TaskFlow — operated by NEUROSTACK — collects, uses, stores, and protects information in connection with our task management platform, including the web application and desktop companion."
      aside={<LegalToc items={SECTIONS} />}
    >
      <LegalSection id="scope" title="1. Scope of this policy">
        <p>
          This policy applies to information processed by TaskFlow when an
          individual creates a workspace, is invited to an existing workspace,
          signs into the web application, or installs and uses the desktop
          companion. It does not apply to third-party services that a workspace
          administrator may choose to integrate with, which are governed by
          their own privacy practices.
        </p>
        <p>
          Each TaskFlow workspace is operated under the direction of its
          administrators. Those administrators determine which members are
          added, which data is captured, and how long that data is retained
          within the limits established by this policy.
        </p>
      </LegalSection>

      <LegalSection id="collect" title="2. Information we collect">
        <p>We collect the following categories of information:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Account information.</strong> Name, email address, hashed
            password credentials, workspace code, organization name, and role.
          </li>
          <li>
            <strong>Operational data.</strong> Projects, tasks, comments,
            attachments, time-tracking sessions, attendance records, and
            time-off requests that you or your teammates create inside the
            workspace.
          </li>
          <li>
            <strong>Activity data (desktop application).</strong> Aggregate
            keystroke and mouse-event counters recorded during active timer
            sessions. We record event frequency only; we never capture the
            content of keystrokes or the screen contents of other applications.
          </li>
          <li>
            <strong>Periodic screenshots (desktop application).</strong> When a
            timer session is active, the desktop application captures a
            compressed screenshot of the desktop at regular intervals. These
            are uploaded to a storage prefix scoped to your organization.
          </li>
          <li>
            <strong>Diagnostic and log data.</strong> Server logs, error
            traces, API request metadata (timestamp, IP address, user agent)
            retained for the purposes of debugging, abuse prevention, and
            service reliability.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="use" title="3. How we use information">
        <p>We process the information described above to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Provide, maintain, and improve the TaskFlow platform.</li>
          <li>
            Authenticate members, enforce role-based access control, and
            prevent unauthorized access.
          </li>
          <li>
            Generate dashboards, reports, and automated daily summaries
            requested by workspace administrators.
          </li>
          <li>
            Detect, investigate, and respond to security incidents and abusive
            activity.
          </li>
          <li>
            Comply with applicable laws, regulations, and lawful requests from
            public authorities.
          </li>
        </ul>
        <p>
          We do not sell personal information and we do not use the contents
          of your workspace to train machine-learning models.
        </p>
      </LegalSection>

      <LegalSection id="share" title="4. How information is shared">
        <p>TaskFlow shares information only in the following circumstances:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Inside your workspace.</strong> Workspace members see the
            information that their role permits them to see — for example,
            tasks, daily summaries, or time reports assigned to them.
          </li>
          <li>
            <strong>Service providers.</strong> We rely on reputable
            sub-processors — including Amazon Web Services (infrastructure
            hosting, database, object storage), Vercel (web application
            hosting), and Groq (large-language-model inference for daily
            summaries) — strictly to operate the platform.
          </li>
          <li>
            <strong>Legal requirements.</strong> We may disclose information
            when required to comply with applicable law or lawful governmental
            requests, or to protect the rights, property, or safety of TaskFlow,
            our users, or the public.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="storage" title="5. Storage and retention">
        <p>
          Workspace data is stored in the Asia-Pacific (Mumbai) region of
          Amazon Web Services. Each tenant’s records in the primary database
          are prefixed with a unique organization identifier so cross-tenant
          access is architecturally prevented.
        </p>
        <p>
          We retain account and operational data for the lifetime of your
          workspace. Upon deletion of a workspace, we remove associated
          records from production systems within sixty (60) days, subject to
          limited retention for backup, legal, or audit purposes.
        </p>
        <p>
          Workspace administrators may export their data in CSV format at any
          time from inside the application. A full-workspace export covering
          users, projects, tasks, attendance, and time-off records is planned.
        </p>
      </LegalSection>

      <LegalSection id="security" title="6. Security measures">
        <p>
          TaskFlow applies industry-standard safeguards to protect the
          confidentiality and integrity of information in our custody:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Secure Remote Password (SRP) authentication — user passwords never
            leave the browser in plaintext and are never transmitted to our
            servers.
          </li>
          <li>TLS 1.3 encryption for all data in transit.</li>
          <li>
            Server-side encryption at rest for databases, object storage, and
            backups.
          </li>
          <li>
            Least-privilege access controls, audit logging, and per-tenant
            isolation at the presigned-URL layer.
          </li>
        </ul>
        <p>
          No system can be guaranteed one hundred percent secure. If we become
          aware of a security incident affecting your information, we will
          notify you in accordance with applicable law.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="7. Your rights and choices">
        <p>
          Subject to applicable law, you may request access to, correction of,
          or deletion of your personal information. Most operational data can
          be edited or removed directly inside the application by a user with
          the appropriate role. For requests that cannot be fulfilled through
          the product, contact us using the details below.
        </p>
        <p>
          If you are located in a jurisdiction that grants additional rights —
          such as the right to object to processing, to restrict processing,
          or to data portability — we will honor those rights to the extent
          required.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="8. Cookies and tracking">
        <p>
          We use a small number of strictly necessary cookies to keep users
          signed in and to remember interface preferences. We do not use
          advertising or cross-site tracking cookies on the TaskFlow web
          application.
        </p>
      </LegalSection>

      <LegalSection id="children" title="9. Children’s privacy">
        <p>
          TaskFlow is not directed to children under thirteen (13), and we do
          not knowingly collect personal information from children. If you
          believe a child has provided us personal information, please contact
          us so we can remove it.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="10. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we make
          material changes, we will update the “Last updated” date and, where
          required, provide additional notice through the product or by email
          to workspace administrators. Continued use of TaskFlow after an
          update constitutes acceptance of the revised policy.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="11. Contacting us">
        <p>
          Questions about this policy or the handling of your information can
          be directed to{' '}
          <a
            href="mailto:support@neurostack.in"
            className="font-semibold text-primary hover:underline"
          >
            support@neurostack.in
          </a>
          . Please include the workspace code affected by your request to
          help us respond accurately.
        </p>
      </LegalSection>

      <LegalContactCard
        title="Privacy questions?"
        body="Our team reviews every inquiry and responds within one business day."
      />
    </LegalShell>
  )
}
