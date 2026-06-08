import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig, logtoRedirectUris } from '../../src/config'

test('logtoRedirectUris derives the sign-in and account-linking callbacks', () => {
  const uris = logtoRedirectUris('https://logto.example.com/', 'abc123')
  assert.deepEqual(uris, [
    'https://logto.example.com/callback/abc123', // sign-in
    'https://logto.example.com/account/callback/social/abc123', // account linking
  ])
})

test('a Logto endpoint + connector id registers both callbacks on the client', () => {
  const config = loadConfig({
    OIDC_CLIENT_ID: 'lob',
    OIDC_CLIENT_SECRET: 's',
    LOGTO_ENDPOINT: 'https://logto.example.com',
    LOGTO_CONNECTOR_ID: 'abc123',
  })
  const client = config.clients[0]
  assert.ok(client.redirectUris.includes('https://logto.example.com/callback/abc123'))
  assert.ok(
    client.redirectUris.includes('https://logto.example.com/account/callback/social/abc123'),
  )
  assert.equal(client.redirectUris.length, 2)
})

test('explicit OIDC_REDIRECT_URIS are unioned in (and de-duplicated)', () => {
  const config = loadConfig({
    OIDC_CLIENT_ID: 'lob',
    LOGTO_ENDPOINT: 'https://logto.example.com',
    LOGTO_CONNECTOR_ID: 'abc123',
    OIDC_REDIRECT_URIS:
      'http://localhost:3210/cb, https://logto.example.com/callback/abc123',
  })
  const uris = config.clients[0].redirectUris
  assert.ok(uris.includes('http://localhost:3210/cb'))
  // the duplicate Logto sign-in URI is not added twice
  assert.equal(uris.filter((u) => u === 'https://logto.example.com/callback/abc123').length, 1)
})
