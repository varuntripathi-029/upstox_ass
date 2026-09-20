import { oauthConfig, readCookie, STATE_COOKIE, SESSION_COOKIE, clearCookie, cookie, sealSession, tokenExpiry, secondsUntil } from '../_lib/session.js'

export default async function (request: Request): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  
  if (error) {
    return new Response(`Upstox Authorization Failed: ${error}`, { status: 400 })
  }
  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 })
  }

  const savedState = readCookie(request, STATE_COOKIE)
  if (!savedState || savedState !== state) {
    return new Response('Invalid state (possible CSRF or expired)', { status: 400 })
  }

  const config = oauthConfig(request)
  if (!config) {
    return new Response('OAuth not configured', { status: 501 })
  }

  try {
    const tokenRes = await fetch('https://api.upstox.com/v2/login/authorization/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }).toString()
    })

    const data = await tokenRes.json()
    if (!tokenRes.ok) {
      console.error('Upstox token exchange failed', data)
      return new Response('Upstox token exchange failed', { status: 502 })
    }

    const expiresAt = tokenExpiry().toISOString()
    const sessionData = {
      accessToken: data.access_token,
      userName: data.user_name,
      userId: data.user_id,
      expiresAt,
    }

    const seal = await sealSession(sessionData, config.password)
    const ttl = secondsUntil(expiresAt)

    const headers = new Headers()
    headers.set('Location', '/')
    headers.append('Set-Cookie', cookie(SESSION_COOKIE, seal, ttl))
    headers.append('Set-Cookie', clearCookie(STATE_COOKIE))

    return new Response(null, {
      status: 302,
      headers
    })

  } catch (err) {
    console.error('Callback error', err)
    return new Response('Internal error during callback', { status: 500 })
  }
}
