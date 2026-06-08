// Connector logos served at /logo.svg and /logo-dark.svg so they have stable
// public URLs to paste into Logto's social-connector config (Connector logo URL
// + dark version). These mirror the source files in assets/.
// Authored at 24x24 to match Logto's connector design system.

export const LOGO_LIGHT = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" role="img" aria-label="lnurl-oidc-bridge">
  <title>lnurl-oidc-bridge</title>
  <defs>
    <linearGradient id="lob" x1="6" y1="2.5" x2="18" y2="21.5" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7B61FF"/>
      <stop offset="1" stop-color="#27B0FF"/>
    </linearGradient>
  </defs>
  <path d="M14 2.5L6 13.2H11.2L9.8 21.5L18 10.3H12.9Z" fill="url(#lob)" stroke="url(#lob)" stroke-width="1.1" stroke-linejoin="round"/>
</svg>
`

export const LOGO_DARK = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" role="img" aria-label="lnurl-oidc-bridge">
  <title>lnurl-oidc-bridge</title>
  <path d="M14 2.5L6 13.2H11.2L9.8 21.5L18 10.3H12.9Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.1" stroke-linejoin="round"/>
</svg>
`
