import { test, expect } from '@playwright/test'
import { extractLnurl, signK1 } from '../e2e/helpers'

const BRIDGE = 'http://localhost:3010'

test('a user logs into the mock Logto RP with a Lightning wallet, end to end', async ({
  page,
  request,
}) => {
  // 1. Start at the RP; it redirects the browser to the bridge login page.
  await page.goto('/login')
  await expect(page).toHaveURL(/localhost:3010\/authorize/)
  await expect(page.getByRole('heading', { name: 'Sign in with Lightning' })).toBeVisible()

  // 2. Read the LNURL off the page and act as the wallet: sign k1 and hit the
  //    bridge's LNURL callback over a separate channel (as a real wallet would).
  const { k1 } = extractLnurl(await page.content())
  const { key, sig } = signK1(k1)
  const cb = await request.get(`${BRIDGE}/lnurl/callback?tag=login&k1=${k1}&sig=${sig}&key=${key}`)
  expect((await cb.json()).status).toBe('OK')

  // 3. The bridge login page polls, then redirects back to the RP, which has
  //    exchanged the code and verified the ID token — showing our pubkey as sub.
  await expect(page).toHaveURL(/localhost:3011\/callback/, { timeout: 15_000 })
  await expect(page.getByTestId('identity')).toHaveText(key.toLowerCase())
})
