// Temporary probe: named web handler with EXTENSIONLESS relative imports. Under "type": "module" these
// resolve in the bundler but not in Node at runtime, so a 500 here means the specifiers are the problem.
import { json } from './_lib/upstox'
import { pickMfNavs } from '../src/upstox/filter'

export function GET(): Response {
  return json({ ok: true, picked: pickMfNavs([], []).length, signature: 'web+imports' })
}
