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

## [0.0.1] - 2026-06-07

### Added

- Initial scaffold: plain **h3** (Node 24 + TypeScript) HTTP service serving a
  minimal `hello world` page at `/`.
- esbuild bundle to `.output/server/index.mjs` so the root `Dockerfile` runs it unchanged.
- Playwright e2e test asserting the home page renders `hello world`.
- ESLint (flat config) + tsconfig; `dev` / `build` / `start` / `lint` / `test:e2e` scripts.
- `.env.example` documenting `PORT` / `HOST` (config via env vars only).
