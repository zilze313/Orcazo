import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { MarketingFooter } from '@/components/marketing/marketing-footer';

export const metadata = {
  title: 'Terms of Service — Orcazo',
};

const LAST_UPDATED = 'May 4, 2025';

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
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
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-foreground">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using the Orcazo platform ("Service"), you agree to be bound by these
              Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              Orcazo is a creator monetisation platform that connects content creators with brand
              campaigns. Creators earn money by submitting qualifying content posts for approved
              campaigns. Orcazo acts as an intermediary and retains a platform commission on all
              earnings.
            </p>
          </Section>

          <Section title="3. Eligibility">
            <p>
              You must be at least 18 years old to use Orcazo. By using the Service, you represent
              that you meet this requirement. Creators must be approved by Orcazo before accessing
              campaigns.
            </p>
          </Section>

          <Section title="4. Creator Obligations">
            <p>As a creator on Orcazo, you agree to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Submit only authentic, original content that you own or have rights to</li>
              <li>Comply with each campaign's specific rules and guidelines</li>
              <li>Not artificially inflate views, engagement, or metrics</li>
              <li>Not use bots, purchased followers, or engagement pods</li>
              <li>Comply with applicable platform terms (TikTok, Instagram, YouTube, etc.)</li>
              <li>Comply with advertising disclosure requirements in your jurisdiction</li>
              <li>Provide accurate payment information for payouts</li>
            </ul>
          </Section>

          <Section title="5. Payments and Commissions">
            <p>
              Orcazo calculates earnings based on post performance metrics as determined by the
              applicable campaign rates. A platform commission is deducted from gross earnings before
              payout. The exact commission rate is disclosed upon account approval.
            </p>
            <p>
              Payouts are processed upon request, subject to a minimum payout threshold. Orcazo
              reserves the right to withhold or cancel payment if fraud, policy violations, or
              chargebacks are detected.
            </p>
          </Section>

          <Section title="6. Prohibited Conduct">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to reverse-engineer, scrape, or extract data from the platform</li>
              <li>Share your account credentials with others</li>
              <li>Submit fraudulent or misleading content</li>
              <li>Interfere with the security or integrity of the Service</li>
              <li>Circumvent any rate limiting or access controls</li>
            </ul>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              You retain ownership of content you create. By submitting content through Orcazo,
              you grant us a limited, non-exclusive licence to use your submitted content solely for
              the purpose of operating and improving the Service (e.g. displaying campaign analytics).
            </p>
            <p>
              The Orcazo name, logo, and platform design are our intellectual property. You may not
              use them without our prior written consent.
            </p>
          </Section>

          <Section title="8. Termination">
            <p>
              We reserve the right to suspend or terminate your account at any time if you violate
              these Terms, engage in fraudulent activity, or for any other reason at our sole
              discretion. Upon termination, any unpaid eligible earnings will be processed according
              to our standard payout schedule, subject to fraud review.
            </p>
          </Section>

          <Section title="9. Disclaimers">
            <p>
              The Service is provided "as is" and "as available" without warranties of any kind,
              express or implied. We do not guarantee that campaigns will be continuously available,
              that specific earnings targets will be met, or that the Service will be error-free.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Orcazo shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising from your use of the
              Service, even if we have been advised of the possibility of such damages.
            </p>
          </Section>

          <Section title="11. Changes to Terms">
            <p>
              We may update these Terms at any time. We will notify you by posting the updated Terms
              with a new "Last updated" date. Continued use of the Service after changes constitute
              acceptance.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              For questions about these Terms, contact us at{' '}
              <a href="mailto:hello@orcazo.com" className="underline">hello@orcazo.com</a>.
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
