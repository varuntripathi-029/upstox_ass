// The account route's auth behaviour: no session and an expired Upstox token both answer 401 so the
// UI offers "reconnect" instead of an error, and an account with no holdings is an empty result, not
// a failure. No network: fetch is stubbed.
import { afterEach, describe, expect, test, vi } from 'vitest'
import { GET } from '../portfolio.js'
import * as session from '../_lib/session.js'

const SESSION = { accessToken: 'live_token', userName: 'Test User', userId: 'UCC1', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }
const req = () => new Request('http://localhost/api/portfolio')
const upstoxReplies = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GET /api/portfolio', () => {
  test('401 with no session, and the body never carries a token', async () => {
    vi.spyOn(session, 'readSession').mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.status).toBe('no_session')
    expect(JSON.stringify(body)).not.toMatch(/token/i)
  })

  test('401 "expired" when Upstox rejects the token', async () => {
    vi.spyOn(session, 'readSession').mockResolvedValue(SESSION)
    upstoxReplies(401, { status: 'error', errors: [{ errorCode: 'UDAPI100050' }] })
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect((await res.json()).status).toBe('expired')
  })

  test('an account with no holdings is an empty result, not an error', async () => {
    vi.spyOn(session, 'readSession').mockResolvedValue(SESSION)
    upstoxReplies(404, { status: 'error', errors: [{ errorCode: 'UDAPI100500' }] })
    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.holdings.data).toEqual([])
    expect(body.trades.data).toEqual([])
    expect(body.charges['2627']).toBeDefined()
  })

  test('maps a real response through unchanged', async () => {
    vi.spyOn(session, 'readSession').mockResolvedValue(SESSION)
    upstoxReplies(200, { status: 'success', data: [{ isin: 'INE009A01021', quantity: 10 }] })
    const body = await (await GET(req())).json()
    expect(body.holdings.data[0].isin).toBe('INE009A01021')
    expect(typeof body.asOf).toBe('string')
  })
})
