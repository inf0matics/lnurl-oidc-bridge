// Connector logos served at /logo.svg and /logo-dark.svg so they have stable
// public URLs to paste into Logto's social-connector config (Connector logo URL
// + dark version). These mirror the source files in assets/ (an e2e asserts the
// served bytes match). A padlock with a lightning bolt — orange body, dark mark.

export const LOGO_LIGHT = `<svg width="220" height="240" viewBox="0 0 220 240" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- shackle (black outline behind + charcoal fill) -->
  <path d="M70 108 V72 a40 40 0 0 1 80 0 V108" stroke="#000" stroke-width="32" fill="none" stroke-linecap="round"/>
  <path d="M70 108 V72 a40 40 0 0 1 80 0 V108" stroke="#3a3a3a" stroke-width="18" fill="none" stroke-linecap="round"/>

  <!-- lock body -->
  <rect x="42" y="100" width="136" height="118" rx="22" fill="#f7941e" stroke="#000" stroke-width="8"/>

  <!-- lightning bolt cut into the body -->
  <path d="M122 122 L88 165 H108 L98 198 L138 150 H116 Z"
        fill="#fff" stroke="#000" stroke-width="7" stroke-linejoin="round"/>
</svg>
`

export const LOGO_DARK = `<svg width="220" height="240" viewBox="0 0 220 240" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- shackle: light outline + light-gray fill so it reads on dark bg -->
  <path d="M70 108 V72 a40 40 0 0 1 80 0 V108" stroke="#f4f4f4" stroke-width="32" fill="none" stroke-linecap="round"/>
  <path d="M70 108 V72 a40 40 0 0 1 80 0 V108" stroke="#9a9a9a" stroke-width="18" fill="none" stroke-linecap="round"/>

  <!-- lock body: orange with light outline -->
  <rect x="42" y="100" width="136" height="118" rx="22" fill="#f7941e" stroke="#f4f4f4" stroke-width="8"/>

  <!-- bolt: dark fill keeps contrast against the orange body -->
  <path d="M122 122 L88 165 H108 L98 198 L138 150 H116 Z"
        fill="#101828" stroke="#f4f4f4" stroke-width="6" stroke-linejoin="round"/>
</svg>
`
