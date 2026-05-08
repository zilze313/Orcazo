"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  /** Delay in ms before animating in, useful for staggered lists */
  delay?: number;
  /** Direction to slide in from */
  from?: "bottom" | "left" | "right" | "none";
}

/**
 * Wraps children in a div that fades (and optionally slides) in once it enters
 * the viewport. Uses IntersectionObserver — no external libraries required.
 */
export function FadeIn({ children, className, delay = 0, from = "bottom" }: FadeInProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const translate = {
    bottom: "translate-y-6",
    left: "-translate-x-6",
    right: "translate-x-6",
    none: "",
  }[from];

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        visible ? "opacity-100 translate-x-0 translate-y-0" : `opacity-0 ${translate}`,
        className,
      )}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
