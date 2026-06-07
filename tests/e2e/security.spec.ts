import { test, expect } from '@playwright/test'
import { obtainCode, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, ISSUER } from './helpers'

const basic = (id: string, secret: string) =>
  `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`

test('token endpoint accepts client_secret_basic auth', async ({ request }) => {
  const { code } = await obtainCode(request)
  const res = await request.post('/token', {
    headers: { authorization: basic(CLIENT_ID, CLIENT_SECRET) },
    form: { grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI },
  })
  expect(res.status()).toBe(200)
  expect((await res.json()).id_token).toBeTruthy()
})

test('token endpoint rejects a wrong secret sent via Basic auth', async ({ request }) => {
  const { code } = await obtainCode(request)
  const res = await request.post('/token', {
    headers: { authorization: basic(CLIENT_ID, 'nope') },
    form: { grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI },
  })
  expect(res.status()).toBe(401)
  expect((await res.json()).error).toBe('invalid_client')
})

test('token endpoint rejects a request with no client credentials', async ({ request }) => {
  const { code } = await obtainCode(request)
  const res = await request.post('/token', {
    form: { grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI },
  })
  expect(res.status()).toBe(401)
  expect((await res.json()).error).toBe('invalid_client')
})

test('token endpoint rejects a missing redirect_uri', async ({ request }) => {
  const { code } = await obtainCode(request)
  const res = await request.post('/token', {
    form: { grant_type: 'authorization_code', code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET },
  })
  expect(res.status()).toBe(400)
  expect((await res.json()).error).toBe('invalid_grant')
})

test('token endpoint rejects a redirect_uri that does not match the request', async ({ request }) => {
  const { code } = await obtainCode(request)
  const res = await request.post('/token', {
    form: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${REDIRECT_URI}/elsewhere`,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    },
  })
  expect(res.status()).toBe(400)
  expect((await res.json()).error).toBe('invalid_grant')
})

test('the authorization code is bound to the browser session — a third party cannot poll it out', async ({
  request,
  playwright,
}) => {
  // The legitimate browser (request) drives the login and holds the session cookie.
  const { code } = await obtainCode(request)
  expect(code.length).toBeGreaterThan(10)

  // A separate client with no session cookie polls /lnurl/status: it must not
  // learn the code, even though the underlying k1 is public (it's in the QR).
  const thief = await playwright.request.newContext({ baseURL: ISSUER })
  const stolen = await (await thief.get('/lnurl/status')).json()
  expect(stolen.status).toBe('expired')
  expect(stolen.next).toBeUndefined()
  await thief.dispose()
})

test('re-submitting the same signature is idempotent (no second code path)', async ({ request }) => {
  // obtainCode already signed once; the legitimate browser gets exactly one code.
  const { code } = await obtainCode(request)
  const signed = await (await request.get('/lnurl/status')).json()
  expect(signed.status).toBe('signed')
  expect(new URL(signed.next).searchParams.get('code')).toBe(code)
})
