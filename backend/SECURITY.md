# Clippixx — Security Notes

Stack reality: **Firebase Authentication** (browser SDK) + **Express** API that verifies
Firebase ID tokens server-side + **PostgreSQL via raw `pg`**. There is no custom
password store, no self-issued JWT, and no session cookie — auth is **Bearer ID tokens**
in the `Authorization` header. This document reflects that architecture.

---

## 1. Authentication & Authorization model

| Concern | Owner | Notes |
|---|---|---|
| Registration, login, password reset, email verification | **Firebase** | Handled by the client SDK; backend never sees passwords. |
| Session tokens | **Firebase** | Short-lived ID tokens (1h), auto-refreshed by the SDK. |
| Token verification | **Backend** | `middleware/auth.js` → `admin.auth().verifyIdToken()`. |
| Roles (RBAC) | **Backend** | `profiles.role` ∈ `user` / `admin` / `super_admin`; enforced by `middleware/role.js` (`requireRole`) with a 5-min in-memory role cache. |
| App-level MFA (TOTP) | **Backend** | `services/mfaService.js` + `routes/mfa.js`, independent of Firebase MFA. Opt-in, enforced on sensitive routes via `middleware/requireMfa.js`. |

---

## 2. Threat model (STRIDE, scoped to the API)

| Threat | Vector | Mitigation in place |
|---|---|---|
| **Spoofing** | Forged/replayed ID token | `verifyIdToken` validates signature, issuer, audience, expiry against Firebase JWKS. |
| **Tampering** | Mutating role/owner fields via API | Role changes restricted to `super_admin`; `PUT /profiles/me` rejects `role`/`account_type`/`id`/`email`. |
| **Repudiation** | "I didn't do that" | `audit_logs` records role changes, deletes, admin user-create, profile edits, and MFA enable/disable/regenerate. |
| **Information disclosure** | Leaking secrets/PII | MFA secret + backup-code hashes never returned; public profile endpoint omits email/phone/role. |
| **Denial of service** | Request floods | `express-rate-limit`: general 100/15m, admin 60/15m, public forms 5/15m. |
| **Elevation of privilege** | User calling admin routes | `requireRole` on every privileged route; strict single-role guards on the frontend too. |

---

## 3. OWASP Top 10 (2021) mapping

- **A01 Broken Access Control** — `requireRole` server-side on all privileged routes; ownership checks on orders/reviews/verification; frontend guards are defense-in-depth only.
- **A02 Cryptographic Failures** — Passwords never touch our servers (Firebase). MFA secrets stored server-side; backup codes stored as SHA-256 hashes, compared with `crypto.timingSafeEqual`.
- **A03 Injection** — All SQL uses **parameterized queries** (`$1, $2 …`). No string interpolation of user input into SQL. `express-validator` validates/sanitizes inputs.
- **A04 Insecure Design** — MFA is opt-in but enforced once enabled; backup codes are single-use; transitions on orders are state-machine-guarded.
- **A05 Security Misconfiguration** — `helmet` (HSTS, frameguard, nosniff, no-referrer), `x-powered-by` disabled, strict CORS allowlist, JSON body cap (1mb).
- **A06 Vulnerable Components** — Pin deps; run `npm audit` in CI (see checklist).
- **A07 Identification & Auth Failures** — Firebase handles credential stuffing/rate-limiting on auth; app-level TOTP MFA adds a second factor for sensitive actions.
- **A08 Software & Data Integrity** — Lockfile committed; no dynamic `eval`; CI builds from pinned deps.
- **A09 Logging & Monitoring** — `audit_logs` + request logger; extend to ship to a SIEM in prod.
- **A10 SSRF** — API does not fetch user-supplied URLs server-side (verification/identity proof URLs are stored, not fetched).

---

## 4. Why there is no CSRF token

CSRF applies to **ambient credentials** (cookies) that the browser attaches automatically.
This API authenticates with a **Bearer token in the `Authorization` header**, which a
cross-site attacker cannot set on a forged request, and which our **strict CORS allowlist**
further blocks for non-allowlisted origins. Adding a CSRF token here would be theater.
*If* a future feature introduces cookie-based sessions, add `csurf`/double-submit tokens then.

---

## 5. MFA (TOTP) — how it works

- `POST /api/mfa/setup` → generates a base32 secret + `otpauth://` QR (data URL). Stored disabled.
- `POST /api/mfa/enable` `{ token }` → verifies a TOTP code, flips `is_enabled`, returns **10 one-time backup codes** (shown once; only SHA-256 hashes persisted).
- `POST /api/mfa/verify` `{ token }` → accepts a TOTP code **or** a backup code (backup codes are consumed).
- `POST /api/mfa/backup-codes/regenerate` `{ token }` → requires a valid TOTP, issues a fresh set.
- `POST /api/mfa/disable` `{ token }` → requires a valid factor, wipes the row.
- Step-up: put `requireMfa` after `verifyToken` on any sensitive route; clients pass the second factor via the `x-mfa-token` header. No-op for users without MFA enabled (opt-in).

Clock drift tolerance: ±1 step (30s) via `authenticator.options.window = 1`.

---

## 6. Security hardening checklist

- [x] Parameterized SQL everywhere
- [x] `helmet` with HSTS / nosniff / frameguard / no-referrer
- [x] `x-powered-by` disabled
- [x] Strict CORS allowlist (rejects unknown origins; doesn't reflect Origin)
- [x] Rate limiting (general / admin / public-form tiers)
- [x] RBAC enforced server-side on every privileged route
- [x] Audit logging on privileged + MFA actions
- [x] App-level TOTP MFA with single-use backup codes (hashed)
- [x] JSON body size cap (1mb)
- [ ] Set `MFA_ISSUER`, `CORS_ORIGIN`, `DB_SSL=true` in production env
- [ ] `npm audit --production` clean in CI
- [ ] Firebase Admin service account stored as a secret (never committed)
- [ ] Rotate Firebase service-account keys periodically
- [ ] Ship `audit_logs` + request logs to centralized logging/alerting

---

## 7. Production deployment checklist

- [ ] `NODE_ENV=production`
- [ ] HTTPS only; HSTS preload (already configured in helmet)
- [ ] `CORS_ORIGIN` set to exact production origin(s)
- [ ] `DB_SSL=true`; least-privilege DB user (no superuser)
- [ ] Secrets via env / secret manager (DB creds, Firebase SA JSON) — not in image
- [ ] Run `npm run migrate` on deploy
- [ ] Reverse proxy terminates TLS and sets `trust proxy` if behind one (needed for correct rate-limit IPs)
- [ ] Health check wired to `/api/health`

---

## 8. Recommended nginx

```nginx
server {
    listen 443 ssl http2;
    server_name api.clippixx.com;

    ssl_certificate     /etc/letsencrypt/live/api.clippixx.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.clippixx.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    add_header Strict-Transport-Security "max-age=15552000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;

    client_max_body_size 2m;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name api.clippixx.com;
    return 301 https://$host$request_uri;
}
```

> If behind nginx, add `app.set('trust proxy', 1);` in `server.js` so rate limiting and
> logging see the real client IP from `X-Forwarded-For`.

---

## 9. Recommended Docker

```dockerfile
# backend/Dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Run as non-root
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER app
EXPOSE 5000
# Service-account JSON + DB creds injected via secrets/env at runtime, not baked in.
CMD ["node", "server.js"]
```

```dockerignore
node_modules
npm-debug.log
.env
config/firebase-service-account.json
__tests__
*.test.js
```
