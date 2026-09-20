// Temporary probe: the legacy Node handler signature. If this answers and /api/health does not,
// the web handler signature is what production rejects.
export default function handler(_req: unknown, res: { setHeader: (k: string, v: string) => void; end: (b: string) => void }) {
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ ok: true, runtime: process.version, signature: 'node' }))
}
