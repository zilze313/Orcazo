'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { href: '/brands', label: 'For Brands' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];

export function MarketingNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md">
      <div className="container max-w-7xl flex items-center h-[72px] px-4 gap-6">
        <Link href="/" className="flex items-center gap-1">
          <img src="/Light.png" alt="Orcazo" className="h-8 w-auto object-contain" />
        </Link>

        {/* Centered links, Content Rewards style */}
        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3 ml-auto">
          <Link
            href="/auth"
            className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Button variant="dark" asChild>
            <Link href="/auth?tab=signup">
              Become a Creator <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <button
          className="ml-auto md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t bg-background">
          <div className="container max-w-7xl px-4 py-4 space-y-3">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="block text-center text-[15px] font-medium text-muted-foreground hover:text-foreground py-1"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" asChild onClick={() => setOpen(false)}>
                <Link href="/auth">Sign in</Link>
              </Button>
              <Button variant="dark" className="flex-1" asChild onClick={() => setOpen(false)}>
                <Link href="/auth?tab=signup">Become a Creator</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
