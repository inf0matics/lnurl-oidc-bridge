# Connecting Logto

Wire **lnurl-oidc-bridge** into a self-hosted [Logto](https://logto.io) as a
**Standard OIDC connector**, so users can sign in with a Lightning wallet
alongside username/password. Logto speaks plain OIDC (Authorization Code flow)
to the bridge; the bridge turns a signed LNURL-auth challenge into an OIDC
identity whose `sub` is the wallet's public key.

## Prerequisites

- A reachable, **HTTPS** public URL for the bridge (Logto and wallets must both
  reach it). This becomes your `OIDC_ISSUER`.
- A self-hosted Logto instance with admin access.

## 1. Signing key

ID tokens are signed with a **stable** RS256 key. The recommended container
setup ([install.md](install.md)) mounts a `./data` volume with
`OIDC_PRIVATE_KEY_FILE=/app/data/signing.pem` — generated on first boot, no
manual step; you only set the issuer:

```bash
OIDC_ISSUER=https://lnurl-oidc.example.com
```

To supply the key yourself, generate one and set `OIDC_PRIVATE_KEY` to its PEM:

```bash
openssl genpkey -algorithm RSA -out signing.pem -pkeyopt rsa_keygen_bits:2048
```

With neither set, the bridge refuses to start in production.

## 2. Create the connector in Logto

1. In the Logto Console, go to **Connectors → Social connectors → Add → Standard OIDC** (the official `@logto/connector-oidc`).
2. Choose a **client id** and **client secret** for Logto to use with the bridge.
3. Fill in the endpoints from the bridge's discovery document
   (`https://lnurl-oidc.example.com/.well-known/openid-configuration`):

   | Logto field | Value |
   | --- | --- |
   | `clientId` | the client id you chose |
   | `clientSecret` | the client secret you chose |
   | `issuer` | `https://lnurl-oidc.example.com` |
   | `authorizationEndpoint` | `https://lnurl-oidc.example.com/authorize` |
   | `tokenEndpoint` | `https://lnurl-oidc.example.com/token` |
   | `jwksUri` | `https://lnurl-oidc.example.com/jwks.json` |
   | `scope` | `openid` |
   | grant type | **Authorization Code** (the only one supported) |

4. **Branding (logo).** The connector form asks for a **Connector logo URL** and a
   **dark version**. The bridge serves both as scalable SVGs:

   | Logto field | Value |
   | --- | --- |
   | Connector logo URL | `https://lnurl-oidc.example.com/logo.svg` |
   | Dark version | `https://lnurl-oidc.example.com/logo-dark.svg` |

   These are a padlock-with-lightning-bolt mark (tuned for light and dark
   backgrounds respectively). The source files live in [assets/](../assets/) if
   you'd rather host them elsewhere or customise them.

5. Save. Logto shows the connector's **callback/redirect URI**, e.g.
   `https://<your-logto>/callback/<connector-id>`. Copy it.

## 3. Configure the bridge's client

Mirror the same credentials into the bridge's environment, plus your **Logto
endpoint**, then restart the bridge:

```bash
OIDC_CLIENT_ID=<the client id you chose in Logto>
OIDC_CLIENT_SECRET=<the client secret you chose in Logto>
LOGTO_ENDPOINT=https://<your-logto>
```

`OIDC_CLIENT_ID` is the OAuth client identity (you chose it in Logto).
`LOGTO_ENDPOINT` is your Logto instance URL — the bridge accepts **both** callback
URLs Logto uses, under that origin, so you don't configure them per connector:

- **Sign-in** (sign-in experience): `<endpoint>/callback/<connector-id>`
- **Account linking** (Account Center): `<endpoint>/account/callback/social/<connector-id>`

A redirect URL whose origin doesn't match `LOGTO_ENDPOINT` (or an unexpected path)
is what causes **"Unregistered or missing redirect_uri"** on `/authorize`.

> Advanced: for non-Logto clients or custom callback URLs you can still set
> `OIDC_REDIRECT_URIS` (space/comma separated, exact-matched), in addition to the
> Logto origin.

## 4. Enable it for sign-in (and, optionally, account linking)

**Sign-in button.** Go to **Sign-in & account → Sign-up and sign-in** and, under
**Social sign-in**, **add the connector** so a "Sign in with Lightning" button
appears.

**Account-center linking** (letting an existing user link a Lightning identity
from their profile) is gated separately: go to **Sign-in & account → Account
center**, toggle **Enable Account API**, and set the **Social** field to **Edit**
(options are `Off` / `ReadOnly` / `Edit`). If it's `Off`/`ReadOnly`, linking
fails with **"This social sign-in method is not enabled"** even though sign-in
works.

## How the login flows

Logto redirects to `/authorize` → the bridge shows an LNURL-auth QR → the wallet
signs `k1` and calls `/lnurl/callback` → the bridge mints a one-time code and
redirects back to Logto → Logto exchanges it at `/token` for an RS256 ID token
(`sub` = wallet pubkey), verified against `/jwks.json`.

## Notes

- **PKCE**: if Logto's connector sends a `code_challenge`, the bridge enforces
  S256 PKCE at the token endpoint. No extra config needed.
- **Profile data**: LNURL-auth provides no name/email — only the public key.
  Logto identifies the user by `sub`; any display name is up to Logto.
- **No userinfo endpoint**: the standard OIDC connector reads `sub` from the ID
  token, so a userinfo endpoint is not required.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `redirect_uri` error on `/authorize` | `LOGTO_ENDPOINT` not set, or its origin doesn't match Logto's callback URL |
| "This social sign-in method is not enabled" when **signing in** | Connector not enabled in **Sign-in & account → Sign-up and sign-in → Social sign-in** (step 4) |
| "This social sign-in method is not enabled" when **linking from the Account Center** (sign-in works) | First: **Sign-in & account → Account center**: enable the Account API and set the **Social** field to **Edit** (step 4). If that's already set, **upgrade Logto to ≥ 1.40.0** — earlier versions had a bug in the account-center social-linking callback (it never exchanged the code at `/token`); fixed in 1.40.0 |
| `invalid_client` at `/token` | `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` mismatch with Logto |
| ID token signature fails in Logto | `OIDC_ISSUER` mismatch, or signing key changed (ephemeral key + restart) |
| Wallet can't reach the callback | Bridge not publicly reachable over HTTPS |
