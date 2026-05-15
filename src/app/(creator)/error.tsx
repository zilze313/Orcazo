'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CreatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Creator section error:', error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          This page hit an unexpected error. You can try again or go back to campaigns.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">Reference: {error.digest}</p>
        )}
        <div className="flex gap-2 justify-center pt-2">
          <Button variant="outline" onClick={() => (window.location.href = '/campaigns')}>
            Campaigns
          </Button>
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
