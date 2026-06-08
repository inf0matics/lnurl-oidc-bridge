# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## v0.0.2


### 🚀 Enhancements

- Scaffold h3 hello-world with Playwright e2e ([c540a4f](https://github.com/inf0matics/lnurl-oidc-bridge/commit/c540a4f))
- Add OIDC discovery and JWKS endpoints ([70b7dcc](https://github.com/inf0matics/lnurl-oidc-bridge/commit/70b7dcc))
- Add LNURL-auth login flow and authorization endpoint ([2eb3c13](https://github.com/inf0matics/lnurl-oidc-bridge/commit/2eb3c13))
- Add OIDC token endpoint issuing signed ID tokens ([2c94e40](https://github.com/inf0matics/lnurl-oidc-bridge/commit/2c94e40))
- Support OIDC_PRIVATE_KEY_FILE and forbid ephemeral key in prod ([1630ec7](https://github.com/inf0matics/lnurl-oidc-bridge/commit/1630ec7))
- Harden /authorize and bound the in-memory store ([a2cba4c](https://github.com/inf0matics/lnurl-oidc-bridge/commit/a2cba4c))
- Add connector logos served at /logo.svg and /logo-dark.svg ([192a039](https://github.com/inf0matics/lnurl-oidc-bridge/commit/192a039))

### 🩹 Fixes

- Correct signing-key command and add .dockerignore ([1fd87c7](https://github.com/inf0matics/lnurl-oidc-bridge/commit/1fd87c7))

### 📖 Documentation

- Add README and Logto setup guide ([ddf951f](https://github.com/inf0matics/lnurl-oidc-bridge/commit/ddf951f))
- Add example compose.yml for VPS deploy behind Traefik ([6696be2](https://github.com/inf0matics/lnurl-oidc-bridge/commit/6696be2))
- Add VPS install guide and link from README ([92b5d64](https://github.com/inf0matics/lnurl-oidc-bridge/commit/92b5d64))

### 🏡 Chore

- Add LICENSE ([cbc6093](https://github.com/inf0matics/lnurl-oidc-bridge/commit/cbc6093))

### ✅ Tests

- Cover token-endpoint auth, redirect binding, code expiry ([6da2dc7](https://github.com/inf0matics/lnurl-oidc-bridge/commit/6da2dc7))
- Add cross-service integration test with a mock Logto RP ([5b6002b](https://github.com/inf0matics/lnurl-oidc-bridge/commit/5b6002b))

### 🤖 CI

- Run lint and e2e tests on every push and PR ([28b3552](https://github.com/inf0matics/lnurl-oidc-bridge/commit/28b3552))

### ❤️ Contributors

- Inf0matics <fil@thespielplatz.com>

## [Unreleased]

### Added

- OIDC foundation (Slice 1): RS256 signing key loaded from `OIDC_PRIVATE_KEY`
  (ephemeral fallback for dev), published at `/jwks.json` (public key only).
- `/.well-known/openid-configuration` discovery document advertising the
  Authorization Code + RS256 surface, with endpoints derived from `OIDC_ISSUER`.
- `OIDC_ISSUER` / `OIDC_PRIVATE_KEY` / `OIDC_KEY_ID` env config.
- Connector logos served at `/logo.svg` and `/logo-dark.svg` (SVG, 24×24) for
  Logto's social-connector branding; source files in `assets/`.
- LNURL-auth login flow (Slice 2): `/authorize` validates the registered client
  and renders a QR login page; `/lnurl/callback` verifies the wallet's
  secp256k1 signature over the `k1` challenge (LUD-04); `/lnurl/status` polls and
  redirects back to the client with a one-time authorization code once signed.
- In-memory stores for pending challenges and authorization codes (TTL, single-use codes).
- Registered-client config via `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / `OIDC_REDIRECT_URIS`.
- OIDC token endpoint (Slice 3): `POST /token` exchanges the authorization code
  for a signed RS256 ID token whose `sub` is the lowercase-hex wallet pubkey
  (`iss`/`aud`/`iat`/`exp`/`auth_time`/`nonce`), verifiable via `/jwks.json`.
  Client auth via `client_secret_basic` / `client_secret_post`; PKCE (S256)
  enforced when a `code_challenge` was supplied; single-use codes. This
  completes the LNURL-auth → OIDC login loop for Logto's standard OIDC connector.
- README with a TL;DR overview, endpoint table, and quickstart.
- `docs/logto-setup.md` — step-by-step guide for wiring the bridge into Logto.
- CI: GitHub Actions workflow running lint + Playwright e2e on every push and PR.
- `.dockerignore` to keep `node_modules`/`.git`/build output out of the image build context.
- `OIDC_PRIVATE_KEY_FILE`: load the signing key from a path, or generate and
  persist one (`0600`) on first boot — the recommended container setup (mount a
  volume). Example `compose.yml` now mounts `./data` and uses it.
- Unit tests (`node:test`) covering signing-key resolution and challenge/code
  expiry; CI runs them too.
- Security/robustness e2e: token-endpoint client auth (basic/post, wrong/missing
  credentials), redirect_uri binding, and proof the authorization code is bound
  to the browser session (a third party can't poll it out).
- Integration test (`compose.e2e.yml` + a mock Logto-style OIDC relying party):
  drives a real browser login across two services and verifies the issued ID
  token. Runnable via `npm run test:integration`; also a CI job.

### Changed

- Hardened `/authorize`: `prompt=none` → `login_required` (we can't authenticate
  silently); `request`/`request_uri` rejected as unsupported; a `code_challenge`
  is required to use `S256` (matching what discovery advertises — `plain` and
  implicit-plain are rejected); duplicate security-critical params (arrays) are
  rejected; client input is never reflected into HTML. The in-memory store is now
  bounded (oldest evicted at capacity) so an anonymous `/authorize` flood can't
  grow memory without limit.
- The signing key is now resolved by precedence: `OIDC_PRIVATE_KEY` (inline PEM)
  → `OIDC_PRIVATE_KEY_FILE` (load-or-generate) → ephemeral. An ephemeral key is
  **rejected in production** (`NODE_ENV=production`): the bridge refuses to start
  rather than issue tokens that won't survive a restart.

### Fixed

- Corrected the signing-key generation command in the docs (`openssl genpkey`
  emits PKCS#8 by default; the `-pkcs8` flag is invalid and aborts the command).

## [0.0.1] - 2026-06-07

### Added

- Initial scaffold: plain **h3** (Node 24 + TypeScript) HTTP service serving a
  minimal `hello world` page at `/`.
- esbuild bundle to `.output/server/index.mjs` so the root `Dockerfile` runs it unchanged.
- Playwright e2e test asserting the home page renders `hello world`.
- ESLint (flat config) + tsconfig; `dev` / `build` / `start` / `lint` / `test:e2e` scripts.
- `.env.example` documenting `PORT` / `HOST` (config via env vars only).
