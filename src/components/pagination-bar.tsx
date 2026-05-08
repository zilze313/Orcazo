'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PaginationBar({
  page,
  totalPages,
  total,
  onPageChange,
  className = '',
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className={`flex items-center justify-between gap-2 py-4 ${className}`}>
      <div className="text-sm text-muted-foreground">
        Page {page} of {totalPages} · {total} total
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
