# Installing on a VPS

Deploy **lnurl-oidc-bridge** as a single Docker container behind
[Traefik](https://traefik.io). The service is **stateless** — no volumes, no
database. Everything (including the signing key) comes from `.env`, so a redeploy
is just pulling a new image.

An example [compose.yml](../compose.yml) is included at the repo root. It uses:

- **No `./data` volume** — challenges and authorization codes live in memory and
  are short-lived; nothing needs to survive a restart.
- **Traefik labels** routing `Host(lnurl-oidc-bridge.example.domain)` → container port
  `3000`, with the `resolver` cert resolver for HTTPS.
- **One small volume `./data`** — the only persistent state. The RS256 signing
  key is generated into it on first boot (`OIDC_PRIVATE_KEY_FILE`) and reused on
  every restart, so issued tokens keep verifying. Challenges + codes stay in
  memory.
- **`env_file: .env`** for the remaining configuration.
- A **healthcheck** that polls `/jwks.json` via Node's built-in `fetch`.
- The external `traefik-network`.

## 1. Place the files

On the VPS, create a directory with the `compose.yml` and a `.env` beside it:

```bash
mkdir -p ~/lnurl-oidc-bridge && cd ~/lnurl-oidc-bridge
# copy compose.yml here, then create .env (next step)
```

The `./data` directory is created automatically when the container starts.

## 2. Create `.env`

Based on [.env.example](../.env.example). The signing key is **not** here — the
compose file sets `OIDC_PRIVATE_KEY_FILE=/app/data/signing.pem`, so the bridge
generates and persists it on first boot. You only need:

```bash
# Public HTTPS URL — MUST exactly match the Traefik Host rule in compose.yml.
# This is the OIDC issuer, baked into every ID token.
OIDC_ISSUER=https://lnurl-oidc-bridge.example.domain

# Registered client = your Logto connector (see docs/logto-setup.md).
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...

# Logto endpoint + connector id — the bridge registers both callback URLs
# (sign-in and account linking) from these.
LOGTO_ENDPOINT=https://<your-logto>
LOGTO_CONNECTOR_ID=<connector-id>
```

> Prefer to manage the key yourself (e.g. a secrets manager)? Drop the `./data`
> volume and the `OIDC_PRIVATE_KEY_FILE` line from `compose.yml`, and set an
> inline `OIDC_PRIVATE_KEY` PEM in `.env` instead. With neither set, the
> container **refuses to start** in production (`NODE_ENV=production`).
>
> Back up `./data` (or at least know that losing it rotates the key — only
> in-flight logins are affected, since Logto keeps its own session afterward).
> Running multiple replicas requires sharing this volume so they agree on the key.

## 3. Adjust `compose.yml`

Before bringing it up, double-check:

| Setting | Make sure it is… |
| --- | --- |
| `image:` | Your Docker Hub image. The example uses `thespielplatz/lnurl-oidc-bridge:latest` — confirm it matches your `DOCKER_USERNAME` / `IMAGE_TAG` from the deploy workflow. |
| `Host(...)` rule | Your real subdomain. If you change it, change `OIDC_ISSUER` to match. |
| `loadbalancer.server.port` | `3000` (the bridge's default `PORT`). |
| `volumes` / `OIDC_PRIVATE_KEY_FILE` | Keep both for the auto-generated persistent key, or remove both and use an inline `OIDC_PRIVATE_KEY` (see step 2). |
| `networks` | The external network your Traefik instance uses (`traefik-network` in the example). |

## 4. Bring it up

```bash
docker compose pull
docker compose up -d
docker compose logs -f          # watch startup
```

Verify the public endpoints:

```bash
curl https://lnurl-oidc-bridge.example.domain/.well-known/openid-configuration
curl https://lnurl-oidc-bridge.example.domain/jwks.json
```

## Updating

The `:latest` tag does not auto-update a running container. Pull and recreate:

```bash
docker compose pull && docker compose up -d
```

(Or let your deploy workflow's update script handle it — see the build/deploy
pipeline in `.github/workflows/docker-image.yml`.)

## Next

Once the container is live, wire it into Logto: see
**[logto-setup.md](logto-setup.md)**.
