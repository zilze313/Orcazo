'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function RulesDialog({
  open,
  onOpenChange,
  campaignName,
  rulesHtml,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignName: string;
  rulesHtml: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Campaign rules</DialogTitle>
          <DialogDescription>{campaignName}</DialogDescription>
        </DialogHeader>

        <div
          className="prose prose-sm dark:prose-invert max-w-none pt-1"
          dangerouslySetInnerHTML={{ __html: rulesHtml }}
        />
      </DialogContent>
    </Dialog>
  );
}
