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
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>lnurl-oidc-bridge — Login with Lightning</title>
    <link rel="icon" href="/logo.svg" />
    <style>
      :root {
        --font-display: "Delicious-Heavy", "Trebuchet MS", sans-serif;
        --font-body: "Trebuchet MS", ui-sans-serif, system-ui, sans-serif;
        --orange: #f7941e; --orange-deep: #fbad18;
        --ink: #000; --charcoal: #3a3a3a; --navy: #101828;
        --bg: #f0f0f0; --card: #fff; --teal: #00baa7; --purple: #ac4bff; --gray: #666;
        --radius: 18px; --border: 4px solid var(--ink); --pop: 8px 8px 0 var(--ink);
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: var(--font-body);
        background:
          radial-gradient(circle at 18% 12%, rgba(247,148,30,.18), transparent 42%),
          radial-gradient(circle at 85% 88%, rgba(0,186,167,.14), transparent 45%),
          var(--bg);
        color: var(--navy); min-height: 100vh;
        display: flex; align-items: center; justify-content: center; padding: 24px;
      }
      .card {
        width: 100%; max-width: 400px; background: var(--card);
        border: var(--border); border-radius: var(--radius); box-shadow: var(--pop);
        padding: 32px 28px 26px; text-align: center;
      }
      .logo { width: 86px; height: auto; display: block; margin: 0 auto 14px; }
      h1 { font-family: var(--font-display); font-size: 1.6rem; letter-spacing: .3px; color: var(--navy); }
      h1 .lit { color: var(--orange); }
      .subtitle { color: var(--gray); font-size: .95rem; margin-top: 4px; }
      .qr-wrap {
        margin: 24px auto 14px; width: 232px; background: #fff;
        border: var(--border); border-radius: 14px; box-shadow: 5px 5px 0 var(--ink);
        padding: 16px; display: flex; align-items: center; justify-content: center;
      }
      .qr-wrap img { display: block; width: 200px; height: 200px; }
      .lnurl-row { display: flex; gap: 8px; margin: 10px auto 4px; align-items: stretch; }
      .lnurl-row input {
        flex: 1; font-family: ui-monospace, Menlo, monospace; font-size: .78rem;
        border: 3px solid var(--ink); border-radius: 10px; padding: 10px 12px;
        background: var(--bg); color: var(--navy); overflow: hidden; text-overflow: ellipsis;
      }
      button {
        font-family: var(--font-body); font-weight: 700; cursor: pointer;
        border: 3px solid var(--ink); border-radius: 10px;
        transition: transform .08s ease, box-shadow .08s ease;
      }
      button:active { transform: translate(3px,3px); }
      .btn-copy { background: var(--card); padding: 0 14px; }
      .btn-copy:hover { background: var(--bg); }
      .btn-wallet {
        display: block; text-align: center; text-decoration: none;
        width: 100%; margin-top: 14px; background: var(--orange); color: var(--ink);
        font-size: 1.05rem; padding: 14px; box-shadow: 5px 5px 0 var(--ink);
      }
      .btn-wallet:hover { background: var(--orange-deep); }
      .btn-wallet:active { box-shadow: 2px 2px 0 var(--ink); }
      .status {
        margin-top: 18px; font-size: .9rem; font-weight: 700;
        display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px;
        border-radius: 999px; border: 3px solid var(--ink); background: #fff;
      }
      .dot {
        width: 11px; height: 11px; border-radius: 50%; background: var(--orange);
        border: 2px solid var(--ink); animation: pulse 1s infinite ease-in-out;
      }
      .status.ok .dot { background: var(--teal); animation: none; }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
      footer { margin-top: 22px; font-size: .75rem; color: var(--gray); }
      footer a { color: var(--purple); font-weight: 700; text-decoration: none; }
    </style>
  </head>
  <body>
    <main class="card">
      <img class="logo" src="/logo.svg" alt="" width="86" height="94" />
      <h1>Login with <span class="lit">Lightning</span></h1>
      <p class="subtitle">Scan den QR-Code mit deiner Lightning-Wallet</p>

      <div class="qr-wrap"><img alt="LNURL-auth QR code" src="${qrDataUrl}" /></div>

      <div class="lnurl-row">
        <input id="lnurl" readonly value="${lnurl}" />
        <button class="btn-copy" id="copy" type="button">Copy</button>
      </div>

      <a class="btn-wallet" id="openWallet" href="lightning:${lnurl}" role="button">In Wallet öffnen ⚡</a>

      <div class="status" id="status"><span class="dot"></span><span id="statusText">Warte auf Signatur…</span></div>

      <footer>Powered by <a href="/">lnurl-oidc-bridge</a> · keine E-Mail, kein Passwort</footer>
    </main>

    <script>
      const lnurl = document.getElementById('lnurl').value
      document.getElementById('copy').onclick = async () => {
        try { await navigator.clipboard.writeText(lnurl) } catch (e) {}
        const b = document.getElementById('copy'); b.textContent = '✓'
        setTimeout(() => { b.textContent = 'Copy' }, 1200)
      }

      function markLoggedIn() {
        document.getElementById('status').classList.add('ok')
        document.getElementById('statusText').textContent = 'Eingeloggt ✓'
      }

      async function poll() {
        try {
          const r = await fetch('/lnurl/status', { headers: { accept: 'application/json' } })
          const d = await r.json()
          if (d.status === 'signed' && d.next) {
            markLoggedIn()
            setTimeout(() => { window.location = d.next }, 400)
            return
          }
          if (d.status === 'expired') {
            document.getElementById('statusText').textContent = 'Login abgelaufen — bitte neu laden.'
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
    const fail = (error: string) => sendRedirect(event, withParams(redirectUri, { error, state }))

    // Request objects (JAR) are not supported.
    if (str(q.request) !== undefined) return fail('request_not_supported')
    if (str(q.request_uri) !== undefined) return fail('request_uri_not_supported')

    if (responseType !== 'code') return fail('unsupported_response_type')
    if (!scope.split(/\s+/).includes('openid')) return fail('invalid_scope')

    // PKCE: we advertise only S256, so a challenge with any other method
    // (including the implicit "plain" default) is rejected here.
    const codeChallenge = str(q.code_challenge)
    if (codeChallenge !== undefined && str(q.code_challenge_method) !== 'S256') {
      return fail('invalid_request')
    }

    // We can never authenticate without interaction (the user must scan a QR),
    // so a silent-auth request cannot be satisfied.
    if ((str(q.prompt) ?? '').split(/\s+/).includes('none')) return fail('login_required')

    const req = store.createAuthRequest({
      clientId: client.clientId,
      redirectUri,
      state,
      nonce: str(q.nonce),
      scope,
      codeChallenge,
      codeChallengeMethod: codeChallenge !== undefined ? 'S256' : undefined,
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
