'use client';

import * as React from 'react';
import Image from 'next/image';
import { ExternalLink, Calendar, Users, DollarSign, TrendingUp, Globe } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PlatformIcon, PLATFORM_LABELS } from '@/components/platform-icon';
import { formatMoney } from '@/lib/utils';
import { CampaignSummary, PlatformLanguageRate } from './types';

function formatViews(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

/** Coerce upstream cpm (number | string) to number. */
function toNum(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function CampaignDetailDialog({
  campaign,
  open,
  onOpenChange,
}: {
  campaign: CampaignSummary | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!campaign) return null;

  const standards = campaign.rates?.standards;
  const details   = campaign.rates?.details ?? {};
  const platforms = campaign.rates?.platforms ?? [];
  const languages = campaign.rates?.languages ?? [];
  const hasDetails = Object.keys(details).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0 relative">
              {campaign.icon
                ? <Image src={campaign.icon} alt="" fill sizes="48px" className="object-cover" unoptimized />
                : null}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg leading-tight">{campaign.name}</DialogTitle>
              <div className="flex flex-wrap gap-1 mt-1">
                {platforms.map((p) => (
                  <Badge key={p} variant="secondary" className="gap-1 text-[10px]">
                    <PlatformIcon platform={p} className="h-3 w-3" />
                    {PLATFORM_LABELS[p] ?? p}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Standard stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBlock icon={DollarSign} label="Base / post" value={standards ? formatMoney(standards.base) : '—'} />
            <StatBlock icon={TrendingUp} label="Cap / post"  value={standards ? formatMoney(standards.cap)  : '—'} />
            <StatBlock icon={Users}      label="Min views"   value={standards ? formatViews(standards.threshold) : '—'} />
            <StatBlock icon={Calendar}   label="Days counted" value={standards?.daysCounted != null ? `${standards.daysCounted}d` : '—'} />
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {campaign.approvalRate != null && (
              <span className="text-muted-foreground">
                Approval rate: <span className="font-medium text-foreground">{Math.round(campaign.approvalRate)}%</span>
              </span>
            )}
            {languages.length > 0 && (
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground capitalize">{languages.join(', ')}</span>
              </span>
            )}
            {campaign.dateEnd && (
              <span className="text-muted-foreground">
                Ends: <span className="font-medium text-foreground">{new Date(campaign.dateEnd).toLocaleDateString()}</span>
              </span>
            )}
          </div>

          {/* Per-platform breakdown */}
          {hasDetails && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-3">Per-platform rates</h4>
                <div className="space-y-3">
                  {Object.entries(details).map(([platform, langs]) => (
                    <PlatformRateBlock key={platform} platform={platform} langs={langs} />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Rules (rich-text HTML from admin) */}
          {campaign.rules && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-3">Campaign rules</h4>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: campaign.rules }}
                />
              </div>
            </>
          )}

          {/* Example videos */}
          {campaign.examples && campaign.examples.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-3">Example videos</h4>
                <div className="space-y-1.5">
                  {campaign.examples.map((ex, i) => {
                    const url = String(ex.url || '');
                    if (!url) return null;
                    const href = url.startsWith('http') ? url : `https://${url}`;
                    return (
                      <a
                        key={i}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm hover:underline text-primary max-w-full"
                      >
                        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{url}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Application questions */}
          {campaign.applicationQuestions && campaign.applicationQuestions.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-3">Application questions</h4>
                <ul className="space-y-2">
                  {campaign.applicationQuestions.map((q) => (
                    <li key={q.id} className="text-sm flex gap-2">
                      <span className="text-muted-foreground flex-shrink-0">•</span>
                      <span>{q.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatBlock({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function PlatformRateBlock({
  platform, langs,
}: { platform: string; langs: Record<string, PlatformLanguageRate> }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <PlatformIcon platform={platform} className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{PLATFORM_LABELS[platform] ?? platform}</span>
      </div>
      <div className="space-y-1.5">
        {Object.entries(langs).map(([lang, vals]) => {
          const cpm = toNum(vals.cpm);
          const parts: string[] = [];
          if (vals.base != null) parts.push(`Base: ${formatMoney(vals.base)}`);
          if (cpm != null)       parts.push(`CPM: ${formatMoney(cpm)}`);
          if (vals.cap != null)  parts.push(`Cap: ${formatMoney(vals.cap)}`);
          if (vals.threshold != null) parts.push(`Min views: ${formatViews(vals.threshold)}`);
          if (vals.days != null) parts.push(`${vals.days}d window`);

          return (
            <div key={lang} className="flex flex-wrap gap-x-3 text-xs">
              <span className="capitalize text-muted-foreground w-20 flex-shrink-0">{lang}</span>
              <span className="text-foreground">{parts.join(' · ')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
