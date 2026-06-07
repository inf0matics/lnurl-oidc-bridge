import { test, expect } from '@playwright/test'
import { createHash, randomBytes } from 'node:crypto'
import { createLocalJWKSet, jwtVerify } from 'jose'
import { obtainCode, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, ISSUER } from './helpers'

const b64url = (b: Buffer) => b.toString('base64url')

async function localJwks(request: import('@playwright/test').APIRequestContext) {
  const jwks = await (await request.get('/jwks.json')).json()
  return createLocalJWKSet(jwks)
}

test('exchanges an authorization code for a verifiable ID token', async ({ request }) => {
  const { code, pubkey } = await obtainCode(request)

  const res = await request.post('/token', {
    form: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    },
  })
  expect(res.status()).toBe(200)
  expect(res.headers()['cache-control']).toContain('no-store')

  const body = await res.json()
  expect(body.token_type).toBe('Bearer')
  expect(typeof body.access_token).toBe('string')
  expect(body.expires_in).toBeGreaterThan(0)
  expect(typeof body.id_token).toBe('string')

  // The ID token verifies against the published JWKS, with sub = wallet pubkey.
  const { payload, protectedHeader } = await jwtVerify(body.id_token, await localJwks(request), {
    issuer: ISSUER,
    audience: CLIENT_ID,
  })
  expect(protectedHeader.alg).toBe('RS256')
  expect(payload.sub).toBe(pubkey)
  expect(payload.nonce).toBe('n-once')
})

test('rejects an invalid client_secret with invalid_client', async ({ request }) => {
  const { code } = await obtainCode(request)
  const res = await request.post('/token', {
    form: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: 'wrong',
    },
  })
  expect(res.status()).toBe(401)
  expect((await res.json()).error).toBe('invalid_client')
})

test('an authorization code is single-use', async ({ request }) => {
  const { code } = await obtainCode(request)
  const form = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }
  expect((await request.post('/token', { form })).status()).toBe(200)

  const second = await request.post('/token', { form })
  expect(second.status()).toBe(400)
  expect((await second.json()).error).toBe('invalid_grant')
})

test('rejects an unsupported grant_type', async ({ request }) => {
  const res = await request.post('/token', {
    form: {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    },
  })
  expect(res.status()).toBe(400)
  expect((await res.json()).error).toBe('unsupported_grant_type')
})

test('enforces PKCE when a code_challenge was supplied', async ({ request }) => {
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const { code } = await obtainCode(request, {
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  // Wrong verifier is rejected.
  const bad = await request.post('/token', {
    form: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: 'not-the-verifier',
    },
  })
  expect(bad.status()).toBe(400)
  expect((await bad.json()).error).toBe('invalid_grant')

  // The same code is consumed; a fresh login with the correct verifier succeeds.
  const { code: code2 } = await obtainCode(request, {
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  const ok = await request.post('/token', {
    form: {
      grant_type: 'authorization_code',
      code: code2,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: verifier,
    },
  })
  expect(ok.status()).toBe(200)
  expect(typeof (await ok.json()).id_token).toBe('string')
})
