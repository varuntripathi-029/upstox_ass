import { oauthConfig, cookie, STATE_COOKIE, STATE_TTL_SECONDS } from '../_lib/session.js'

export async function GET(request: Request): Promise<Response> {
  const config = oauthConfig(request)
  if (!config) {
    return new Response('OAuth not configured on this deployment', { status: 501 })
  }

  // Generate a random state string to prevent CSRF attacks
  const state = Math.random().toString(36).substring(2, 15)

  // Construct the Upstox authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state: state,
  })
  
  const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?${params.toString()}`

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      'Set-Cookie': cookie(STATE_COOKIE, state, STATE_TTL_SECONDS),
    },
  })
}
