// Dev-only: `vite dev` does not run the /api folder (TECH.md §4), so this middleware serves the same
// handlers locally. Production uses Vercel Functions; the handler code is identical.
// It calls the named GET export — the contract Vercel's Node runtime uses for web handlers — so dev
// cannot hide a signature mismatch the way it did when this called `mod.default`.
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

/** Every .ts file under api/, minus the _lib helpers and tests, at the path it is served from. */
function routesUnder(root: string): Set<string> {
  return new Set(
    readdirSync(root, { recursive: true, encoding: 'utf8' })
      .map((f) => f.replaceAll('\\', '/'))
      .filter((f) => f.endsWith('.ts') && !f.startsWith('_') && !f.endsWith('.test.ts'))
      .map((f) => f.slice(0, -3)),
  )
}

export function apiDev(): Plugin {
  const root = resolve(process.cwd(), 'api')
  return {
    name: 'api-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const routes = routesUnder(root)
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const match = url.pathname.match(/^\/api\/([\w-]+(?:\/[\w-]+)?)$/)
        if (!match || !routes.has(match[1])) return next()
        try {
          const mod = (await server.ssrLoadModule(`/api/${match[1]}.ts`)) as { GET: (r: Request) => Promise<Response> | Response }
          const headers = Object.fromEntries(
            Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v ?? '')]),
          )
          const response = await mod.GET(new Request(`http://localhost${req.url}`, { headers }))
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(await response.text())
        } catch (e) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ status: 'error', message: (e as Error).message }))
        }
      })
    },
  }
}
