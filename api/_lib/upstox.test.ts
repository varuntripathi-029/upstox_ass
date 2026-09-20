import { expect, test, vi, describe, afterEach } from 'vitest'
import { tokenFor } from './upstox'
import * as session from './session'

describe('tokenFor priority logic', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  test('prioritizes session token if logged in', async () => {
    vi.spyOn(session, 'readSession').mockResolvedValue({
      accessToken: 'session_token',
      userName: 'Test',
      userId: '123',
      expiresAt: new Date().toISOString()
    })
    
    vi.stubEnv('UPSTOX_ANALYTICS_TOKEN', 'analytics_token')

    const req = new Request('http://localhost')
    const result = await tokenFor(req)

    expect(result).toEqual({ token: 'session_token', source: 'session' })
  })

  test('falls back to analytics token if no session exists', async () => {
    vi.spyOn(session, 'readSession').mockResolvedValue(null)
    vi.stubEnv('UPSTOX_ANALYTICS_TOKEN', 'analytics_token')

    const req = new Request('http://localhost')
    const result = await tokenFor(req)

    expect(result).toEqual({ token: 'analytics_token', source: 'analytics' })
  })

  test('returns null if neither is configured', async () => {
    vi.spyOn(session, 'readSession').mockResolvedValue(null)
    vi.stubEnv('UPSTOX_ANALYTICS_TOKEN', '')

    const req = new Request('http://localhost')
    const result = await tokenFor(req)

    expect(result).toBeNull()
  })
})
