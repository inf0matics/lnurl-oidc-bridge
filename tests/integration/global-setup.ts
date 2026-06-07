import { execSync } from 'node:child_process'

export default function globalSetup() {
  // Build images and wait for both services to report healthy.
  execSync('docker compose -f compose.e2e.yml up -d --build --wait', { stdio: 'inherit' })
}
