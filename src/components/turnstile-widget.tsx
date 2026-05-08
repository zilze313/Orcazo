'use client';

import * as React from 'react';
import Script from 'next/script';

// Cloudflare Turnstile widget. Renders a small invisible/managed challenge.
// Calls onToken(token) when the user passes the challenge. If the site key
// isn't configured (env var missing), renders nothing and immediately resolves
// so forms still submit.

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
  const [loaded, setLoaded] = React.useState(false);

  // If no site key, signal an immediate "no challenge needed" (pseudo-token).
  // The server still calls verifyTurnstile() which also short-circuits when
  // no secret key is configured, so the system is safe end-to-end.
  React.useEffect(() => {
    if (!SITE_KEY) onToken('disabled');
  }, [onToken]);

  React.useEffect(() => {
    if (!SITE_KEY || !loaded || !ref.current || !window.turnstile) return;
    const id = window.turnstile.render(ref.current, {
      sitekey: SITE_KEY,
      callback: (token) => onToken(token),
      'expired-callback': () => onToken(null),
      'error-callback':   () => onToken(null),
      theme: 'auto',
      size:  'normal',
    });
    widgetIdRef.current = id;
    return () => {
      if (widgetIdRef.current) {
        try { window.turnstile?.remove(widgetIdRef.current); } catch {}
      }
    };
  }, [loaded, onToken]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        onLoad={() => setLoaded(true)}
      />
      <div ref={ref} className={className} />
    </>
  );
}
