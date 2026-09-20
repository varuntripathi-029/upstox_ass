// Server-side helpers for the Upstox calls (Vercel Node functions, TECH.md §4).
// The Analytics Token never reaches the browser: it is read from the environment here only.
import { gunzipSync } from 'node:zlib'

export const UPSTOX_API = 'https://api.upstox.com'
export const ASSETS = 'https://assets.upstox.com/market-quote/instruments/exchange'

/** 12 hours for NAVs (published once a day), 24 hours for instrument files. */
export const CACHE_NAVS = 'public, s-maxage=43200, stale-while-revalidate=86400'
export const CACHE_INSTRUMENTS = 'public, s-maxage=86400, stale-while-revalidate=172800'
export const CACHE_QUOTES = 'public, s-maxage=60, stale-while-revalidate=300'
export const CACHE_STATIC = 'public, s-maxage=86400, stale-while-revalidate=604800'

export function json(body: unknown, opts: { status?: number; cache?: string } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: opts.status ?? 200,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(opts.cache ? { 'cache-control': opts.cache } : {}) },
  })
}

/** 501 when no Analytics Token is configured: the UI falls back to cached values. */
export const notConfigured = (what: string) =>
  json(
    {
      status: 'not_configured',
      message: `${what} needs an Upstox Analytics Token. Set UPSTOX_ANALYTICS_TOKEN to enable it; the demo falls back to cached values.`,
    },
    { status: 501 },
  )

let warned = false
/** The token is read here and nowhere else. Its value is never logged, returned or put in a URL. */
export const analyticsToken = (): string | null => {
  const token = process.env.UPSTOX_ANALYTICS_TOKEN?.trim() || null
  if (!token && !warned) {
    warned = true
    console.info('analytics token not set')
  }
  return token
}

/** GET an Upstox API path with the Analytics Token (read-only, GET APIs only). */
export async function upstoxGet<T>(path: string, token: string): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string }> {
  const res = await fetch(`${UPSTOX_API}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  })
  const text = await res.text()
  if (!res.ok) return { ok: false, status: res.status, body: text.slice(0, 500) }
  return { ok: true, data: JSON.parse(text) as T }
}

/** Downloads and gunzips one of the public instrument files (no token needed). */
export async function fetchJsonGz<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8')) as T
}

/** Comma-separated query list, trimmed, de-duplicated and capped (a filter, never the whole file). */
export function listParam(url: URL, name: string, max = 50): string[] {
  const raw = url.searchParams.get(name) ?? ''
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, max)
}

export const badRequest = (message: string) => json({ status: 'error', message }, { status: 400 })
export const upstream = (message: string) => json({ status: 'error', message }, { status: 502 })
