import { test, expect } from '@playwright/test'

test('openid-configuration advertises the OIDC surface', async ({ request }) => {
  const res = await request.get('/.well-known/openid-configuration')
  expect(res.status()).toBe(200)

  const doc = await res.json()
  expect(typeof doc.issuer).toBe('string')
  expect(doc.issuer.length).toBeGreaterThan(0)
  expect(doc.issuer.endsWith('/')).toBe(false)

  // Endpoints are derived from the issuer.
  expect(doc.authorization_endpoint).toBe(`${doc.issuer}/authorize`)
  expect(doc.token_endpoint).toBe(`${doc.issuer}/token`)
  expect(doc.jwks_uri).toBe(`${doc.issuer}/jwks.json`)

  // Only the Authorization Code flow with RS256, per Logto's connector.
  expect(doc.response_types_supported).toContain('code')
  expect(doc.grant_types_supported).toContain('authorization_code')
  expect(doc.subject_types_supported).toContain('public')
  expect(doc.id_token_signing_alg_values_supported).toContain('RS256')
  expect(doc.scopes_supported).toContain('openid')
})

test('jwks.json exposes a public RS256 key with no private material', async ({ request }) => {
  const res = await request.get('/jwks.json')
  expect(res.status()).toBe(200)

  const jwks = await res.json()
  expect(Array.isArray(jwks.keys)).toBe(true)
  expect(jwks.keys.length).toBeGreaterThanOrEqual(1)

  const key = jwks.keys[0]
  expect(key.kty).toBe('RSA')
  expect(key.use).toBe('sig')
  expect(key.alg).toBe('RS256')
  expect(typeof key.kid).toBe('string')
  expect(key.kid.length).toBeGreaterThan(0)
  expect(typeof key.n).toBe('string')
  expect(key.e).toBe('AQAB')

  // Private components must never be published.
  for (const priv of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
    expect(key[priv]).toBeUndefined()
  }
})

test('discovery jwks_uri and jwks endpoint are consistent', async ({ request }) => {
  const doc = await (await request.get('/.well-known/openid-configuration')).json()
  const jwks = await (await request.get('/jwks.json')).json()
  expect(doc.jwks_uri.endsWith('/jwks.json')).toBe(true)
  expect(jwks.keys[0].kid).toBeTruthy()
})
