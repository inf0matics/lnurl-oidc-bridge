import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
} from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** A loaded RS256 signing key plus its published public JWK. */
export interface SigningKey {
  privateKey: KeyObject
  /** Public JWK as served at /jwks.json (no private components). */
  publicJwk: JsonWebKey & { kid: string; use: 'sig'; alg: 'RS256' }
  kid: string
}

/** A relying party allowed to use the bridge (e.g. a Logto instance). */
export interface ClientConfig {
  clientId: string
  clientSecret: string
  /** Exact-match allowed redirect URIs. */
  redirectUris: string[]
}

export interface Config {
  /** Public issuer URL, no trailing slash. Base for all OIDC endpoints. */
  issuer: string
  signingKey: SigningKey
  /** Registered OIDC clients. Empty until configured via env. */
  clients: ClientConfig[]
}

/** Find a registered client by id. */
export function findClient(config: Config, clientId: string): ClientConfig | undefined {
  return config.clients.find((c) => c.clientId === clientId)
}

function loadClients(env: NodeJS.ProcessEnv): ClientConfig[] {
  const clientId = env.OIDC_CLIENT_ID?.trim()
  if (!clientId) return []
  const redirectUris = (env.OIDC_REDIRECT_URIS ?? '')
    .split(/[\s,]+/)
    .map((u) => u.trim())
    .filter(Boolean)
  return [
    {
      clientId,
      clientSecret: env.OIDC_CLIENT_SECRET?.trim() ?? '',
      redirectUris,
    },
  ]
}

/** RFC 7638 JWK thumbprint for an RSA public key, used as a stable `kid`. */
function rsaThumbprint(jwk: JsonWebKey): string {
  const canonical = JSON.stringify({ e: jwk.e, kty: jwk.kty, n: jwk.n })
  return createHash('sha256').update(canonical).digest('base64url')
}

function generateRsaKey(): KeyObject {
  return generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
}

/**
 * Load a signing key from a file, generating and persisting one (0600) on first
 * boot if it doesn't exist yet. This is the data-directory pattern: mount a
 * volume and point `OIDC_PRIVATE_KEY_FILE` at a path inside it.
 */
function loadOrCreateKeyFile(path: string): KeyObject {
  if (existsSync(path)) {
    return createPrivateKey({ key: readFileSync(path, 'utf8'), format: 'pem' })
  }
  const privateKey = generateRsaKey()
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, pem, { mode: 0o600 })
  chmodSync(path, 0o600) // enforce 0600 regardless of umask
  console.warn(`[oidc] Generated a new RSA signing key at ${path} (first boot).`)
  return privateKey
}

/**
 * Load the RS256 signing key, in precedence order:
 *   1. `OIDC_PRIVATE_KEY`      — inline PEM (PKCS#8).
 *   2. `OIDC_PRIVATE_KEY_FILE` — load if present, else generate + persist (0600).
 *   3. none — ephemeral key for local dev. In production (`NODE_ENV=production`)
 *      this is a fatal error: we refuse to start without a durable key.
 */
export function loadSigningKey(env: NodeJS.ProcessEnv = process.env): SigningKey {
  let privateKey: KeyObject
  const inlinePem = env.OIDC_PRIVATE_KEY?.trim()
  const keyFile = env.OIDC_PRIVATE_KEY_FILE?.trim()

  if (inlinePem) {
    privateKey = createPrivateKey({ key: inlinePem, format: 'pem' })
  } else if (keyFile) {
    privateKey = loadOrCreateKeyFile(keyFile)
  } else if (env.NODE_ENV === 'production') {
    throw new Error(
      'No signing key configured. Set OIDC_PRIVATE_KEY (inline PEM) or ' +
        'OIDC_PRIVATE_KEY_FILE (a path on a mounted volume; the key is generated on first ' +
        'boot). Refusing to start in production with an ephemeral key.',
    )
  } else {
    privateKey = generateRsaKey()
    console.warn(
      '[oidc] No signing key configured — generated an ephemeral RSA key (dev only; tokens ' +
        'will not verify across restarts). Set OIDC_PRIVATE_KEY or OIDC_PRIVATE_KEY_FILE for production.',
    )
  }

  if (privateKey.asymmetricKeyType !== 'rsa') {
    throw new Error(
      `Signing key must be an RSA key for RS256 (got ${privateKey.asymmetricKeyType}).`,
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
  return { issuer, signingKey: loadSigningKey(env), clients: loadClients(env) }
}
