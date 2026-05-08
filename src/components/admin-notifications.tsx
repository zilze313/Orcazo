'use client';

import * as React from 'react';
import { Bell, BellOff, Loader2, Share, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type PermState = 'loading' | 'needs-install' | 'default' | 'granted' | 'denied';

function detectEnv() {
  if (typeof window === 'undefined') return { supported: false, needsInstall: false };
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true;
  const hasPush = 'serviceWorker' in navigator && 'PushManager' in window;
  // On iOS, push only works when installed (standalone). Show install prompt otherwise.
  if (isIOS && !isStandalone) return { supported: false, needsInstall: true };
  return { supported: hasPush, needsInstall: false };
}

export function AdminNotificationsBell() {
  const [state, setState] = React.useState<PermState>('loading');
  const [subscription, setSubscription] = React.useState<PushSubscription | null>(null);
  const [installOpen, setInstallOpen] = React.useState(false);

  React.useEffect(() => {
    const { supported, needsInstall } = detectEnv();

    if (needsInstall) { setState('needs-install'); return; }
    if (!supported)   { setState('default');       return; }

    const perm = Notification.permission as NotificationPermission;
    if (perm === 'denied') { setState('denied'); return; }

    navigator.serviceWorker.getRegistration('/admin').then(async (reg) => {
      const existing = reg ? await reg.pushManager.getSubscription() : null;
      setSubscription(existing);
      setState(existing ? 'granted' : 'default');
    }).catch(() => setState('default'));
  }, []);

  async function enable() {
    setState('loading');
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error('Push not configured — restart the dev server after adding NEXT_PUBLIC_VAPID_PUBLIC_KEY to .env');

      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/admin' });
      const active: ServiceWorker = reg.active ?? await waitForActive(reg);
      void active;

      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState('denied');
        toast.error('Permission denied. Allow notifications in browser settings.');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        applicationServerKey: vapidKeyToUint8Array(vapidKey) as any,
      });

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await api.post('/api/admin/push', { endpoint: json.endpoint, keys: json.keys });

      setSubscription(sub);
      setState('granted');
      toast.success('Push notifications enabled on this device.');
    } catch (err) {
      console.error('[push] enable failed:', err);
      toast.error(err instanceof Error ? err.message : 'Could not enable notifications.');
      setState('default');
    }
  }

  async function disable() {
    setState('loading');
    try {
      if (subscription) {
        const json = subscription.toJSON() as { endpoint: string };
        await api.del('/api/admin/push', { endpoint: json.endpoint });
        await subscription.unsubscribe();
        setSubscription(null);
      }
      setState('default');
      toast.success('Push notifications disabled.');
    } catch (err) {
      console.error('[push] disable failed:', err);
      toast.error('Could not disable notifications.');
      setState('granted');
    }
  }

  const isSubscribed = state === 'granted' && !!subscription;

  function handleClick() {
    if (state === 'needs-install') { setInstallOpen(true); return; }
    if (isSubscribed) { void disable(); return; }
    void enable();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'loading' || state === 'denied'}
        title={
          state === 'denied'         ? 'Notifications blocked — allow in browser settings'
          : state === 'needs-install' ? 'Install the app to enable notifications'
          : isSubscribed             ? 'Disable push notifications'
                                     : 'Enable push notifications'
        }
        className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {state === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="h-4 w-4 text-primary" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
      </button>

      {/* iOS install guide dialog */}
      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Install the app first</DialogTitle>
            <DialogDescription>
              iPhone requires the app to be installed before push notifications can be enabled.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-4 text-sm pt-1">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">1</span>
              <div>
                Tap the <strong>Share</strong> button at the bottom of Safari
                <span className="inline-flex items-center gap-1 ml-1 text-muted-foreground">
                  (<Share className="h-3.5 w-3.5" />)
                </span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">2</span>
              <div>
                Scroll down and tap{' '}
                <strong className="inline-flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add to Home Screen
                </strong>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">3</span>
              <div>
                Open <strong>Orcazo Admin</strong> from your home screen, then tap the bell icon to enable notifications
              </div>
            </li>
          </ol>
          <p className="text-xs text-muted-foreground pt-1">
            Requires iOS 16.4 or later.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function waitForActive(reg: ServiceWorkerRegistration): Promise<ServiceWorker> {
  return new Promise((resolve, reject) => {
    const sw = reg.installing ?? reg.waiting;
    if (!sw) { reject(new Error('Service worker not installing — reload the page and try again.')); return; }
    const timeout = setTimeout(() => reject(new Error('Service worker activation timed out.')), 15_000);
    sw.addEventListener('statechange', function handler() {
      if (sw.state === 'activated') {
        clearTimeout(timeout);
        sw.removeEventListener('statechange', handler);
        resolve(sw);
      }
      if (sw.state === 'redundant') {
        clearTimeout(timeout);
        sw.removeEventListener('statechange', handler);
        reject(new Error('Service worker became redundant.'));
      }
    });
  });
}

function vapidKeyToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
