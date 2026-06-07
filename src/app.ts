import { createApp, createRouter, defineEventHandler, setResponseHeader } from 'h3'

const page = `<!doctype html>
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

export const app = createApp()

const router = createRouter()

router.get(
  '/',
  defineEventHandler((event) => {
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return page
  }),
)

app.use(router)
