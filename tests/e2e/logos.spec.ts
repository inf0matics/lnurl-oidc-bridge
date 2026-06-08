import { test, expect } from '@playwright/test'

for (const path of ['/logo.svg', '/logo-dark.svg']) {
  test(`${path} is served as a cacheable SVG`, async ({ request }) => {
    const res = await request.get(path)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('image/svg+xml')
    expect(res.headers()['cache-control']).toContain('max-age')
    const body = await res.text()
    expect(body).toContain('<svg')
    expect(body).toContain('viewBox="0 0 24 24"')
  })
}
