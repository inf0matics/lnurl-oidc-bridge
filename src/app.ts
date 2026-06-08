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

const homePage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>lnurl-oidc-bridge</title>
  </head>
  <body>
    <main>
      <h1>hello world</h1>
    </main>
  </body>
</html>
`

/** Build the h3 app for the given configuration. */
export function createBridgeApp(config: Config) {
  const app = createApp()
  const router = createRouter()

  router.get(
    '/',
    defineEventHandler((event) => {
      setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
      return homePage
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
