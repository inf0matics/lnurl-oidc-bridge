// Minimal OIDC Relying Party that stands in for Logto: it drives the
// Authorization Code flow against the bridge and verifies the resulting ID
// token. Browser-facing redirects use BRIDGE_PUBLIC_URL; the back-channel
// token/JWKS calls use BRIDGE_INTERNAL_URL (the in-network address).
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const PORT = Number(process.env.PORT ?? 3000)
const trim = (u) => (u ?? '').replace(/\/+$/, '')
const BRIDGE_PUBLIC = trim(process.env.BRIDGE_PUBLIC_URL)
const BRIDGE_INTERNAL = trim(process.env.BRIDGE_INTERNAL_URL) || BRIDGE_PUBLIC
const RP_PUBLIC = trim(process.env.RP_PUBLIC_URL)
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET

const pending = new Map() // state -> nonce
const JWKS = createRemoteJWKSet(new URL(`${BRIDGE_INTERNAL}/jwks.json`))

function html(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' })
  res.end(`<!doctype html><html lang="en"><body>${body}</body></html>`)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  try {
    if (url.pathname === '/healthz') {
      res.writeHead(200)
      res.end('ok')
      return
    }

    // Start login → redirect the browser to the bridge's authorize endpoint.
    if (url.pathname === '/' || url.pathname === '/login') {
      const state = randomBytes(16).toString('hex')
      const nonce = randomBytes(16).toString('hex')
      pending.set(state, nonce)
      const auth = new URL(`${BRIDGE_PUBLIC}/authorize`)
      auth.searchParams.set('response_type', 'code')
      auth.searchParams.set('client_id', CLIENT_ID)
      auth.searchParams.set('redirect_uri', `${RP_PUBLIC}/callback`)
      auth.searchParams.set('scope', 'openid')
      auth.searchParams.set('state', state)
      auth.searchParams.set('nonce', nonce)
      res.writeHead(302, { location: auth.toString() })
      res.end()
      return
    }

    // Bridge redirects back here with code+state → exchange + verify.
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const nonce = pending.get(state)
      if (!code || !state || nonce === undefined) return html(res, 400, '<p>bad callback</p>')
      pending.delete(state)

      const tokRes = await fetch(`${BRIDGE_INTERNAL}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${RP_PUBLIC}/callback`,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        }),
      })
      if (!tokRes.ok) return html(res, 502, `<p>token error ${tokRes.status}</p>`)
      const tok = await tokRes.json()

      // Verify the ID token against the bridge's JWKS, issuer + audience + nonce.
      const { payload } = await jwtVerify(tok.id_token, JWKS, {
        issuer: BRIDGE_PUBLIC,
        audience: CLIENT_ID,
      })
      if (payload.nonce !== nonce) return html(res, 400, '<p>nonce mismatch</p>')

      return html(res, 200, `<h1>Logged in</h1><p data-testid="identity">${payload.sub}</p>`)
    }

    res.writeHead(404)
    res.end('not found')
  } catch (e) {
    html(res, 500, `<pre>${String((e && e.message) || e)}</pre>`)
  }
})

server.listen(PORT, () =>
  console.log(`mock-rp on :${PORT} → bridge public ${BRIDGE_PUBLIC} / internal ${BRIDGE_INTERNAL}`),
)
