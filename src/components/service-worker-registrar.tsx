'use client';

import { useEffect } from 'react';

/** Registers /sw.js once on mount. Works silently — no errors surface to the UI. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/admin' })
        .catch(() => { /* silently ignore; PWA is an enhancement, not required */ });
    }
  }, []);

  return null;
}
