# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- OIDC foundation (Slice 1): RS256 signing key loaded from `OIDC_PRIVATE_KEY`
  (ephemeral fallback for dev), published at `/jwks.json` (public key only).
- `/.well-known/openid-configuration` discovery document advertising the
  Authorization Code + RS256 surface, with endpoints derived from `OIDC_ISSUER`.
- `OIDC_ISSUER` / `OIDC_PRIVATE_KEY` / `OIDC_KEY_ID` env config.
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

## [0.0.1] - 2026-06-07

### Added

- Initial scaffold: plain **h3** (Node 24 + TypeScript) HTTP service serving a
  minimal `hello world` page at `/`.
- esbuild bundle to `.output/server/index.mjs` so the root `Dockerfile` runs it unchanged.
- Playwright e2e test asserting the home page renders `hello world`.
- ESLint (flat config) + tsconfig; `dev` / `build` / `start` / `lint` / `test:e2e` scripts.
- `.env.example` documenting `PORT` / `HOST` (config via env vars only).
