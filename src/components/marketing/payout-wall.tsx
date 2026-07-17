// Homepage "payout wall" — an infinite marquee of admin-curated payout cards.
// Pure presentational component; cards come server-rendered from the DB so
// the section is fully indexable and paints without a client fetch.

import { BadgeCheck } from 'lucide-react';
import { PlatformIcon } from '@/components/platform-icon';
import { formatMoney } from '@/lib/utils';

export interface PayoutWallCard {
  id: string;
  displayName: string;
  handle: string | null;
  platform: string | null;
  amount: number;
  note: string | null;
  paidLabel: string | null;
}

export function PayoutWall({ cards }: { cards: PayoutWallCard[] }) {
  if (cards.length === 0) return null;

  // Duplicate the list so the CSS marquee loops seamlessly.
  const loop = [...cards, ...cards];

  return (
    <section className="py-24 overflow-hidden" aria-label="Recent creator payouts">
      <div className="container max-w-6xl px-4 mb-14 text-center">
        <span className="inline-block rounded-full bg-accent text-primary text-xs font-bold uppercase tracking-wide px-3.5 py-1.5 mb-4">
          Payout Wall
        </span>
        <h2 className="text-display text-3xl sm:text-[2.6rem]">
          Real payouts, real creators
        </h2>
        <p className="mt-4 text-muted-foreground font-medium max-w-2xl mx-auto">
          A live look at what creators are cashing out on Orcazo.
        </p>
      </div>

      <div className="relative overflow-hidden">
        <div className="flex animate-marquee" style={{ width: 'max-content' }}>
          {loop.map((card, i) => (
            <div
              key={`${card.id}-${i}`}
              className="mr-5 w-[270px] flex-shrink-0 rounded-3xl border border-black/[0.06] bg-card p-6 shadow-sm"
              aria-hidden={i >= cards.length}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-[11px] font-bold text-green-600 dark:text-green-400">
                  <BadgeCheck className="h-3.5 w-3.5" /> Paid out
                </span>
                {card.paidLabel && (
                  <span className="text-[11px] font-semibold text-muted-foreground">{card.paidLabel}</span>
                )}
              </div>
              <div className="mt-4 text-3xl font-extrabold tabular-nums tracking-tight">
                {formatMoney(card.amount)}
              </div>
              <div className="mt-4 pt-4 border-t flex items-center gap-2.5 min-w-0">
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-primary text-white text-xs font-bold">
                  {card.displayName[0]?.toUpperCase() ?? '?'}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{card.displayName}</div>
                  {card.handle && (
                    <div className="text-xs font-medium text-muted-foreground truncate inline-flex items-center gap-1">
                      {card.platform && (
                        <PlatformIcon platform={card.platform} className="h-3 w-3 flex-shrink-0" />
                      )}
                      @{card.handle.replace(/^@/, '')}
                    </div>
                  )}
                </div>
              </div>
              {card.note && (
                <p className="mt-2.5 text-xs font-medium text-muted-foreground truncate" title={card.note}>
                  {card.note}
                </p>
              )}
            </div>
          ))}
        </div>
        {/* Edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />
      </div>
    </section>
  );
}
