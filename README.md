# lnurl-oidc-bridge

**Turn Lightning wallet login into standard OpenID Connect.**

Users authenticate by signing an [LNURL-auth](https://github.com/lnurl/luds/blob/luds/04.md)
challenge with their wallet — no email, no password — and the bridge issues a
signed OIDC **ID token** whose `sub` is the wallet's public key. Any OIDC-capable
application (e.g. a self-hosted **[Logto](https://logto.io)** instance) can then
accept Lightning login without implementing LNURL itself.

```text
App / Logto ──/authorize──▶ Bridge shows LNURL QR ──▶ wallet signs k1
     ▲                                                      │
     │                                            /lnurl/callback (verify secp256k1)
     └──── ID token { sub: <pubkey> } ◀──/token──── code ◀──/lnurl/status
```

## Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/.well-known/openid-configuration` | GET | OIDC discovery document |
| `/jwks.json` | GET | Public RS256 signing key (verify ID tokens) |
| `/authorize` | GET | Start login → render the LNURL-auth QR page |
| `/lnurl/callback` | GET | Wallet submits its signature (LUD-04) |
| `/lnurl/status` | GET | Browser poll → redirect with `code` once signed |
| `/token` | POST | Exchange `code` → signed ID token |

`sub` is the wallet's compressed secp256k1 public key as lowercase hex.

## Quickstart

```bash
npm install
cp .env.example .env        # fill in OIDC_* values (see below)
npm run dev                 # http://localhost:3000
```

Then run the end-to-end suite (Playwright starts its own server):

```bash
npx playwright install chromium
npm run test:e2e
```

## Configuration

All config is via environment variables (see [.env.example](.env.example)):

| Variable | Description |
| --- | --- |
| `PORT` / `HOST` | HTTP bind (default `3000` / `0.0.0.0`) |
| `OIDC_ISSUER` | Public base URL, no trailing slash; all endpoints derive from it |
| `OIDC_PRIVATE_KEY` | RS256 signing key, PEM/PKCS#8. Ephemeral key generated if unset (**dev only**) |
| `OIDC_KEY_ID` | Optional `kid`; defaults to the RFC 7638 JWK thumbprint |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | Registered client credentials |
| `OIDC_REDIRECT_URIS` | Allowed redirect URIs (exact match; space/comma separated) |

## Connecting Logto

See **[docs/logto-setup.md](docs/logto-setup.md)** for the step-by-step guide to
wiring this bridge into a self-hosted Logto instance as a Standard OIDC connector.

## Deploy

Ships as a single Docker container behind Traefik. An example
[compose.yml](compose.yml) is included for a VPS — it's **stateless** (no
volumes; the signing key and config come from `.env`). Set `OIDC_ISSUER` to the
public HTTPS URL matching the Traefik `Host` rule.

## Stack

Node 24 + TypeScript on [h3](https://h3.dev). In-memory state (ephemeral
challenges + single-use codes) — no database. Bundled with esbuild to
`.output/server/index.mjs` and shipped as a single Docker container.

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Run with hot reload (tsx) |
| `npm run build` | Bundle to `.output/server/index.mjs` |
| `npm start` | Run the built bundle |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright end-to-end suite |

## License

See [LICENSE](LICENSE).
