import { SESSION_COOKIE, clearCookie } from '../_lib/session'

export default async function (): Promise<Response> {
  const headers = new Headers()
  headers.set('Location', '/')
  headers.append('Set-Cookie', clearCookie(SESSION_COOKIE))
  
  // Return redirect to homepage, clearing the cookie
  return new Response(null, {
    status: 302,
    headers
  })
}
