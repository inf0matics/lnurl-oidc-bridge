// Shared UI for the user-facing HTML screens (landing, login, error): the
// tsp.tools "Spielplatz" design system, one combined footer, and a page shell.
import type { Config } from './config'

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

const BASE_STYLES = `
  :root {
    --font-display: "Delicious-Heavy", "Trebuchet MS", sans-serif;
    --font-body: "Trebuchet MS", ui-sans-serif, system-ui, sans-serif;
    --orange: #f7941e; --orange-deep: #fbad18;
    --ink: #000; --charcoal: #3a3a3a; --navy: #101828;
    --bg: #f0f0f0; --card: #fff; --teal: #00baa7; --purple: #ac4bff; --gray: #666;
    --radius: 18px; --border: 4px solid var(--ink); --pop: 8px 8px 0 var(--ink);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font-body);
    background:
      radial-gradient(circle at 18% 12%, rgba(247,148,30,.18), transparent 42%),
      radial-gradient(circle at 85% 88%, rgba(0,186,167,.14), transparent 45%),
      var(--bg);
    color: var(--navy); min-height: 100vh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; padding: 24px;
  }
  .card {
    width: 100%; max-width: 400px; background: var(--card);
    border: var(--border); border-radius: var(--radius); box-shadow: var(--pop);
    padding: 32px 28px 26px; text-align: center;
  }
  .logo { width: 86px; height: auto; display: block; margin: 0 auto 14px; }
  h1 { font-family: var(--font-display); font-size: 1.6rem; letter-spacing: .3px; color: var(--navy); }
  h1 .lit { color: var(--orange); }
  .subtitle { color: var(--gray); font-size: .95rem; margin-top: 6px; line-height: 1.5; }
  footer { text-align: center; font-size: .78rem; color: var(--gray); line-height: 1.7; }
  footer a { color: var(--purple); font-weight: 700; text-decoration: none; }
`

/** One footer for every screen: release version + GitHub link + the tagline. */
export function footer(config: Config): string {
  return `<footer>
      <span>v${escapeHtml(config.version)}</span> · <a href="${escapeHtml(config.repoUrl)}" rel="noreferrer">GitHub</a><br />
      no email, no password
    </footer>`
}

export interface PageOptions {
  lang?: string
  title: string
  /** Inner HTML of the centered card. */
  body: string
  /** Extra CSS appended after the base styles (page-specific). */
  extraStyles?: string
  /** HTML appended after the footer (e.g. a <script>). */
  tail?: string
}

/** Render a full HTML page: card body + shared footer, in the shared design. */
export function pageShell(config: Config, opts: PageOptions): string {
  return `<!doctype html>
<html lang="${opts.lang ?? 'en'}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${opts.title}</title>
    <link rel="icon" href="/logo.svg" />
    <style>${BASE_STYLES}${opts.extraStyles ?? ''}</style>
  </head>
  <body>
    <main class="card">
${opts.body}
    </main>
    ${footer(config)}
    ${opts.tail ?? ''}
  </body>
</html>
`
}
