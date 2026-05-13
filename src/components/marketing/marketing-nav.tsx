'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MarketingNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b">
      <div className="container max-w-7xl flex items-center h-16 px-4 gap-6">
        <Link href="/" className="flex items-center gap-1">
          <img src="/Light.png" alt="Orcazo" className="h-8 w-auto object-contain dark:hidden" />
          <img src="/Dark.png"  alt="Orcazo" className="h-8 w-auto object-contain hidden dark:block" />
        </Link>

        <div className="hidden sm:flex items-center gap-2 ml-auto">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/auth">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/auth?tab=signup">Get started</Link>
          </Button>
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
          <div className="container max-w-7xl px-4 py-3 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" asChild onClick={() => setOpen(false)}>
              <Link href="/auth">Sign in</Link>
            </Button>
            <Button size="sm" className="flex-1" asChild onClick={() => setOpen(false)}>
              <Link href="/auth?tab=signup">Get started</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
