# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Landing page at `/` — header, short description, and a footer with the release
  version and a GitHub link (`GITHUB_URL`, configurable in `.env`). Replaces the
  placeholder hello-world page.

### Changed

- Connector logo art is now a padlock-with-lightning-bolt mark (light/dark variants).
- Logto-native redirect config: set `LOGTO_ENDPOINT` + `LOGTO_CONNECTOR_ID` and the
  bridge registers both callback URLs Logto uses by purpose — **sign-in**
  (`/callback/<id>`) and **account linking** (`/account/callback/social/<id>`) —
  instead of hand-listing URLs. `OIDC_REDIRECT_URIS` remains as an advanced
  escape hatch (non-Logto / custom URLs), unioned with the derived ones.
- Unified the user-facing screens (landing, login, error) on one tsp.tools-styled
  design via a shared `pageShell`, with a single footer combining the release
  version + GitHub link and the "keine E-Mail, kein Passwort" tagline. The root
  page now uses the same card design as the login screen.

## [0.0.2] - 2026-06-08

The first functional release: a complete LNURL-auth → OpenID Connect bridge.

### Added

- OIDC provider surface: `/.well-known/openid-configuration` discovery and
  `/jwks.json`, advertising the Authorization Code + RS256 surface with endpoints
  derived from `OIDC_ISSUER`.
- LNURL-auth login flow: `/authorize` validates the registered client and renders
  a QR login page; `/lnurl/callback` verifies the wallet's secp256k1 signature
  over the `k1` challenge (LUD-04); `/lnurl/status` polls and redirects back to
  the client with a one-time authorization code once signed.
- Token endpoint: `POST /token` exchanges the authorization code for a signed
  RS256 ID token whose `sub` is the lowercase-hex wallet pubkey
  (`iss`/`aud`/`iat`/`exp`/`auth_time`/`nonce`), verifiable via `/jwks.json`.
  Client auth via `client_secret_basic` / `client_secret_post`; PKCE (S256)
  enforced when a `code_challenge` was supplied; single-use codes.
- Signing key management: `OIDC_PRIVATE_KEY` (inline PEM) or
  `OIDC_PRIVATE_KEY_FILE` (load if present, else generate + persist `0600` on
  first boot); `kid` defaults to the RFC 7638 JWK thumbprint.
- Registered-client config via `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` /
  `OIDC_REDIRECT_URIS`; in-memory stores for pending challenges and codes
  (TTL, single-use, bounded).
- Connector logos served at `/logo.svg` and `/logo-dark.svg` for Logto's
  social-connector branding; source files in `assets/`.
- Tests: unit (`node:test`) for signing-key resolution and challenge/code expiry;
  Playwright e2e for the OIDC surface, the login flow, token-endpoint auth, and
  `/authorize` hardening; a cross-service integration test (`compose.e2e.yml` +
  a mock Logto-style OIDC relying party) driving a real browser login.
- CI: GitHub Actions running lint, unit, e2e, and the integration test on every
  push and PR.
- Documentation: README (overview, endpoints, quickstart), `docs/logto-setup.md`,
  and `docs/install.md`; an example `compose.yml` for VPS deploy behind Traefik;
  `.dockerignore`.

### Changed

- Hardened `/authorize`: `prompt=none` → `login_required` (we can't authenticate
  silently); `request`/`request_uri` rejected as unsupported; a `code_challenge`
  must use `S256` (matching discovery — `plain` and implicit-plain are rejected);
  duplicate security-critical params (arrays) are rejected; client input is never
  reflected into HTML. The in-memory store is bounded (oldest evicted at capacity)
  so an anonymous `/authorize` flood can't grow memory without limit.
- An ephemeral signing key is **rejected in production** (`NODE_ENV=production`):
  the bridge refuses to start rather than issue tokens that won't survive a restart.

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
