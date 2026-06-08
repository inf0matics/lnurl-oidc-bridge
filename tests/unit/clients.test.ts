import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig, isRedirectAllowed, type ClientConfig } from '../../src/config'

const logtoClient: ClientConfig = {
  clientId: 'lob',
  clientSecret: 's',
  redirectUris: [],
  logtoOrigin: 'https://logto.example.com',
}

test('Logto sign-in and account-linking callbacks under the origin are allowed', () => {
  assert.ok(isRedirectAllowed(logtoClient, 'https://logto.example.com/callback/abc123'))
  assert.ok(
    isRedirectAllowed(logtoClient, 'https://logto.example.com/account/callback/social/abc123'),
  )
})

test('a different origin is rejected even with a valid path', () => {
  assert.equal(isRedirectAllowed(logtoClient, 'https://evil.example.com/callback/abc123'), false)
})

test('an unexpected path under the right origin is rejected', () => {
  assert.equal(isRedirectAllowed(logtoClient, 'https://logto.example.com/steal'), false)
  assert.equal(isRedirectAllowed(logtoClient, 'https://logto.example.com/callback/'), false)
})

test('explicit exact-match redirect URIs still work (escape hatch)', () => {
  const client: ClientConfig = {
    clientId: 'lob',
    clientSecret: 's',
    redirectUris: ['http://localhost:3210/cb'],
  }
  assert.ok(isRedirectAllowed(client, 'http://localhost:3210/cb'))
  assert.equal(isRedirectAllowed(client, 'http://localhost:3210/other'), false)
})

test('with no Logto origin and no exact match, nothing is allowed', () => {
  const client: ClientConfig = { clientId: 'lob', clientSecret: 's', redirectUris: [] }
  assert.equal(isRedirectAllowed(client, 'https://logto.example.com/callback/abc123'), false)
})

test('LOGTO_ENDPOINT populates the client origin (path/trailing slash ignored)', () => {
  const config = loadConfig({
    OIDC_CLIENT_ID: 'lob',
    LOGTO_ENDPOINT: 'https://logto.example.com/',
  })
  assert.equal(config.clients[0].logtoOrigin, 'https://logto.example.com')
})
