import { createApp, createRouter, defineEventHandler, setResponseHeader } from 'h3'
import type { Config } from './config'
import { discoveryDocument, jwksDocument } from './oidc'
import { AuthStore } from './store'
import { createAuthHandlers } from './auth'
import { LOGO_DARK, LOGO_LIGHT } from './logos'
import { pageShell } from './ui'

function svgHandler(svg: string) {
  return defineEventHandler((event) => {
    setResponseHeader(event, 'content-type', 'image/svg+xml; charset=utf-8')
    setResponseHeader(event, 'cache-control', 'public, max-age=86400')
    return svg
  })
}

function homePage(config: Config): string {
  return pageShell(config, {
    lang: 'en',
    title: 'lnurl-oidc-bridge',
    body: `      <img class="logo" src="/logo.svg" alt="" width="86" height="94" />
      <h1>lnurl-oidc-bridge</h1>
      <p class="subtitle">
        Sign in with a Lightning wallet, get a standard OpenID Connect identity.
        This service turns an LNURL-auth challenge into a signed OIDC ID token —
        no email, no password.
      </p>`,
  })
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
