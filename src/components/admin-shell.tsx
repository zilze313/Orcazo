'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ShieldCheck, Users, FileText, UserPlus, Building2, Wallet, AtSign,
  LogOut, Loader2, Menu, X, Moon, Sun, BookOpen, KeyRound, Megaphone, LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { AdminNotificationsBell } from '@/components/admin-notifications';

interface BadgeCounts {
  creatorSignups: number;
  brandSignups: number;
  payouts: number;
  loginRequests: number;
}

// Map each nav href to its badge key
const BADGE_KEY: Record<string, keyof BadgeCounts> = {
  '/admin/creator-signups': 'creatorSignups',
  '/admin/brand-signups':   'brandSignups',
  '/admin/payouts':         'payouts',
  '/admin/login-requests':  'loginRequests',
};

const NAV = [
  { href: '/admin',                 label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/admin/creator-signups', label: 'Creator signups',  icon: UserPlus        },
  { href: '/admin/brand-signups',   label: 'Brand inquiries',  icon: Building2       },
  { href: '/admin/payouts',         label: 'Payouts',          icon: Wallet          },
  { href: '/admin/login-requests',  label: 'Login requests',   icon: KeyRound        },
  { href: '/admin/allowlist',       label: 'Allowlist',        icon: ShieldCheck     },
  { href: '/admin/managed-emails',  label: 'Managed emails',   icon: AtSign          },
  { href: '/admin/employees',       label: 'Employees',        icon: Users           },
  { href: '/admin/submissions',     label: 'Submissions',      icon: FileText        },
  { href: '/admin/campaigns',        label: 'Campaigns',        icon: LayoutGrid },
  { href: '/admin/campaign-rules',   label: 'Campaign Rules',   icon: BookOpen   },
  { href: '/admin/announcements',    label: 'Announcements',    icon: Megaphone  },
];

export function AdminShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [logoutLoading, setLogoutLoading] = React.useState(false);
  const [badges, setBadges] = React.useState<BadgeCounts | null>(null);

  // Poll badge counts every 30s
  React.useEffect(() => {
    let cancelled = false;
    async function fetchBadges() {
      try {
        const data = await api.get<BadgeCounts>('/api/admin/badges');
        if (!cancelled) setBadges(data);
      } catch { /* silently ignore */ }
    }
    fetchBadges();
    const interval = setInterval(fetchBadges, 7_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await api.post('/api/admin/auth/logout');
      router.replace('/admin/login');
      router.refresh();
    } catch {
      toast.error('Could not sign out');
      setLogoutLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 border-r bg-background flex-col transition-transform md:static md:flex',
          mobileOpen ? 'flex translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="h-16 px-5 flex items-center gap-2 border-b">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight">Orcazo</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Admin</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <AdminNotificationsBell />
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label="Toggle theme"
            >
              <Sun className="h-4 w-4 hidden dark:block" />
              <Moon className="h-4 w-4 block dark:hidden" />
            </button>
            <button className="p-1.5 md:hidden" onClick={() => setMobileOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href + '/'));
            const Icon = item.icon;
            const badgeKey = BADGE_KEY[item.href];
            const count = badgeKey ? (badges?.[badgeKey] ?? 0) : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {count > 0 && (
                  <span className="ml-auto flex-shrink-0 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
              A
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">Admin</div>
              <div className="text-xs text-muted-foreground truncate">{email}</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mt-1"
            onClick={handleLogout}
            disabled={logoutLoading}
          >
            {logoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Sign out
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-16 border-b flex items-center px-4 bg-background sticky top-0 z-20">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2">
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-2 font-semibold">Orcazo Admin</span>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
