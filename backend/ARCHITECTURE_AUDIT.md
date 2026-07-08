# Backend Architecture Audit — Clipixx

**Status:** Report only. **No files have been moved or changed by this audit.**
**Scope:** `backend/` (~8,244 LOC, excluding `node_modules`).
**Target style (per your decision):** *Pragmatic modular* — group by domain into `modules/`, split route → controller → service → validator, **keep DB access in services for now** (no separate repository layer until a module clearly needs it). `src/` wrapper deferred to avoid mass import churn.

---

## 1. Current State (measured)

| Layer | Files | Notes |
|---|---|---|
| routes/ | 18 | 4,856 LOC; **17 of 18 contain raw SQL** (227 `pool.query`/`client.query` calls) |
| services/ | 10 | 1,175 LOC incl. middleware below |
| middleware/ | 8 | auth, role, roleCache, validate, rateLimiter, errorHandler, turnstile, requireMfa |
| config/ | 3 | `db.js`, `firebase.js`, `firebase-service-account.json` |
| utils/ | 1 | only `pendingSignupCrypto.js` |
| __tests__/ | 8 | covers auth-otp, profiles, users, admin, 2 middleware, 2 services |
| top-level scripts | 5 | `migrate.js` (used), `create-test-admins.js`, `seed-profile.js`, `set-cors.js`, + `scripts/` dir (4 more) |

**Route mounts (19, order matters):** `/api/stars`, `/suggestions`, `/applications`, `/feedback`, `/profiles`, `/admin`, `/users`, `/orders`, `/reviews`, `/verification`, `/mfa`, `/auth`, `/creator/dashboard`, `/creator`, `/booking-reviews`, `/bookings`, `/fan/dashboard`, `/explore`.
⚠️ `/api/creator/dashboard` **must stay mounted before** `/api/creator` (prefix-shadowing).

### SQL-in-routes hotspots (refactor effort indicator)
| Route | Inline SQL calls |
|---|---|
| auth.js | 60 |
| creatorDashboard.js | 27 |
| profiles.js | 20 |
| creatorOnboarding.js | 14 |
| admin.js | 13 |
| reviews.js / orders.js | 12 each |
| stars.js | 11 |
| (10 more) | 1–9 each |

---

## 2. Findings

### 2a. Duplicate / inconsistent (spec rules 12, 6)
- **Two audit systems.** `services/auditService.js` (`writeAuditLog`, used by applications/mfa/profiles) **and** `services/securityAuditService.js` (`securityAudit`, used only by auth.js). → Consolidate into one `audit.service.js` under a `security` module.
- **`config/db.js`** is named differently from the target `config/database.js`. Imported by ~35 files — renaming is high-churn; recommend an alias/re-export rather than a hard rename.

### 2b. Missing abstractions the target assumes (net-new, spec rules 9, 8)
- **No `ApiError` / `ApiResponse` classes** exist. Error handling is ad-hoc (`res.status(x).json({error})`). These would be *added*, then adopted incrementally.
- **No repository layer** and **no `BaseRepository`**. (Deferred per your "pragmatic" choice.)
- **`utils/` is nearly empty** — the target's `crypto/jwt/pagination/logger/...` are aspirational; only create them when something uses them.

### 2c. Likely-standalone scripts (spec rule 13)
`create-test-admins.js`, `seed-profile.js`, `set-cors.js` (top level) and `scripts/*` are not `require`d anywhere → safe to relocate into `scripts/` (operational tooling, not runtime). **`migrate.js` is used** — keep at root or update its npm script path.

