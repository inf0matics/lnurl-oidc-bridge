import { test, expect, type APIRequestContext } from '@playwright/test'
import { bech32 } from '@scure/base'
import { secp256k1 } from '@noble/curves/secp256k1'
import { bytesToHex } from '@noble/curves/abstract/utils'

const CLIENT_ID = 'test-client'
const REDIRECT_URI = 'http://localhost:3000/cb'

function authorizeUrl(params: Record<string, string> = {}): string {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid',
    state: 'xyz-state',
    nonce: 'n-once',
    ...params,
  })
  return `/authorize?${q.toString()}`
}

/** Pull the bech32 LNURL string out of the rendered login page and decode the callback URL + k1. */
function extractLnurl(html: string): { lnurl: string; callback: URL; k1: string } {
  const match = html.match(/lnurl1[02-9ac-hj-np-z]+/i)
  if (!match) throw new Error('no LNURL found in page')
  const lnurl = match[0].toLowerCase()
  const decoded = bech32.decode(lnurl as `${string}1${string}`, 2000)
  const url = new TextDecoder().decode(Uint8Array.from(bech32.fromWords(decoded.words)))
  const callback = new URL(url)
  return { lnurl, callback, k1: callback.searchParams.get('k1') ?? '' }
}

/** Simulate a wallet: derive a linking key and sign the k1 challenge (DER, secp256k1). */
function signK1(k1Hex: string) {
  const priv = secp256k1.utils.randomPrivateKey()
  const pub = secp256k1.getPublicKey(priv, true) // compressed
  const sig = secp256k1.sign(k1Hex, priv) // k1 is the 32-byte prehashed digest
  return { key: bytesToHex(pub), sig: sig.toDERHex() }
}

async function startLogin(request: APIRequestContext) {
  const res = await request.get(authorizeUrl())
  expect(res.status()).toBe(200)
  const html = await res.text()
  return extractLnurl(html)
}

test('authorize renders an LNURL-auth login page with a QR and a login callback', async ({
  request,
}) => {
  const res = await request.get(authorizeUrl())
  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toContain('<img') // QR code image
  const { callback, k1 } = extractLnurl(html)
  expect(callback.pathname).toBe('/lnurl/callback')
  expect(callback.searchParams.get('tag')).toBe('login')
  expect(k1).toMatch(/^[0-9a-f]{64}$/)
})

test('authorize rejects an unknown client_id', async ({ request }) => {
  const res = await request.get(authorizeUrl({ client_id: 'nope' }))
  expect(res.status()).toBe(400)
})

test('authorize rejects an unregistered redirect_uri', async ({ request }) => {
  const res = await request.get(authorizeUrl({ redirect_uri: 'http://evil.example.com/cb' }))
  expect(res.status()).toBe(400)
})

test('a valid wallet signature issues an authorization code via status polling', async ({
  request,
}) => {
  const { k1 } = await startLogin(request)

  // Before signing, status is pending.
  const pending = await (await request.get('/lnurl/status')).json()
  expect(pending.status).toBe('pending')

  // Wallet signs and hits the LNURL callback.
  const { key, sig } = signK1(k1)
  const cb = await request.get(`/lnurl/callback?tag=login&k1=${k1}&sig=${sig}&key=${key}`)
  expect(cb.status()).toBe(200)
  expect((await cb.json()).status).toBe('OK')

  // Now the browser poll returns the redirect carrying code + state.
  const signed = await (await request.get('/lnurl/status')).json()
  expect(signed.status).toBe('signed')
  const next = new URL(signed.next)
  expect(`${next.origin}${next.pathname}`).toBe(REDIRECT_URI)
  expect(next.searchParams.get('state')).toBe('xyz-state')
  expect((next.searchParams.get('code') ?? '').length).toBeGreaterThan(10)
})

test('an invalid signature is rejected and the request stays pending', async ({ request }) => {
  const { k1 } = await startLogin(request)
  const { key } = signK1(k1)
  const badSig = '30060201010201ff' // structurally a DER int pair, wrong signature

  const cb = await request.get(`/lnurl/callback?tag=login&k1=${k1}&sig=${badSig}&key=${key}`)
  expect((await cb.json()).status).toBe('ERROR')

  const status = await (await request.get('/lnurl/status')).json()
  expect(status.status).toBe('pending')
})

test('callback with an unknown k1 errors', async ({ request }) => {
  const { key, sig } = signK1(''.padEnd(64, 'a'))
  const cb = await request.get(`/lnurl/callback?tag=login&k1=${'a'.repeat(64)}&sig=${sig}&key=${key}`)
  expect((await cb.json()).status).toBe('ERROR')
})
