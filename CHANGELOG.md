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

## [0.0.1] - 2026-06-07

### Added

- Initial scaffold: plain **h3** (Node 24 + TypeScript) HTTP service serving a
  minimal `hello world` page at `/`.
- esbuild bundle to `.output/server/index.mjs` so the root `Dockerfile` runs it unchanged.
- Playwright e2e test asserting the home page renders `hello world`.
- ESLint (flat config) + tsconfig; `dev` / `build` / `start` / `lint` / `test:e2e` scripts.
- `.env.example` documenting `PORT` / `HOST` (config via env vars only).
