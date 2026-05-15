"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  Megaphone,
  LineChart,
  AtSign,
  Wallet,
  LogOut,
  Loader2,
  Menu,
  X,
  Moon,
  Sun,
  Newspaper,
  MessageCircle,
  PlayCircle,
  DollarSign,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { OnboardingTour } from "@/components/onboarding-tour";

const NAV = [
  { href: "/campaigns",      label: "Explore Campaigns",    icon: Compass   },
  { href: "/my-campaigns",   label: "My Campaigns",         icon: Megaphone },
  { href: "/dashboard",      label: "Dashboard",            icon: LineChart },
  { href: "/social-accounts",label: "Social Media Accounts",icon: AtSign    },
  { href: "/payouts",        label: "Payouts",              icon: Wallet    },
  { href: "/referrals",     label: "Referrals",            icon: Gift      },
  { href: "/updates",        label: "Updates",              icon: Newspaper      },
  { href: "/support",        label: "Support",              icon: MessageCircle  },
  { href: "/guide",          label: "Guide",                icon: PlayCircle     },
];

export function CreatorShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { email: string; firstName?: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [logoutLoading, setLogoutLoading] = React.useState(false);

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await api.post("/api/auth/logout");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out");
      setLogoutLoading(false);
    }
  }

  const { theme, setTheme } = useTheme();
  const initials = user.email.slice(0, 1).toUpperCase();
  const [balance, setBalance] = React.useState<number | null>(null);
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    api.get<{ waitingPayment: number }>('/api/payouts')
      .then((d) => setBalance(d.waitingPayment))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    const fetchUnread = () => {
      api.get<{ count: number }>('/api/chat/unread')
        .then((d) => setUnreadCount(d.count))
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-background flex-col transition-transform md:static md:flex",
          mobileOpen
            ? "flex translate-x-0"
            : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="h-16 px-5 flex items-center gap-2 border-b">
          <img src="/Light.png" alt="Orcazo" className="h-8 w-auto object-contain dark:hidden" />
          <img src="/Dark.png"  alt="Orcazo" className="h-8 w-auto object-contain hidden dark:block" />
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="ml-auto p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors md:flex"
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 hidden dark:block" />
            <Moon className="h-4 w-4 block dark:hidden" />
          </button>
          <button
            className="p-1.5 md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.href === '/support' && unreadCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1.5">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        {balance !== null && (
          <div className="border-t px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-muted-foreground">Balance</span>
              <span className="ml-auto font-semibold text-emerald-600 dark:text-emerald-400">
                ${balance.toFixed(2)}
              </span>
            </div>
          </div>
        )}
        <div className="border-t p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              {/* uncomment to show the firstname of user */}
              {/* <div className="text-sm font-medium truncate">{user.firstName || user.email.split('@')[0]}</div> */}
              <div className="text-xs text-muted-foreground truncate">
                {user.email}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start mt-1"
            onClick={handleLogout}
            disabled={logoutLoading}
          >
            {logoutLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-16 border-b flex items-center px-4 bg-background sticky top-0 z-20">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2">
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-2 font-semibold">Orcazo</span>
        </header>
        <AnnouncementBanner />
        <main className="flex-1">{children}</main>
      </div>
      <OnboardingTour />
    </div>
  );
}
