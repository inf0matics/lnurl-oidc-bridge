import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  defineEventHandler,
  getQuery,
  getCookie,
  setCookie,
  getRequestHeader,
  readBody,
  setResponseHeader,
  setResponseStatus,
  sendRedirect,
  type H3Event,
} from 'h3'
import QRCode from 'qrcode'
import type { ClientConfig, Config } from './config'
import { findClient } from './config'
import type { AuthStore } from './store'
import { encodeLnurl, verifyLnurlAuthSig } from './lnurl'
import { ID_TOKEN_LIFETIME_S, issueIdToken } from './token'

const SESSION_COOKIE = 'lnurl_session'

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

/** Append query params to a redirect URI, preserving any it already has. */
function withParams(uri: string, params: Record<string, string | undefined>): string {
  const url = new URL(uri)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v)
  }
  return url.toString()
}

/** Constant-time string comparison that also guards against length leaks. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** OAuth2 token error response (RFC 6749 §5.2). */
function oauthError(event: H3Event, status: number, error: string, description: string) {
  setResponseStatus(event, status)
  return { error, error_description: description }
}

type FormBody = Record<string, unknown>

/** Authenticate the client via client_secret_basic or client_secret_post. */
function authenticateClient(
  event: H3Event,
  body: FormBody,
  config: Config,
): ClientConfig | undefined {
  let clientId: string | undefined
  let secret: string | undefined

  const authHeader = getRequestHeader(event, 'authorization')
  if (authHeader?.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8')
    const sep = decoded.indexOf(':')
    if (sep >= 0) {
      clientId = decodeURIComponent(decoded.slice(0, sep))
      secret = decodeURIComponent(decoded.slice(sep + 1))
    }
  } else {
    clientId = str(body.client_id)
    secret = str(body.client_secret)
  }

  if (!clientId || secret === undefined) return undefined
  const client = findClient(config, clientId)
  if (!client) return undefined
  return safeEqual(secret, client.clientSecret) ? client : undefined
}

/** Verify a PKCE code_verifier against the stored challenge (RFC 7636). */
function verifyPkce(challenge: string, method: string | undefined, verifier: string): boolean {
  switch (method ?? 'plain') {
    case 'S256':
      return safeEqual(createHash('sha256').update(verifier).digest('base64url'), challenge)
    case 'plain':
      return safeEqual(verifier, challenge)
    default:
      return false
  }
}

function errorPage(event: H3Event, status: number, message: string): string {
  setResponseStatus(event, status)
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Error</title></head>
<body><main><h1>Sign-in error</h1><p>${message}</p></main></body></html>`
}

function loginPage(lnurl: string, qrDataUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sign in with Lightning</title>
  </head>
  <body>
    <main>
      <h1>Sign in with Lightning</h1>
      <p>Scan this code with an LNURL-auth capable Lightning wallet.</p>
      <a id="wallet-link" href="lightning:${lnurl}">
        <img alt="LNURL-auth QR code" src="${qrDataUrl}" width="280" height="280" />
      </a>
      <p><code id="lnurl">${lnurl}</code></p>
      <p id="status">Waiting for your wallet…</p>
    </main>
    <script>
      async function poll() {
        try {
          const r = await fetch('/lnurl/status', { headers: { accept: 'application/json' } })
          const d = await r.json()
          if (d.status === 'signed' && d.next) {
            document.getElementById('status').textContent = 'Signed in, redirecting…'
            window.location = d.next
            return
          }
          if (d.status === 'expired') {
            document.getElementById('status').textContent = 'This login expired. Please retry.'
            return
          }
        } catch (e) {}
        setTimeout(poll, 2000)
      }
      poll()
    </script>
  </body>
</html>
`
}

