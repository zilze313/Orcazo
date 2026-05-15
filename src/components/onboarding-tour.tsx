"use client";

import * as React from "react";
import { Compass, Film, DollarSign, ArrowRight, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_KEY = "onboarding-tour-completed";

const STEPS = [
  {
    icon: Compass,
    title: "Browse campaigns",
    description:
      "Head to Explore Campaigns to find opportunities. Each campaign shows rates, requirements, and which platforms are accepted.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Film,
    title: "Submit your video",
    description:
      "Once you've made content for a campaign, click Submit on the campaign card, paste your video link, and you're done.",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    icon: DollarSign,
    title: "Track your earnings",
    description:
      "Head to Dashboard to see your earnings, views, and submission statuses. When you're ready, request a payout from the Payouts page.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
];

export function OnboardingTour() {
  const [step, setStep] = React.useState(0);
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_KEY)) {
        // Small delay so the page loads first
        const t = setTimeout(() => setShow(true), 800);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  const complete = () => {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {}
    setShow(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else complete();
  };

  if (!show) return null;

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            Quick tour · Step {step + 1} of {STEPS.length}
          </div>
          <button
            onClick={complete}
            className="p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-6 text-center">
          <div
            className={`inline-flex h-14 w-14 items-center justify-center rounded-full ${current.bg} mb-4`}
          >
            <Icon className={`h-7 w-7 ${current.color}`} />
          </div>
          <h2 className="text-xl font-semibold mb-2">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {current.description}
          </p>
        </div>

        {/* Progress dots + next button */}
        <div className="flex items-center justify-between px-5 pb-5">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? "w-6 bg-primary"
                    : i < step
                      ? "w-1.5 bg-primary/50"
                      : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
          <Button onClick={next} size="sm">
            {step < STEPS.length - 1 ? (
              <>
                Next <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              "Get started"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
