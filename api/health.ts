// GET /api/health -> { ok: true }. No imports on purpose: if this route works, the Node runtime and the
// web handler signature are fine and any other 500 is our code. Kept as a deploy smoke test.
export function GET(): Response {
  return new Response(JSON.stringify({ ok: true, runtime: process.version, signature: 'web' }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
