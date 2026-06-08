import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadSigningKey } from '../../src/config'

const inlinePem = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
  type: 'pkcs8',
  format: 'pem',
}) as string

test('inline OIDC_PRIVATE_KEY is loaded and exposes only public JWK material', () => {
  const key = loadSigningKey({ OIDC_PRIVATE_KEY: inlinePem })
  assert.equal(key.publicJwk.kty, 'RSA')
  assert.equal(key.publicJwk.alg, 'RS256')
  assert.equal(key.publicJwk.use, 'sig')
  assert.ok(key.kid.length > 0)
  // no private components leak into the published JWK
  for (const priv of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
    assert.equal((key.publicJwk as unknown as Record<string, unknown>)[priv], undefined)
  }
})

test('OIDC_PRIVATE_KEY_FILE generates and persists a key on first boot, reuses it after', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lnurl-key-'))
  const path = join(dir, 'signing.pem')
  assert.equal(existsSync(path), false)

  const first = loadSigningKey({ OIDC_PRIVATE_KEY_FILE: path })
  assert.equal(existsSync(path), true)
  assert.match(readFileSync(path, 'utf8'), /BEGIN PRIVATE KEY/)
  // persisted 0600
  assert.equal(statSync(path).mode & 0o777, 0o600)

  const second = loadSigningKey({ OIDC_PRIVATE_KEY_FILE: path })
  // same key reused → same kid
  assert.equal(second.kid, first.kid)
})

test('no key in production is fatal', () => {
  assert.throws(() => loadSigningKey({ NODE_ENV: 'production' }), /Refusing to start in production/)
})

test('no key in dev falls back to an ephemeral key', () => {
  const key = loadSigningKey({ NODE_ENV: 'development' })
  assert.equal(key.publicJwk.kty, 'RSA')
  assert.ok(key.kid.length > 0)
})

test('inline key takes precedence over a key file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lnurl-key-'))
  const path = join(dir, 'unused.pem')
  loadSigningKey({ OIDC_PRIVATE_KEY: inlinePem, OIDC_PRIVATE_KEY_FILE: path })
  // the file path must be ignored when an inline key is present
  assert.equal(existsSync(path), false)
})
