import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
} from 'node:crypto'

/** A loaded RS256 signing key plus its published public JWK. */
export interface SigningKey {
  privateKey: KeyObject
  /** Public JWK as served at /jwks.json (no private components). */
  publicJwk: JsonWebKey & { kid: string; use: 'sig'; alg: 'RS256' }
  kid: string
}

export interface Config {
  /** Public issuer URL, no trailing slash. Base for all OIDC endpoints. */
  issuer: string
  signingKey: SigningKey
}

/** RFC 7638 JWK thumbprint for an RSA public key, used as a stable `kid`. */
function rsaThumbprint(jwk: JsonWebKey): string {
  const canonical = JSON.stringify({ e: jwk.e, kty: jwk.kty, n: jwk.n })
  return createHash('sha256').update(canonical).digest('base64url')
}

/**
 * Load the RS256 signing key. Uses `OIDC_PRIVATE_KEY` (PEM, PKCS#8) when set.
 * Falls back to an ephemeral key for local dev/e2e — tokens signed with it do
 * not survive a restart, which is fine until a real key is configured.
 */
export function loadSigningKey(env: NodeJS.ProcessEnv = process.env): SigningKey {
  let privateKey: KeyObject
  const pem = env.OIDC_PRIVATE_KEY?.trim()
  if (pem) {
    privateKey = createPrivateKey({ key: pem, format: 'pem' })
  } else {
    privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
    console.warn(
      '[oidc] OIDC_PRIVATE_KEY not set — generated an ephemeral RSA key (dev only; ' +
        'tokens will not verify across restarts).',
    )
  }

  if (privateKey.asymmetricKeyType !== 'rsa') {
    throw new Error(
      `OIDC_PRIVATE_KEY must be an RSA key for RS256 (got ${privateKey.asymmetricKeyType}).`,
    )
  }

  // Export the *public* JWK so no private components (d, p, q, ...) leak.
  const pub = createPublicKey(privateKey).export({ format: 'jwk' }) as JsonWebKey
  const kid = env.OIDC_KEY_ID?.trim() || rsaThumbprint(pub)

  return {
    privateKey,
    kid,
    publicJwk: { ...pub, use: 'sig', alg: 'RS256', kid },
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = env.PORT ?? '3000'
  const issuer = (env.OIDC_ISSUER?.trim() || `http://localhost:${port}`).replace(/\/+$/, '')
  return { issuer, signingKey: loadSigningKey(env) }
}
