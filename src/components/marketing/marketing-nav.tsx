'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavLink {
  href: string;
  label: string;
}

export function MarketingNav({
  variant = 'brand',
  onPrimaryCta,
  onLoginCta,
}: {
  variant?: 'brand' | 'creator';
  onPrimaryCta?: () => void;
  onLoginCta?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  const links: NavLink[] = variant === 'brand'
    ? [
        { href: '/creators',  label: 'For Creators' },
      ]
    : [
        { href: '/',          label: 'For Brands' },
      ];

  const primaryLabel = variant === 'brand' ? 'Sign up as brand' : 'Sign up';

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b">
      <div className="container max-w-7xl flex items-center h-16 px-4 gap-6">
        <Link href="/" className="flex items-center gap-1">
          <img src="/Light.png" alt="Orcazo" className="h-8 w-auto object-contain dark:hidden" />
          <img src="/Dark.png"  alt="Orcazo" className="h-8 w-auto object-contain hidden dark:block" />
        </Link>

        <nav className="hidden sm:flex items-center gap-5 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'transition-colors',
                pathname === l.href ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden sm:flex items-center gap-2 ml-auto">
          {onLoginCta ? (
            <Button variant="ghost" size="sm" onClick={onLoginCta}>Sign in</Button>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
          {onPrimaryCta ? (
            <Button size="sm" onClick={onPrimaryCta}>{primaryLabel}</Button>
          ) : (
            <Button size="sm" asChild>
              <Link href={variant === 'brand' ? '/' : '/creators'}>{primaryLabel}</Link>
            </Button>
          )}
        </div>

        <button
          className="ml-auto sm:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="sm:hidden border-t bg-background">
          <div className="container max-w-7xl px-4 py-3 flex flex-col gap-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <div className="pt-2 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { setOpen(false); onLoginCta ? onLoginCta() : undefined; }} asChild={!onLoginCta}>
                {onLoginCta ? 'Sign in' : <Link href="/login" onClick={() => setOpen(false)}>Sign in</Link>}
              </Button>
              <Button size="sm" className="flex-1" onClick={() => { setOpen(false); onPrimaryCta?.(); }}>
                {primaryLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
