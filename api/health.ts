// GET /api/health -> { ok: true, ... }. No imports on purpose: if this route answers, the Node runtime
// and the web handler signature are fine and any other 500 is our code.
// It reports only WHETHER each secret is configured — never a value, a prefix or a length.
export function GET(): Response {
  const set = (name: string) => (process.env[name]?.trim().length ?? 0) > 0
  const body = {
    ok: true,
    runtime: process.version,
    signature: 'web',
    config: {
      analyticsToken: set('UPSTOX_ANALYTICS_TOKEN'),
      oauth: set('UPSTOX_CLIENT_ID') && set('UPSTOX_CLIENT_SECRET') && set('UPSTOX_REDIRECT_URI'),
      sessionSecret: (process.env.SESSION_SECRET?.trim().length ?? 0) >= 32,
      redirectHost: process.env.UPSTOX_REDIRECT_URI ? new URL(process.env.UPSTOX_REDIRECT_URI).origin : null,
    },
  }
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
