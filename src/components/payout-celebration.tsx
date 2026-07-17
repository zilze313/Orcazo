"use client";

// Congratulation card shown once after an admin approves a payout.
// Fetches the newest un-celebrated PAID payout; dismissing (or sharing)
// marks it celebrated server-side so it never shows twice.

import * as React from "react";
import {
  Wallet, X, Copy, Check, Share2, Twitter, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/utils";
import { SITE } from "@/config/site";

interface Celebration {
  id: string;
  amount: number;
  paidAt: string | null;
}

const CONFETTI_COLORS = ["#facc15", "#4ade80", "#38bdf8", "#f472b6"];

export function PayoutCelebration() {
  const [celebration, setCelebration] = React.useState<Celebration | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    api
      .get<{ celebration: Celebration | null }>("/api/payouts/celebration")
      .then((d) => setCelebration(d.celebration))
      .catch(() => {});
  }, []);

  if (!celebration) return null;

  const shareText = `I just got a ${formatMoney(celebration.amount)} payout from ${SITE.name} 🎉 Create content, get paid → ${SITE.url}`;

  const dismiss = () => {
    setCelebration(null);
    api.post("/api/payouts/celebration", { id: celebration.id }).catch(() => {});
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ text: shareText });
    } catch {
      /* user cancelled */
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success("Copied — paste it anywhere!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Payout approved"
    >
      <style>{`
        @keyframes oc-confetti-fall {
          0%   { transform: translateY(-10%) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.6; }
        }
      `}</style>

      {/* Confetti */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              top: "-2%",
              left: `${(i * 37) % 100}%`,
              width: i % 3 === 0 ? 10 : 7,
              height: i % 3 === 0 ? 10 : 7,
              borderRadius: i % 2 === 0 ? "9999px" : "2px",
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animation: `oc-confetti-fall ${2.6 + (i % 5) * 0.5}s linear ${(i % 7) * 0.25}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm rounded-xl border bg-card shadow-2xl overflow-hidden">
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-md text-white/70 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Dark hero with the amount */}
        <div className="bg-zinc-900 px-6 pt-8 pb-7 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-green-500/15 text-green-400">
            <Wallet className="h-6 w-6" />
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
            Payout approved
          </div>
          <div className="mt-2 text-5xl font-bold tabular-nums tracking-tight text-green-400">
            {formatMoney(celebration.amount)}
          </div>
        </div>

        <div className="px-6 py-5 text-center">
          <h2 className="text-lg font-semibold tracking-tight">Congratulations! 🎉</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your payout was approved and is on its way to you. Keep posting — the next one&apos;s even bigger.
          </p>

          {/* Share row */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={xUrl} target="_blank" rel="noopener noreferrer">
                <Twitter className="h-4 w-4" /> Share on X
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </Button>
            {canNativeShare && (
              <Button variant="outline" size="sm" onClick={nativeShare}>
                <Share2 className="h-4 w-4" /> Share…
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={copyText}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <Button className="mt-4 w-full" onClick={dismiss}>
            Let&apos;s go
          </Button>
        </div>
      </div>
    </div>
  );
}