export function createAuthHandlers(config: Config, store: AuthStore) {
  /** OIDC Authorization Endpoint — starts an LNURL-auth login. */
  const authorize = defineEventHandler(async (event) => {
    const q = getQuery(event)
    const clientId = str(q.client_id)
    const redirectUri = str(q.redirect_uri)
    const responseType = str(q.response_type)
    const scope = str(q.scope) ?? ''
    const state = str(q.state)

    // redirect_uri / client_id are validated first and never trusted for redirects.
    const client = clientId ? findClient(config, clientId) : undefined
    if (!client) return errorPage(event, 400, 'Unknown or missing client_id.')
    if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
      return errorPage(event, 400, 'Unregistered or missing redirect_uri.')
    }

    // From here, request errors go back to the client per OIDC.
    if (responseType !== 'code') {
      return sendRedirect(event, withParams(redirectUri, { error: 'unsupported_response_type', state }))
    }
    if (!scope.split(/\s+/).includes('openid')) {
      return sendRedirect(event, withParams(redirectUri, { error: 'invalid_scope', state }))
    }

    const req = store.createAuthRequest({
      clientId: client.clientId,
      redirectUri,
      state,
      nonce: str(q.nonce),
      scope,
      codeChallenge: str(q.code_challenge),
      codeChallengeMethod: str(q.code_challenge_method),
    })

    setCookie(event, SESSION_COOKIE, req.sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    })

    const callback = `${config.issuer}/lnurl/callback?tag=login&k1=${req.k1}&action=login`
    const lnurl = encodeLnurl(callback)
    const qr = await QRCode.toDataURL(lnurl, { errorCorrectionLevel: 'M', margin: 1 })

    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return loginPage(lnurl, qr)
  })

  /** LNURL-auth callback (LUD-04) — the wallet submits its signature here. */
  const callback = defineEventHandler((event) => {
    const q = getQuery(event)
    const k1 = str(q.k1)
    const sig = str(q.sig)
    const key = str(q.key)

    if (!k1 || !sig || !key) {
      return { status: 'ERROR', reason: 'Missing k1, sig or key.' }
    }
    const req = store.getByK1(k1)
    if (!req) return { status: 'ERROR', reason: 'k1 not found or expired.' }

    if (req.status === 'signed') return { status: 'OK' } // idempotent re-submit

    if (!verifyLnurlAuthSig(k1, sig, key)) {
      return { status: 'ERROR', reason: 'Invalid signature.' }
    }

    store.markSigned(req, key.toLowerCase())
    return { status: 'OK' }
  })

  /** Browser poll — returns the redirect (with code+state) once the wallet signs. */
  const status = defineEventHandler((event) => {
    const sessionId = getCookie(event, SESSION_COOKIE)
    const req = sessionId ? store.getBySession(sessionId) : undefined
    if (!req) return { status: 'expired' }
    if (req.status !== 'signed' || !req.code) return { status: 'pending' }
    return {
      status: 'signed',
      next: withParams(req.redirectUri, { code: req.code, state: req.state }),
    }
  })

  /** OIDC Token Endpoint — exchange an authorization code for an ID token. */
  const token = defineEventHandler(async (event) => {
    setResponseHeader(event, 'cache-control', 'no-store')
    setResponseHeader(event, 'pragma', 'no-cache')

    const body = ((await readBody(event)) as FormBody) ?? {}

    const client = authenticateClient(event, body, config)
    if (!client) {
      return oauthError(event, 401, 'invalid_client', 'Client authentication failed.')
    }
    if (str(body.grant_type) !== 'authorization_code') {
      return oauthError(event, 400, 'unsupported_grant_type', 'Only authorization_code is supported.')
    }

    const code = str(body.code)
    if (!code) return oauthError(event, 400, 'invalid_request', 'Missing code.')

    const record = store.takeCode(code)
    if (!record) return oauthError(event, 400, 'invalid_grant', 'Unknown or expired code.')
    if (record.clientId !== client.clientId) {
      return oauthError(event, 400, 'invalid_grant', 'Code was issued to another client.')
    }
    if (str(body.redirect_uri) !== record.redirectUri) {
      return oauthError(event, 400, 'invalid_grant', 'redirect_uri mismatch.')
    }

    if (record.codeChallenge) {
      const verifier = str(body.code_verifier)
      if (!verifier || !verifyPkce(record.codeChallenge, record.codeChallengeMethod, verifier)) {
        return oauthError(event, 400, 'invalid_grant', 'PKCE verification failed.')
      }
    }

    const idToken = await issueIdToken(config, {
      sub: record.pubkey,
      aud: client.clientId,
      nonce: record.nonce,
      authTime: Math.floor(record.createdAt / 1000),
    })

    setResponseStatus(event, 200)
    return {
      access_token: randomBytes(24).toString('base64url'),
      token_type: 'Bearer',
      expires_in: ID_TOKEN_LIFETIME_S,
      id_token: idToken,
      scope: 'openid',
    }
  })

  return { authorize, callback, status, token }
}
