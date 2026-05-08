import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number | string | null | undefined, currency = 'USD') {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (!isFinite(num)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
}

export function formatNumber(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatRelative(date: Date | string | null | undefined) {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

export function safeJsonParse<T = unknown>(s: string | null | undefined): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}
