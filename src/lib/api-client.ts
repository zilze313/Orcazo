'use client';

// Tiny fetch wrapper for client components. Throws ApiError so React Query
// retry logic / our 401 handling works uniformly.

export class ApiError extends Error {
  constructor(public status: number, public code: string | undefined, message: string, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  };
  const r = await fetch(path, init);
  const text = await r.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}

  if (!r.ok) {
    const message = (json && (json.error || json.message)) || `HTTP ${r.status}`;
    throw new ApiError(r.status, json?.code, message, json?.details);
  }
  return json as T;
}

export const api = {
  get:    <T,>(path: string)              => request<T>('GET', path),
  post:   <T,>(path: string, body?: any)  => request<T>('POST', path, body),
  patch:  <T,>(path: string, body?: any)  => request<T>('PATCH', path, body),
  del:    <T,>(path: string, body?: any)  => request<T>('DELETE', path, body),
};

/** Detects an upstream-expired error from the server so we can boot to /login. */
export function isUpstreamExpired(err: unknown) {
  return err instanceof ApiError && (err.code === 'UPSTREAM_EXPIRED' || err.status === 401);
}
