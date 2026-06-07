import { SignJWT } from 'jose'
import type { Config } from './config'

/** ID token lifetime. Clients should rely on their own session afterwards. */
const ID_TOKEN_TTL_S = 3600

export interface IdTokenInput {
  /** Subject — the lowercase-hex wallet pubkey. */
  sub: string
  /** Audience — the client id. */
  aud: string
  nonce?: string
  /** Unix seconds the user authenticated (LNURL-auth sign time). */
  authTime?: number
}

/** Mint a signed RS256 OIDC ID token. */
export async function issueIdToken(config: Config, input: IdTokenInput): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const claims: Record<string, unknown> = {}
  if (input.nonce) claims.nonce = input.nonce
  if (input.authTime) claims.auth_time = input.authTime

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: config.signingKey.kid, typ: 'JWT' })
    .setIssuer(config.issuer)
    .setSubject(input.sub)
    .setAudience(input.aud)
    .setIssuedAt(now)
    .setExpirationTime(now + ID_TOKEN_TTL_S)
    .sign(config.signingKey.privateKey)
}

export const ID_TOKEN_LIFETIME_S = ID_TOKEN_TTL_S
