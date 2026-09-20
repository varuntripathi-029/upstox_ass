// The Hobby plan allows 12 Serverless Functions per deployment and every non-underscore .ts file under
// api/ is one, so a new route (or a test file in the wrong folder) can fail the deploy after a green
// build. `npm run build` checks this first; this test makes `npm test` and CI catch it too.
import { describe, expect, it } from 'vitest'
import { deployableFunctions } from '../../scripts/check-functions.mjs'

describe('Vercel function budget', () => {
  const fns = deployableFunctions()

  it('stays within the 12-function Hobby limit', () => {
    expect(fns.length, `api/ has ${fns.length} functions: ${fns.join(', ')}`).toBeLessThanOrEqual(12)
  })
  it('counts the routes we expect, and nothing from _lib or _tests', () => {
    expect(fns).toEqual([
      'auth/callback.ts',
      'auth/login.ts',
      'auth/logout.ts',
      'auth/session.ts',
      'health.ts',
      'portfolio.ts',
      'upstox/[endpoint].ts',
      'upstox/instruments.ts',
      'upstox/mf-navs.ts',
    ])
  })
})
