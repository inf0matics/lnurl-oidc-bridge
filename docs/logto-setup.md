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

## 1. Generate a persistent signing key

Without `OIDC_PRIVATE_KEY` the bridge generates an ephemeral key at boot — fine
for local dev, but tokens stop verifying after a restart. For real use, generate
a stable RSA key:

```bash
openssl genpkey -algorithm RSA -out signing.pem -pkeyopt rsa_keygen_bits:2048
```

(`genpkey` already writes an unencrypted PKCS#8 PEM — `-----BEGIN PRIVATE KEY-----`.)

Set `OIDC_PRIVATE_KEY` to the PEM contents and `OIDC_ISSUER` to the bridge's
public URL (no trailing slash):

```bash
OIDC_ISSUER=https://lnurl-oidc.example.com
OIDC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
```

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

4. Save. Logto shows the connector's **callback/redirect URI**, e.g.
   `https://<your-logto>/callback/<connector-id>`. Copy it.

## 3. Configure the bridge's client

Mirror the same credentials and the Logto callback URI into the bridge's
environment, then restart the bridge:

```bash
OIDC_CLIENT_ID=<the client id you chose in Logto>
OIDC_CLIENT_SECRET=<the client secret you chose in Logto>
OIDC_REDIRECT_URIS=https://<your-logto>/callback/<connector-id>
```

`OIDC_REDIRECT_URIS` is exact-matched. Separate multiple URIs with spaces or commas.

## 4. Enable it in your sign-in experience

In Logto, add the connector to your **Sign-in experience** so a
"Sign in with Lightning" button appears.

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
| `redirect_uri` error on `/authorize` | Logto's callback URI not in `OIDC_REDIRECT_URIS` (must match exactly) |
| `invalid_client` at `/token` | `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` mismatch with Logto |
| ID token signature fails in Logto | `OIDC_ISSUER` mismatch, or signing key changed (ephemeral key + restart) |
| Wallet can't reach the callback | Bridge not publicly reachable over HTTPS |
