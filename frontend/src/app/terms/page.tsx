import type { Metadata } from 'next'
import {
  LegalShell,
  LegalSection,
  LegalToc,
  LegalContactCard,
} from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Terms of Service — TaskFlow',
  description:
    'The terms that govern use of the TaskFlow platform, including the web application and desktop companion.',
}

const SECTIONS = [
  { id: 'acceptance', label: 'Acceptance of terms' },
  { id: 'eligibility', label: 'Eligibility and accounts' },
  { id: 'use', label: 'Acceptable use' },
  { id: 'content', label: 'Content and ownership' },
  { id: 'fees', label: 'Fees and billing' },
  { id: 'availability', label: 'Service availability' },
  { id: 'termination', label: 'Termination' },
  { id: 'warranties', label: 'Disclaimer of warranties' },
  { id: 'liability', label: 'Limitation of liability' },
  { id: 'indemnification', label: 'Indemnification' },
  { id: 'governing', label: 'Governing law' },
  { id: 'contact', label: 'Contacting us' },
]

export default function TermsPage() {
  return (
    <LegalShell
      badge="Terms"
      title="Terms of Service"
      updated="Last updated: April 22, 2026"
      lead="These Terms of Service govern your access to and use of the TaskFlow platform. By creating a workspace, accepting an invitation, or using the service in any other way, you agree to these terms."
      aside={<LegalToc items={SECTIONS} />}
    >
      <LegalSection id="acceptance" title="1. Acceptance of terms">
        <p>
          By accessing or using TaskFlow, you agree to be bound by these
          Terms of Service. If you are entering into these terms on behalf of
          an organization, you represent that you have the authority to bind
          that organization to these terms. If you do not agree, you must not
          access or use the service.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title="2. Eligibility and accounts">
        <p>
          You must be at least eighteen (18) years of age to create a
          workspace. Workspace administrators are responsible for the
          activities of members they invite and for ensuring those members
          comply with these terms.
        </p>
        <p>
          You agree to provide accurate and current account information and
          to maintain the confidentiality of your credentials. You are
          responsible for all activity conducted under your account.
        </p>
      </LegalSection>

      <LegalSection id="use" title="3. Acceptable use">
        <p>You may not, and may not permit anyone else to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Use the service to store, process, or transmit content that is
            unlawful, infringing, defamatory, or harmful to others.
          </li>
          <li>
            Attempt to reverse engineer, decompile, or otherwise discover the
            source code of any part of the service, except to the extent
            permitted by applicable law.
          </li>
          <li>
            Interfere with or disrupt the integrity or performance of the
            service, or the data it contains.
          </li>
          <li>
            Circumvent authentication, access control, or tenant-isolation
            boundaries — attempt to obtain access to data you are not
            authorized to view.
          </li>
          <li>
            Use the service to build a competing product or to benchmark
            performance without our written consent.
          </li>
          <li>
            Send automated high-volume requests that exceed published or
            reasonable rate limits.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="content" title="4. Content and ownership">
        <p>
          Your organization retains all rights, title, and interest in the
          content that workspace members upload or create in TaskFlow
          (&ldquo;Customer Content&rdquo;). You grant us a worldwide,
          royalty-free license to host, copy, transmit, and display Customer
          Content solely to the extent necessary to provide the service.
        </p>
        <p>
          TaskFlow, including its software, visual interfaces, trademarks,
          and underlying intellectual property, is owned by NEUROSTACK and
          protected by applicable intellectual property laws. These terms do
          not grant you any rights to our trademarks, logos, or brand
          elements.
        </p>
      </LegalSection>

      <LegalSection id="fees" title="5. Fees and billing">
        <p>
          TaskFlow is currently offered at no cost for all workspaces. We
          reserve the right to introduce paid plans for additional capacity,
          enterprise features, or compliance add-ons. Workspaces created
          while the service is free will remain on the Free plan unless the
          administrator opts into a paid plan.
        </p>
        <p>
          If paid plans are introduced, specific pricing, billing cycles, and
          refund terms will be made available within the application before
          payment is collected.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="6. Service availability">
        <p>
          We strive to keep TaskFlow available and performant. Scheduled
          maintenance, incident response, force majeure events, and
          dependencies on upstream service providers may result in planned
          or unplanned downtime. We will make reasonable efforts to notify
          workspace administrators in advance of planned maintenance.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="7. Termination">
        <p>
          You may terminate your workspace at any time by deleting it from
          within the application. Upon termination, your right to access the
          service ends. We will delete associated records from production
          systems within sixty (60) days, subject to limited retention for
          backup, legal, or audit purposes.
        </p>
        <p>
          We may suspend or terminate access if we reasonably believe you
          have violated these terms, if required by law, or to protect the
          service or its users. Where feasible, we will provide advance
          notice before suspension.
        </p>
      </LegalSection>

      <LegalSection id="warranties" title="8. Disclaimer of warranties">
        <p>
          The service is provided on an &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; basis, without warranties of any kind, either
          express or implied, including without limitation implied warranties
          of merchantability, fitness for a particular purpose, or
          non-infringement. We do not warrant that the service will be
          uninterrupted, error-free, or free from harmful components.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="9. Limitation of liability">
        <p>
          To the maximum extent permitted by law, NEUROSTACK and its
          affiliates, officers, employees, and agents shall not be liable for
          any indirect, incidental, special, consequential, or punitive
          damages, or for any loss of profits, revenues, data, or goodwill
          arising out of or in connection with your use of the service,
          whether based on contract, tort, negligence, strict liability, or
          any other legal theory.
        </p>
        <p>
          Our aggregate liability for any claim arising out of or relating to
          these terms will not exceed the greater of (a) the amount you paid
          us during the twelve (12) months preceding the claim, or (b) one
          hundred U.S. dollars (USD 100).
        </p>
      </LegalSection>

      <LegalSection id="indemnification" title="10. Indemnification">
        <p>
          You agree to defend, indemnify, and hold harmless NEUROSTACK and
          its affiliates from any claims, damages, liabilities, and expenses
          arising out of or related to (i) your use of the service in
          violation of these terms, or (ii) Customer Content that infringes a
          third party’s rights.
        </p>
      </LegalSection>

      <LegalSection id="governing" title="11. Governing law">
        <p>
          These terms are governed by and construed in accordance with the
          laws of India, without regard to its conflict of law principles.
          Any dispute arising out of or relating to these terms shall be
          subject to the exclusive jurisdiction of the competent courts in
          Chennai, India.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="12. Contacting us">
        <p>
          Questions about these terms can be directed to{' '}
          <a
            href="mailto:support@neurostack.in"
            className="font-semibold text-primary hover:underline"
          >
            support@neurostack.in
          </a>
          .
        </p>
      </LegalSection>

      <LegalContactCard
        title="Need clarification on these terms?"
        body="We are happy to address specific questions about how these terms apply to your organization."
      />
    </LegalShell>
  )
}
