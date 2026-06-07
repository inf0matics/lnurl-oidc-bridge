import { createServer } from 'node:http'
import { toNodeListener } from 'h3'
import { createBridgeApp } from './app'
import { loadConfig } from './config'

const config = loadConfig()
const app = createBridgeApp(config)

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'

createServer(toNodeListener(app)).listen(port, host, () => {
  console.log(`lnurl-oidc-bridge listening on http://${host}:${port} (issuer ${config.issuer})`)
})
