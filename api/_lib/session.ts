// Stage 4: the logged-in session (TECH.md §3, §5). The access token lives ONLY inside an encrypted
// iron-session cookie and inside these functions: it is never returned to the browser, never put in a
// URL and never logged. Upstox access tokens die at 3:30 AM IST, so the cookie dies with them.
import { sealData, unsealData } from 'iron-session'

export const SESSION_COOKIE = 'uo_session'
export const STATE_COOKIE = 'uo_oauth_state'
/** The OAuth `state` only has to survive the round trip to Upstox and back. */
export const STATE_TTL_SECONDS = 600

export interface SessionData {
  accessToken: string
  userName: string
  userId: string
  /** ISO instant at which the Upstox token dies (3:30 AM IST) */
  expiresAt: string
}

/** What the browser is allowed to know about a session. Never the token. */
export interface PublicSession {
  connected: boolean
  name?: string
  expiresAt?: string
}

export interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  password: string
}

const env = (name: string): string => process.env[name]?.trim() ?? ''

/**
 * OAuth settings, or null when the deployment has no login configured (then everything still works:
 * the demo falls back to the Analytics Token and to cached values). Only names are ever logged.
 */
export function oauthConfig(request?: Request): OAuthConfig | null {
  const clientId = env('UPSTOX_CLIENT_ID')
  const clientSecret = env('UPSTOX_CLIENT_SECRET')
  const password = env('SESSION_SECRET')
  const redirectUri = env('UPSTOX_REDIRECT_URI') || (request ? `${new URL(request.url).origin}/api/auth/callback` : '')
  const missing = [
    !clientId && 'UPSTOX_CLIENT_ID',
    !clientSecret && 'UPSTOX_CLIENT_SECRET',
    !redirectUri && 'UPSTOX_REDIRECT_URI',
    password.length < 32 && 'SESSION_SECRET (32+ characters)',
  ].filter(Boolean)
  if (missing.length) {
    console.info(`upstox oauth not configured: missing ${missing.join(', ')}`)
    return null
  }
  return { clientId, clientSecret, redirectUri, password }
}

/**
 * The next 3:30 AM IST, which is when every Upstox access token expires regardless of when it was
 * issued (Get Token docs). 3:30 IST is 22:00 UTC the previous day, so this needs no timezone library.
 */
export function tokenExpiry(now: Date = new Date()): Date {
  const at22 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 22, 0, 0, 0)
  return new Date(now.getTime() < at22 ? at22 : at22 + 24 * 60 * 60 * 1000)
}

export const secondsUntil = (iso: string, now: Date = new Date()): number =>
  Math.max(0, Math.round((new Date(iso).getTime() - now.getTime()) / 1000))

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return null
}

/** httpOnly + Secure + SameSite=Lax: the callback arrives as a redirect from Upstox, so Strict would drop it. */
export function cookie(name: string, value: string, maxAgeSeconds: number): string {
  const flags = ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`]
  return `${name}=${encodeURIComponent(value)}; ${flags.join('; ')}`
}

export const clearCookie = (name: string): string => cookie(name, '', 0)

export async function sealSession(data: SessionData, password: string, now: Date = new Date()): Promise<string> {
  return sealData(data, { password, ttl: secondsUntil(data.expiresAt, now) })
}

/**
 * The session, or null when there is none, it was tampered with, or the Upstox token has expired.
 * A bad seal is never an error the caller has to handle: no session simply means "not connected".
 */
export async function readSession(request: Request, now: Date = new Date()): Promise<SessionData | null> {
  const password = env('SESSION_SECRET')
  const seal = readCookie(request, SESSION_COOKIE)
  if (!seal || password.length < 32) return null
  try {
    const data = await unsealData<SessionData>(seal, { password, ttl: 0 })
    if (!data?.accessToken || !data.expiresAt) return null
    if (new Date(data.expiresAt).getTime() <= now.getTime()) return null
    return data
  } catch {
    return null // expired or tampered: "reconnect", not an error page
  }
}

export const publicSession = (s: SessionData | null): PublicSession =>
  s ? { connected: true, name: s.userName, expiresAt: s.expiresAt } : { connected: false }
