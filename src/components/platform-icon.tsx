'use client';

import * as React from 'react';

interface IconProps {
  className?: string;
}

// Inline SVG glyph components for the platforms we support.
// Currentcolor + uniform 0–24 viewbox makes them drop-in interchangeable.

function TikTokIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.86 4.86 0 0 1-1.01-.07z" />
    </svg>
  );
}

function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function YouTubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function SnapchatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.166.006C11.982.002 11.798 0 11.613 0c-.93 0-1.866.167-2.74.53C7.64 1.16 6.6 2.09 5.87 3.29c-.73 1.2-1.04 2.61-.88 4.01l-.01.01c-.27-.02-.54-.04-.81-.04-.4 0-.8.06-1.18.19-.27.09-.5.24-.68.44-.18.2-.27.45-.27.7 0 .42.25.83.64 1.05.27.15.57.24.87.28.3.04.61.04.92.04l.03-.004c.06.14.14.26.22.38.36.53.87.93 1.46 1.13.59.2 1.22.24 1.84.1l.05-.01c-.21.61-.49 1.2-.82 1.75-.39.66-.87 1.26-1.41 1.79-.4.38-.44 1.02-.08 1.45.14.17.32.3.52.37l.04.01c.68.21 1.37.36 2.07.44.11.01.21.02.32.03.11.34.37.62.71.74.38.14.8.12 1.17-.04.36-.16.64-.45.78-.82.11.002.22.003.33.003.12 0 .24-.002.36-.007.14.37.42.66.78.82.37.16.79.18 1.17.04.34-.12.6-.4.71-.74.11-.01.21-.02.32-.03.7-.08 1.39-.23 2.07-.44l.04-.01c.2-.07.38-.2.52-.37.36-.43.32-1.07-.08-1.45-.54-.53-1.02-1.13-1.41-1.79-.33-.55-.61-1.14-.82-1.75l.05.01c.62.14 1.25.1 1.84-.1.59-.2 1.1-.6 1.46-1.13.08-.12.16-.24.22-.38l.03.004c.31 0 .62 0 .92-.04.3-.04.6-.13.87-.28.39-.22.64-.63.64-1.05 0-.25-.09-.5-.27-.7-.18-.2-.41-.35-.68-.44-.38-.13-.78-.19-1.18-.19-.27 0-.54.02-.81.04l-.01-.01c.16-1.4-.15-2.81-.88-4.01C17.41 2.09 16.37 1.16 15.14.53 14.27.17 13.34.004 12.413.006h-.247z" />
    </svg>
  );
}

function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.26 5.632 5.904-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

const PLATFORM_ICONS: Record<string, React.ComponentType<IconProps>> = {
  tiktok:    TikTokIcon,
  instagram: InstagramIcon,
  youtube:   YouTubeIcon,
  snapchat:  SnapchatIcon,
  x:         XIcon,
  facebook:  FacebookIcon,
};

export const PLATFORM_LABELS: Record<string, string> = {
  tiktok:    'TikTok',
  instagram: 'Instagram',
  youtube:   'YouTube',
  snapchat:  'Snapchat',
  x:         'X',
  facebook:  'Facebook',
};

export function PlatformIcon({
  platform,
  className = 'h-4 w-4',
}: {
  platform: string;
  className?: string;
}) {
  const key = (platform || '').toLowerCase();
  const Icon = PLATFORM_ICONS[key];
  if (!Icon) {
    return (
      <span className={`inline-flex items-center justify-center font-semibold text-[10px] uppercase ${className}`}>
        {(platform || '?').slice(0, 2)}
      </span>
    );
  }
  return <Icon className={className} />;
}
