import { readSession, publicSession } from '../_lib/session.js'

export default async function (request: Request): Promise<Response> {
  const session = await readSession(request)
  const pub = publicSession(session)
  
  return new Response(JSON.stringify(pub), {
    headers: { 'Content-Type': 'application/json' }
  })
}
