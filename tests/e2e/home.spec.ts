import { test, expect } from '@playwright/test'

test('landing page shows header, description, and footer with version + repo link', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'lnurl-oidc-bridge' })).toBeVisible()
  await expect(page.getByText(/standard OpenID Connect identity/i)).toBeVisible()

  // Footer: version string and a GitHub link.
  await expect(page.locator('footer span')).toHaveText(/^v\d+\.\d+\.\d+/)
  const repo = page.getByRole('link', { name: 'GitHub' })
  await expect(repo).toBeVisible()
  await expect(repo).toHaveAttribute('href', /github\.com/)
})
