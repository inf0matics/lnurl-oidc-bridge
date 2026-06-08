# Connecting Logto

This guide wires **lnurl-oidc-bridge** into a self-hosted [Logto](https://logto.io)
instance as a **Standard OIDC connector**, so users can sign in with a Lightning
wallet alongside username/password.

Logto never learns anything about LNURL — it speaks plain OIDC (Authorization
Code flow) to the bridge, and the bridge turns "a wallet signed a challenge"
into a standard OIDC identity whose `sub` is the wallet's public key.

## Prerequisites

- A reachable, **HTTPS** public URL for the bridge (Logto and wallets must both
  reach it). This becomes your `OIDC_ISSUER`.
- A self-hosted Logto instance with admin access.

## 1. Signing key

The bridge needs a **stable** RS256 key so issued ID tokens keep verifying
across restarts. The recommended container setup (see
[install.md](install.md)) mounts a `./data` volume and sets
`OIDC_PRIVATE_KEY_FILE=/app/data/signing.pem` — the key is generated and
persisted on first boot, no manual step. Just set the issuer:

```bash
OIDC_ISSUER=https://lnurl-oidc.example.com
```

Prefer to provide the key yourself? Generate one and set `OIDC_PRIVATE_KEY` to
its PEM contents instead:

```bash
openssl genpkey -algorithm RSA -out signing.pem -pkeyopt rsa_keygen_bits:2048
```

(`genpkey` already writes an unencrypted PKCS#8 PEM — `-----BEGIN PRIVATE KEY-----`.)
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

## 4. Enable it in your sign-in experience

In Logto, go to **Sign-in & account → Sign-up and sign-in** and, under **Social
sign-in**, **add the connector**. This both shows a "Sign in with Lightning"
button and — importantly — **enables the method for account linking**. The
Account Center only offers methods that are enabled here; without it you'll get
**"This social sign-in method is not enabled"** after a successful scan.

## How the login flows

1. User clicks **Sign in with Lightning**; Logto redirects to the bridge's
   `/authorize`.
2. The bridge renders a page with an LNURL-auth QR code.
3. The user scans it with an LNURL-auth capable wallet, which signs the `k1`
   challenge and calls `/lnurl/callback`.
4. The bridge verifies the secp256k1 signature, mints a one-time authorization
   code, and the page redirects back to Logto with `code` + `state`.
5. Logto calls `/token`, authenticating with its client secret, and receives a
   signed ID token whose `sub` is the wallet's lowercase-hex public key.
6. Logto verifies the token against `/jwks.json` and creates/links a user keyed
   on that `sub`.

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
| "This social sign-in method is not enabled" (after a successful scan) | Logto-side: the connector isn't enabled in **Sign-in & account → Sign-up and sign-in → Social sign-in**. Add it there (step 4) |
| `invalid_client` at `/token` | `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` mismatch with Logto |
| ID token signature fails in Logto | `OIDC_ISSUER` mismatch, or signing key changed (ephemeral key + restart) |
| Wallet can't reach the callback | Bridge not publicly reachable over HTTPS |
