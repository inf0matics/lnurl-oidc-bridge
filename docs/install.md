# Installing on a VPS

Deploy **lnurl-oidc-bridge** as a single Docker container behind
[Traefik](https://traefik.io). The example [compose.yml](../compose.yml) uses:

- **One small `./data` volume** — the only persistent state. The RS256 signing
  key is generated into it on first boot (`OIDC_PRIVATE_KEY_FILE`) and reused on
  restart; challenges + codes stay in memory.
- **Traefik labels** routing `Host(...)` → port `3000` with the `resolver` cert resolver.
- **`env_file: .env`**, a `/jwks.json` healthcheck, and the external `traefik-network`.

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

# Logto endpoint — the bridge accepts both callback URLs (sign-in and account
# linking) under this origin.
LOGTO_ENDPOINT=https://<your-logto>
```

> Prefer to manage the key yourself? Drop the `./data` volume and
> `OIDC_PRIVATE_KEY_FILE` from `compose.yml` and set an inline `OIDC_PRIVATE_KEY`
> PEM instead. With neither, the container **refuses to start** in production.
> Back up `./data` — losing it rotates the key (only in-flight logins are
> affected); multiple replicas must share the volume.

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
