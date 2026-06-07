import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AuthStore, AUTH_REQUEST_TTL_MS, AUTH_CODE_TTL_MS } from '../../src/store.ts'

const baseReq = {
  clientId: 'c',
  redirectUri: 'https://rp.example/cb',
  scope: 'openid',
  state: 'st',
  nonce: 'no',
  codeChallenge: undefined,
  codeChallengeMethod: undefined,
}

test('a pending auth request expires after its TTL', () => {
  let t = 1_000
  const store = new AuthStore(() => t)
  const req = store.createAuthRequest({ ...baseReq })

  assert.ok(store.getByK1(req.k1), 'present before TTL')
  t += AUTH_REQUEST_TTL_MS + 1
  assert.equal(store.getByK1(req.k1), undefined, 'gone after TTL')
  assert.equal(store.getBySession(req.sessionId), undefined, 'session lookup also gone')
})

test('an authorization code expires after its (shorter) TTL', () => {
  let t = 1_000
  const store = new AuthStore(() => t)
  const req = store.createAuthRequest({ ...baseReq })
  const code = store.markSigned(req, 'deadbeef')

  t += AUTH_CODE_TTL_MS + 1
  assert.equal(store.takeCode(code.code), undefined, 'expired code is not redeemable')
})

test('an authorization code is single-use', () => {
  const store = new AuthStore(() => 1_000)
  const req = store.createAuthRequest({ ...baseReq })
  const code = store.markSigned(req, 'deadbeef')

  assert.ok(store.takeCode(code.code), 'first redemption works')
  assert.equal(store.takeCode(code.code), undefined, 'second redemption fails')
})

test('markSigned is idempotent — re-signing returns the same code', () => {
  const store = new AuthStore(() => 1_000)
  const req = store.createAuthRequest({ ...baseReq })
  const first = store.markSigned(req, 'deadbeef')
  const second = store.markSigned(req, 'deadbeef')
  assert.equal(second.code, first.code, 'no duplicate code minted on replay')
})
