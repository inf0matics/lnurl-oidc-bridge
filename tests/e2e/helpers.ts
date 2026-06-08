import { expect, type APIRequestContext } from '@playwright/test'
import { bech32 } from '@scure/base'
import { secp256k1 } from '@noble/curves/secp256k1'
import { bytesToHex } from '@noble/curves/abstract/utils'

// Must match playwright.config.ts (dedicated test port, not 3000).
export const ISSUER = 'http://localhost:3210'
export const CLIENT_ID = 'test-client'
export const CLIENT_SECRET = 'test-secret'
export const REDIRECT_URI = 'http://localhost:3210/cb'

export function authorizeUrl(params: Record<string, string> = {}): string {
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

/** Pull the bech32 LNURL out of the login page and decode the callback URL + k1. */
export function extractLnurl(html: string): { lnurl: string; callback: URL; k1: string } {
  const match = html.match(/lnurl1[02-9ac-hj-np-z]+/i)
  if (!match) throw new Error('no LNURL found in page')
  const lnurl = match[0].toLowerCase()
  const decoded = bech32.decode(lnurl as `${string}1${string}`, 2000)
  const url = new TextDecoder().decode(Uint8Array.from(bech32.fromWords(decoded.words)))
  const callback = new URL(url)
  return { lnurl, callback, k1: callback.searchParams.get('k1') ?? '' }
}

/** Simulate a wallet: derive a linking key and DER-sign the k1 challenge. */
export function signK1(k1Hex: string) {
  const priv = secp256k1.utils.randomPrivateKey()
  const pub = secp256k1.getPublicKey(priv, true)
  const sig = secp256k1.sign(k1Hex, priv)
  return { key: bytesToHex(pub), sig: sig.toDERHex() }
}

/** Drive authorize → wallet sign → status, returning the issued authorization code. */
export async function obtainCode(
  request: APIRequestContext,
  params: Record<string, string> = {},
): Promise<{ code: string; pubkey: string; k1: string }> {
  const html = await (await request.get(authorizeUrl(params))).text()
  const { k1 } = extractLnurl(html)
  const { key, sig } = signK1(k1)
  const cb = await request.get(`/lnurl/callback?tag=login&k1=${k1}&sig=${sig}&key=${key}`)
  expect((await cb.json()).status).toBe('OK')
  const signed = await (await request.get('/lnurl/status')).json()
  expect(signed.status).toBe('signed')
  const code = new URL(signed.next).searchParams.get('code') ?? ''
  return { code, pubkey: key.toLowerCase(), k1 }
}
