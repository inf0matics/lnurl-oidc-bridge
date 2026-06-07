import { test, expect, type APIRequestContext } from '@playwright/test'
import { authorizeUrl, REDIRECT_URI } from './helpers'

/** GET /authorize without following the redirect, returning the error param (if any). */
async function authorizeError(
  request: APIRequestContext,
  params: Record<string, string>,
): Promise<{ status: number; error: string | null; state: string | null }> {
  const res = await request.get(authorizeUrl(params), { maxRedirects: 0 })
  const location = res.headers()['location']
  if (!location) return { status: res.status(), error: null, state: null }
  const url = new URL(location)
  return {
    status: res.status(),
    error: url.searchParams.get('error'),
    state: url.searchParams.get('state'),
  }
}

test('prompt=none returns login_required (we cannot authenticate silently)', async ({ request }) => {
  const { status, error, state } = await authorizeError(request, { prompt: 'none' })
  expect(status).toBe(302)
  expect(error).toBe('login_required')
  expect(state).toBe('xyz-state') // state preserved
})

test('request object (JAR) is not supported', async ({ request }) => {
  expect((await authorizeError(request, { request: 'eyJ...' })).error).toBe('request_not_supported')
})

test('request_uri is not supported', async ({ request }) => {
  expect((await authorizeError(request, { request_uri: 'https://x/y' })).error).toBe(
    'request_uri_not_supported',
  )
})

test('a code_challenge with method "plain" is rejected (only S256 is advertised)', async ({
  request,
}) => {
  const { error } = await authorizeError(request, {
    code_challenge: 'abc',
    code_challenge_method: 'plain',
  })
  expect(error).toBe('invalid_request')
})

test('a code_challenge with no method is rejected (implicit plain)', async ({ request }) => {
  expect((await authorizeError(request, { code_challenge: 'abc' })).error).toBe('invalid_request')
})

test('a code_challenge with S256 is accepted and renders the login page', async ({ request }) => {
  const res = await request.get(
    authorizeUrl({ code_challenge: 'abc', code_challenge_method: 'S256' }),
  )
  expect(res.status()).toBe(200)
  expect(await res.text()).toContain('Sign in with Lightning')
})

test('a duplicated client_id (array) is rejected, not smuggled through', async ({ request }) => {
  // Two client_id values parse to an array → treated as missing → 400, no redirect.
  const res = await request.get(`/authorize?response_type=code&client_id=test-client&client_id=evil&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=openid`, {
    maxRedirects: 0,
  })
  expect(res.status()).toBe(400)
})

test('client input is never reflected into the error page (no XSS)', async ({ request }) => {
  const xss = '<script>alert(1)</script>'
  const res = await request.get(
    `/authorize?response_type=code&client_id=${encodeURIComponent(xss)}&redirect_uri=${encodeURIComponent(xss)}&scope=openid`,
    { maxRedirects: 0 },
  )
  expect(res.status()).toBe(400)
  expect(await res.text()).not.toContain('<script>')
})

test('client input is never reflected into the login page (no XSS via state)', async ({
  request,
}) => {
  const res = await request.get(authorizeUrl({ state: '<script>alert(1)</script>' }))
  expect(res.status()).toBe(200)
  expect(await res.text()).not.toContain('<script>alert(1)</script>')
})
