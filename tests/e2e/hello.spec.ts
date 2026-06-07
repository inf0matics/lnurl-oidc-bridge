import { test, expect } from '@playwright/test'

test('home page shows hello world', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'hello world' })).toBeVisible()
})
