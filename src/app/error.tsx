'use client';

// Top-level error boundary for the App Router. Any unhandled error in a
// client/server component bubbles up to here. We log it and show a friendly
// retry UI rather than a blank page.

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center px-4 bg-background">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          The page hit an unexpected error. You can try again, or come back in a moment.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">Reference: {error.digest}</p>
        )}
        <div className="flex gap-2 justify-center pt-2">
          <Button variant="outline" onClick={() => (window.location.href = '/')}>
            Go home
          </Button>
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
