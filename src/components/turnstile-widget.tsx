'use client';

import * as React from 'react';
import Script from 'next/script';

// Cloudflare Turnstile widget. Renders a small invisible/managed challenge.
// Calls onToken(token) when the user passes the challenge.
//
// Race-condition fix: if the script is already loaded when this component
// mounts (e.g. dialog closed and reopened, or script loaded before the dialog
// opened), window.turnstile is already defined. We detect that on mount and
// skip waiting for the onLoad event — which won't fire again for a cached script.

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement | string,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'invisible';
        },
      ) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function TurnstileWidget({
  onToken,
  className = '',
}: {
  onToken: (token: string | null) => void;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const [scriptReady, setScriptReady] = React.useState(false);

  // If no site key, fire an immediate pseudo-token so forms aren't blocked.
  // The server's verifyTurnstile() also short-circuits when no secret is set.
  React.useEffect(() => {
    if (!SITE_KEY) { onToken('disabled'); return; }
    // Script may already be loaded (dialog reopened / cached script):
    // onLoad won't fire again, so detect turnstile presence immediately.
    if (typeof window !== 'undefined' && window.turnstile) {
      setScriptReady(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render (or re-render) the widget whenever the script becomes ready.
  React.useEffect(() => {
    if (!SITE_KEY || !scriptReady || !ref.current || !window.turnstile) return;

    // Remove any leftover widget from a previous mount
    if (widgetIdRef.current) {
      try { window.turnstile?.remove(widgetIdRef.current); } catch {}
      widgetIdRef.current = null;
    }

    const id = window.turnstile.render(ref.current, {
      sitekey: SITE_KEY,
      callback:          (token) => onToken(token),
      'expired-callback': ()      => onToken(null),
      'error-callback':   ()      => onToken(null),
      theme: 'auto',
      size:  'normal',
    });
    widgetIdRef.current = id;

    return () => {
      if (widgetIdRef.current) {
        try { window.turnstile?.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [scriptReady, onToken]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => onToken('error')}
      />
      <div ref={ref} className={className} />
    </>
  );
}
