// Dev-only: `vite dev` does not run the /api folder (TECH.md §4), so this middleware serves the same
// handlers locally. Production uses Vercel Functions; the handler code is identical.
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

export function apiDev(): Plugin {
  const dir = resolve(process.cwd(), 'api/upstox')
  return {
    name: 'api-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const routes = new Set(readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, '')))
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const match = url.pathname.match(/^\/api\/upstox\/([\w-]+)$/)
        if (!match || !routes.has(match[1])) return next()
        try {
          const mod = (await server.ssrLoadModule(`/api/upstox/${match[1]}.ts`)) as { GET: (r: Request) => Promise<Response> }
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
