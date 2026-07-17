import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MarketingFooter() {
  return (
    <footer className="bg-foreground text-background overflow-hidden">
      {/* Big CTA block */}
      <div className="container max-w-7xl px-4 pt-20 pb-14">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <h2 className="text-display text-3xl sm:text-4xl lg:text-5xl max-w-2xl">
            Post short-form videos on TikTok, Instagram &amp; YouTube — and get paid for every view.
          </h2>
          <Button size="xl" className="w-fit" asChild>
            <Link href="/auth?tab=signup">
              Become a Creator <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>

        {/* Link columns */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-3 gap-10 text-sm">
          <div>
            <div className="text-background/50 font-medium mb-4">Navigation</div>
            <ul className="space-y-3">
              <li><Link href="/" className="hover:text-primary transition-colors">Creators</Link></li>
              <li><Link href="/brands" className="hover:text-primary transition-colors">Brands</Link></li>
              <li><Link href="/blog" className="hover:text-primary transition-colors">Blog</Link></li>
              <li><Link href="/auth" className="hover:text-primary transition-colors">Sign in</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-background/50 font-medium mb-4">Company</div>
            <ul className="space-y-3">
              <li><Link href="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
              <li><Link href="/blog" className="hover:text-primary transition-colors">Guides</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-background/50 font-medium mb-4">Pages</div>
            <ul className="space-y-3">
              <li><Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Giant wordmark */}
      <div className="select-none pointer-events-none" aria-hidden>
        <div className="text-display text-[clamp(5rem,18vw,17rem)] text-background/10 text-center leading-none -mb-[0.18em]">
          ORCAZO
        </div>
      </div>

      <div className="border-t border-background/10">
        <div className="container max-w-7xl px-4 py-5 text-xs text-background/50 flex flex-col sm:flex-row justify-between gap-2">
          <div>Orcazo © {new Date().getFullYear()} — All rights reserved.</div>
          <div>Made for creators worldwide.</div>
        </div>
      </div>
    </footer>
  );
}
