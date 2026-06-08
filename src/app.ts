import { createApp, createRouter, defineEventHandler, setResponseHeader } from 'h3'
import type { Config } from './config'
import { discoveryDocument, jwksDocument } from './oidc'
import { AuthStore } from './store'
import { createAuthHandlers } from './auth'
import { LOGO_DARK, LOGO_LIGHT } from './logos'

function svgHandler(svg: string) {
  return defineEventHandler((event) => {
    setResponseHeader(event, 'content-type', 'image/svg+xml; charset=utf-8')
    setResponseHeader(event, 'cache-control', 'public, max-age=86400')
    return svg
  })
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

function homePage(config: Config): string {
  const repo = escapeHtml(config.repoUrl)
  const version = escapeHtml(config.version)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>lnurl-oidc-bridge</title>
    <link rel="icon" href="/logo.svg" />
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0; min-height: 100vh; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 1.5rem; padding: 2rem;
        font: 16px/1.6 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        color: #1a1a2e; background: #f7f8fc;
      }
      main { max-width: 32rem; text-align: center; }
      .logo { width: 56px; height: auto; margin-bottom: 1rem; }
      h1 { margin: 0 0 .5rem; font-size: 1.6rem; letter-spacing: -.01em; }
      p { margin: 0; color: #4a4a63; }
      footer { font-size: .85rem; color: #7a7a90; }
      footer a { color: inherit; }
      @media (prefers-color-scheme: dark) {
        body { color: #e8e8f0; background: #16161a; }
        p { color: #b8b8c8; }
        footer { color: #8a8a9a; }
      }
    </style>
  </head>
  <body>
    <main>
      <img class="logo" src="/logo.svg" alt="" width="56" height="61" />
      <h1>lnurl-oidc-bridge</h1>
      <p>
        Sign in with a Lightning wallet, get a standard OpenID Connect identity.
        This service turns an LNURL-auth challenge into a signed OIDC ID token —
        no email, no password.
      </p>
    </main>
    <footer>
      <span>v${version}</span> · <a href="${repo}" rel="noreferrer">GitHub</a>
    </footer>
  </body>
</html>
`
}

/** Build the h3 app for the given configuration. */
export function createBridgeApp(config: Config) {
  const app = createApp()
  const router = createRouter()

  const landing = homePage(config)
  router.get(
    '/',
    defineEventHandler((event) => {
      setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
      return landing
    }),
  )

  // OIDC Discovery — lets clients (and Logto) fetch the provider metadata.
  router.get(
    '/.well-known/openid-configuration',
    defineEventHandler(() => discoveryDocument(config)),
  )

  // Public signing keys for verifying issued ID tokens.
  router.get(
    '/jwks.json',
    defineEventHandler(() => jwksDocument(config)),
  )

  // Connector logos (stable URLs for Logto's social-connector config).
  router.get('/logo.svg', svgHandler(LOGO_LIGHT))
  router.get('/logo-dark.svg', svgHandler(LOGO_DARK))

  // LNURL-auth login flow.
  const auth = createAuthHandlers(config, new AuthStore())
  router.get('/authorize', auth.authorize)
  router.get('/lnurl/callback', auth.callback)
  router.get('/lnurl/status', auth.status)
  router.post('/token', auth.token)

  app.use(router)
  return app
}
