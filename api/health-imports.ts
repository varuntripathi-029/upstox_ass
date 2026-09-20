// Temporary probe: same web signature, but importing what the real routes import. If /api/health works
// and this one 500s, the failure is in bundling _lib or src/, not in the runtime.
import { json } from './_lib/upstox'
import { pickMfNavs } from '../src/upstox/filter'

export function GET(): Response {
  return json({ ok: true, picked: pickMfNavs([], []).length, signature: 'web+imports' })
}
