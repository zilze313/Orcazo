import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { MarketingFooter } from '@/components/marketing/marketing-footer';

export const metadata = {
  title: 'Privacy Policy — Orcazo',
};

const LAST_UPDATED = 'May 4, 2025';

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Simple nav */}
      <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b">
        <div className="container max-w-7xl flex items-center h-16 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-lg">
            <span className="inline-flex w-7 h-7 rounded-md bg-primary text-primary-foreground items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </span>
            Orcazo
          </Link>
        </div>
      </header>

      <main className="flex-1 container max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-foreground">
          <Section title="1. Introduction">
            <p>
              Welcome to Orcazo ("we", "us", or "our"). We are committed to protecting your personal
              information and your right to privacy. This Privacy Policy explains how we collect, use,
              disclose, and safeguard your information when you visit our website and use our platform.
            </p>
            <p>
              Please read this policy carefully. If you disagree with its terms, please discontinue use
              of our platform.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p>We collect information you provide directly to us, including:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name, email address, and contact details when you register or apply</li>
              <li>Social media handles and platform links you submit</li>
              <li>Payment information necessary to process payouts (bank or crypto details)</li>
              <li>Content links and campaign submission data</li>
              <li>Communications you send us</li>
            </ul>
            <p>We also automatically collect certain technical information such as IP address, browser type, and usage data when you use our platform.</p>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Operate and maintain the Orcazo platform</li>
              <li>Process payout requests and campaign payments</li>
              <li>Communicate with you about your account and updates</li>
              <li>Verify your identity and prevent fraud</li>
              <li>Comply with legal obligations</li>
              <li>Improve and personalise your experience</li>
            </ul>
          </Section>

          <Section title="4. Sharing Your Information">
            <p>
              We do not sell your personal data. We may share your information with trusted third-party
              service providers who assist in operating our platform (e.g. payment processors, email
              services, hosting providers), subject to confidentiality agreements.
            </p>
            <p>
              We may also disclose your information if required by law or to protect the rights,
              property, or safety of Orcazo, our users, or others.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We retain your personal data for as long as your account is active or as needed to provide
              services, comply with legal obligations, resolve disputes, and enforce our agreements.
              You may request deletion of your account and associated data at any time by contacting us.
            </p>
          </Section>

          <Section title="6. Security">
            <p>
              We implement industry-standard technical and organisational measures to protect your
              information against unauthorised access, alteration, disclosure, or destruction. However,
              no method of transmission over the internet is 100% secure.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability</li>
            </ul>
            <p>To exercise any of these rights, contact us at <a href="mailto:hello@orcazo.com" className="underline">hello@orcazo.com</a>.</p>
          </Section>

          <Section title="8. Cookies">
            <p>
              We use session cookies strictly necessary for platform functionality (authentication).
              We do not use advertising or tracking cookies. You can control cookies through your
              browser settings.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by posting the new policy on this page with an updated date. Your continued use
              of the platform after changes are posted constitutes your acceptance.
            </p>
          </Section>

          <Section title="10. Contact Us">
            <p>
              If you have questions or concerns about this Privacy Policy, please contact us at:<br />
              <a href="mailto:hello@orcazo.com" className="underline">hello@orcazo.com</a>
            </p>
          </Section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold mb-3">{title}</h2>
      <div className="space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}
