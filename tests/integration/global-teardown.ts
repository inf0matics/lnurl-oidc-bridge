import { execSync } from 'node:child_process'

export default function globalTeardown() {
  execSync('docker compose -f compose.e2e.yml down -v', { stdio: 'inherit' })
}
