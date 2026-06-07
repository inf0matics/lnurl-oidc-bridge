import type { Config } from './config'

/** OpenID Provider Metadata (OIDC Discovery 1.0). */
export function discoveryDocument(config: Config) {
  const { issuer } = config
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    jwks_uri: `${issuer}/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    code_challenge_methods_supported: ['S256'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'auth_time', 'nonce'],
  }
}

/** JWK Set served at /jwks.json — public signing key(s) only. */
export function jwksDocument(config: Config) {
  return { keys: [config.signingKey.publicJwk] }
}