### 2d. Not found / not applicable
- No `jobs/` (no cron/queue code today) — the target `jobs/` is aspirational; don't scaffold empty.
- No circular dependencies detected in spot checks (services don't import routes; middleware is leaf-ish). A full madge pass is recommended before any move.

---

## 3. File Movement Table (PROPOSED — nothing moved yet)

> Domain grouping only; **internals unchanged** in phase 1. "Split later" = extract controller/service/validator in that module's own phase.

| Current | Proposed module | Notes |
|---|---|---|
| routes/auth.js | modules/auth/auth.routes.js (+ controller/service/validator) | Biggest + riskiest (60 SQL, transactions). Refactor LAST. |
| routes/users.js | modules/users/ | small, good early candidate |
| routes/profiles.js | modules/users/ or modules/profiles/ | 641 LOC |
| routes/creatorDashboard.js | modules/creator/ | |
| routes/creatorOnboarding.js | modules/creator/ | |
| services/creatorEnrichment.js | modules/creator/creatorEnrichment.service.js | |
| services/profileSummaryAI.js | modules/creator/ | AI bio |
| services/verificationScore.js | utils/verificationScore.js | pure fn |
| routes/fanDashboard.js | modules/fans/ | |
| routes/verification.js | modules/verification/ | |
| routes/mfa.js + services/mfaService.js | modules/security/ | |
| services/auditService.js + securityAuditService.js | modules/security/audit.service.js | **merge** |
| routes/bookings.js, bookingReviews.js | modules/bookings/ | |
| routes/orders.js | modules/orders/ | |
| routes/stars.js, explore.js | modules/stars/ | explore reads stars |
| routes/reviews.js | modules/bookings/ or modules/stars/ | legacy order-based reviews |
| routes/feedback.js, suggestions.js | modules/feedback/ | |
| routes/applications.js | modules/applications/ | |
| routes/admin.js | (cross-cutting) modules/admin/ | touches many tables |
| middleware/* | middleware/ (unchanged location) | rename validate.js→validation.js optional |
| config/db.js | config/database.js (re-export alias) | avoid 35-file churn |
| utils/pendingSignupCrypto.js | utils/ (unchanged) | |
| create-test-admins/seed-profile/set-cors.js | scripts/ | |

---

## 4. Dependency Graph (high level)

```
server.js
  └─ routes/* ──┬─ services/* (email, sms, notify, r2, mfa, audit×2, enrichment, AI, score)
                ├─ middleware/* (auth→role→roleCache, validate, rateLimiter, turnstile, requireMfa)
                ├─ config/db (pool)         ← imported by ~35 files
                └─ config/firebase (admin)
utils/pendingSignupCrypto ← routes/auth, scripts
```
- Direction is clean (routes→services→config); **no service→route imports** observed → low circular-dep risk.
- The single highest-fan-in node is `config/db` (pool). Renaming it is the most disruptive single change → use a re-export shim.

---

## 5. Risk Assessment

| Item | Severity | Mitigation |
|---|---|---|
| 14/18 route groups untested | High | Add smoke/endpoint checks per module **before** refactoring it |
| auth.js transactions (OTP/signup) | High | Refactor auth LAST, behind its existing test; keep transaction boundaries intact |
| 227 inline SQL calls to relocate | High | Move per-module, verify each; never bulk move-and-rewrite |
| Mount order (`/creator/dashboard` vs `/creator`) | Medium | Preserve order in module route aggregation |
| `config/db` rename | Medium | Re-export alias, not hard rename |
| Import-path churn | High | One module at a time; run boot + grep for broken requires after each |

---

## 6. What Will / Won't Change

**Will NOT change (guaranteed):**
- Every API path + HTTP method/response shape.
- Mount order and middleware chain.
- DB schema, migrations, env vars.
- Endpoint behavior (transactions, validation rules, rate limits).

**Will change (phased, only when you approve each module):**
- File locations (grouped by domain under `modules/`).
- Internal layering (route thins out; logic → service; validation → validator).
- Two audit services merged into one.
- `ApiError`/`ApiResponse` added and adopted incrementally.

---

## 7. Recommended Execution Order (safest → riskiest)

1. **Add scaffolding only** (ApiError, ApiResponse, errorHandler adoption) — additive, no moves.
2. **bookings** (small, 4 SQL) — prove the route→controller→service pattern + verify.
3. **users**, **feedback/suggestions**, **applications** (small).
4. **stars + explore**, **fans**, **orders**, **reviews**.
5. **verification**, **security (mfa + merged audit + otp)**.
6. **creator (dashboard + onboarding + enrichment)**.
7. **profiles**, then **auth** LAST (behind its tests, transactions preserved).

Each step: refactor → `node -e require()` load check → boot server → smoke/endpoint probe → commit. Stop on any failure.

---

## 8. Open Decisions For You

- **`src/` wrapper:** target nests everything under `src/`. Deferred (mass `require` path churn for little benefit). Adopt later if desired.
- **Repository layer:** deferred per your pragmatic choice. Revisit for data-heavy modules (creatorDashboard, profiles).
- **`config/db.js` → `database.js`:** recommend alias, not rename. Confirm.
- **Which module to refactor first** once you approve moving from report → execution.
