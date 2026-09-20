// Vercel's Hobby plan allows 12 Serverless Functions per deployment, and EVERY .ts file under api/
// that is not underscore-prefixed becomes one — test files included. Going over fails the deploy with
// "No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan", after the
// build has otherwise succeeded. This runs first in `npm run build`, so it fails here instead.
//
// Staying under the cap: shared code goes in api/_lib/, tests in api/_tests/, and endpoints that need
// a token share api/upstox/[endpoint].ts.
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const LIMIT = 12
const WARN_AT = 10
const root = resolve(process.cwd(), 'api')

/** Exactly what Vercel counts: .ts files under api/, excluding anything under an underscore path. */
export function deployableFunctions(dir = root) {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((f) => f.replaceAll('\\', '/'))
    .filter((f) => f.endsWith('.ts') && !f.split('/').some((part) => part.startsWith('_')))
    .sort()
}

const fns = deployableFunctions()
const plural = fns.length === 1 ? 'function' : 'functions'

if (fns.length > LIMIT) {
  console.error(`\n✗ ${fns.length} Serverless ${plural} in api/, and Vercel's Hobby plan allows ${LIMIT}.\n`)
  for (const f of fns) console.error(`    api/${f}`)
  console.error(
    '\n  The deploy would fail with "No more than 12 Serverless Functions can be added to a Deployment".' +
      '\n  Fixes: move tests to api/_tests/, shared code to api/_lib/, or fold endpoints into a [param] route.\n',
  )
  process.exit(1)
}

const headroom = LIMIT - fns.length
console.log(`✓ ${fns.length} Serverless ${plural} in api/ (limit ${LIMIT}, ${headroom} to spare)`)
if (fns.length >= WARN_AT) console.warn(`  Careful: only ${headroom} left. Adding a file under api/ that is not in _lib/ or _tests/ will break the deploy.`)
