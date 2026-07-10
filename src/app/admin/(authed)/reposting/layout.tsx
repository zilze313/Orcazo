'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, ListChecks, Wallet, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/admin/reposting',             label: 'Campaigns',   icon: LayoutGrid, match: (p: string) => !p.startsWith('/admin/reposting/submissions') && !p.startsWith('/admin/reposting/credits') && !p.startsWith('/admin/reposting/payouts') },
  { href: '/admin/reposting/submissions', label: 'Submissions', icon: ListChecks, match: (p: string) => p.startsWith('/admin/reposting/submissions') },
  { href: '/admin/reposting/credits',     label: 'Credits',     icon: Wallet,     match: (p: string) => p.startsWith('/admin/reposting/credits') },
  { href: '/admin/reposting/payouts',     label: 'Payouts',     icon: Banknote,   match: (p: string) => p.startsWith('/admin/reposting/payouts') },
];

export default function RepostingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div className="border-b px-4 sm:px-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((t) => {
            const active = t.match(pathname);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                  active
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
