// Temporary probe: named web handler + ".js" specifiers on relative imports (what ESM needs at runtime).
import { json } from './_lib/upstox.js'
import { pickMfNavs } from '../src/upstox/filter.js'

export function GET(request: Request): Response {
  return json({ ok: true, signature: 'web-named+js-specifiers', path: new URL(request.url).pathname, runtime: process.version })
}
