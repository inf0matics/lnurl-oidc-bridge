# Installing on a VPS

Deploy **lnurl-oidc-bridge** as a single Docker container behind
[Traefik](https://traefik.io). The service is **stateless** — no volumes, no
database. Everything (including the signing key) comes from `.env`, so a redeploy
is just pulling a new image.

An example [compose.yml](../compose.yml) is included at the repo root. It uses:

- **No `./data` volume** — challenges and authorization codes live in memory and
  are short-lived; nothing needs to survive a restart.
- **Traefik labels** routing `Host(lnurl-oidc-bridge.tsp.tools)` → container port
  `3000`, with the `resolver` cert resolver for HTTPS.
- **`env_file: .env`** for all configuration.
- A **healthcheck** that polls `/jwks.json` via Node's built-in `fetch`.
- The external `traefik-network`.

## 1. Place the files

On the VPS, create a directory with the `compose.yml` and a `.env` beside it:

```bash
mkdir -p ~/lnurl-oidc-bridge && cd ~/lnurl-oidc-bridge
# copy compose.yml here, then create .env (next step)
```

## 2. Create `.env`

Based on [.env.example](../.env.example). Production values:

```bash
# Public HTTPS URL — MUST exactly match the Traefik Host rule in compose.yml.
# This is the OIDC issuer, baked into every ID token.
OIDC_ISSUER=https://lnurl-oidc-bridge.tsp.tools

# Stable RS256 signing key (PEM/PKCS#8). Generate once:
#   openssl genpkey -algorithm RSA -out signing.pem -pkeyopt rsa_keygen_bits:2048
# Do NOT rely on the ephemeral dev fallback in production — tokens would stop
# verifying after every restart.
OIDC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"

# Registered client = your Logto connector (see docs/logto-setup.md).
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_REDIRECT_URIS=https://<your-logto>/callback/<connector-id>
```

`OIDC_REDIRECT_URIS` is exact-matched; separate multiple with spaces or commas.

## 3. Adjust `compose.yml`

Before bringing it up, double-check:

| Setting | Make sure it is… |
| --- | --- |
| `image:` | Your Docker Hub image. The example uses `thespielplatz/lnurl-oidc-bridge:latest` — confirm it matches your `DOCKER_USERNAME` / `IMAGE_TAG` from the deploy workflow. |
| `Host(...)` rule | Your real subdomain. If you change it, change `OIDC_ISSUER` to match. |
| `loadbalancer.server.port` | `3000` (the bridge's default `PORT`). |
| `networks` | The external network your Traefik instance uses (`traefik-network` in the example). |

## 4. Bring it up

```bash
docker compose pull
docker compose up -d
docker compose logs -f          # watch startup
```

Verify the public endpoints:

```bash
curl https://lnurl-oidc-bridge.tsp.tools/.well-known/openid-configuration
curl https://lnurl-oidc-bridge.tsp.tools/jwks.json
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
