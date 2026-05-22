# Fees / Billing Module — TODO

Your module owns all payments (Razorpay). You're the **most-complete module** in the system. Other modules (Admission, future Placement, etc.) should call you for any payment. See `docs/PROJECT_CONTEXT.md`.

## 🔴 Red — Project Hygiene (Common Standards — do first)

These items are **the same for every module**. See `docs/PROJECT_CONTEXT.md` for full specs.

### H1. Adopt the canonical folder structure
**Why:** Mostly clean, but repo name is generic (`erp_Project`) and root has a few stragglers.
**Change for this module:**
- **Rename the repo on GitHub** from `erp_Project` → `erp-fees-billing` (or `pvg-fees-module`). "erp_Project" tells no one what this is.
- **Move to `backend/tests/`:** `backend_test.py` (rename to `test_smoke.py`).
- **Move to `docs/`:** `design_guidelines.json`, `test_result.md`.
- **Delete:** `memory/` (claude-mem session artifacts, not project code).
- **Verify `backend/` internals follow canonical:** `backend/app/{main.py,core/,api/v1/,models/,schemas/,services/,dependencies/,db/}`.
- After cleanup, root contains ONLY: `README.md`, `run.sh`, `run.ps1`, `.env.example`, `.gitignore`, `docs/`, `backend/`, `frontend/`.

### H2. Add `run.sh` and `run.ps1`
**Why:** No standard setup script — yet this is the most production-ready module. Make it the reference implementation.
**Change:**
- `run.sh` + `run.ps1` at repo root — contract in `docs/PROJECT_CONTEXT.md`.
- Must: check Python 3.10+ / Node 18+ / Postgres 14+; install deps; venv; npm install; copy `.env.example`→`.env` (must include Razorpay keys placeholder); `alembic upgrade head`; start backend on **port 8005** + frontend on **port 5177**.
- Because you're the reference module, also ship a `--demo` flag that seeds sample bills/payments for QA.

### H3. Frontend AuthGate — verify every page render
**Why:** Admin dashboards (bills, refunds, audit logs) currently rely on `AdminUser` email/password seeded from env vars. Replace with centralized JWT auth via Auth module.
**Change:**
- `frontend/src/auth/AuthGate.jsx` (new) — wraps router. On mount: `GET /api/auth/me` on your own backend. 401 → redirect to `${VITE_AUTH_URL}/login?redirect=<current>`.
- `frontend/src/api/client.js` (new) — axios w/ auth interceptor.
- `backend/app/api/v1/auth.py` → `GET /api/auth/me` (replacing the `AdminUser`-based login flow).
- Per-route role gating: admin/accountant pages `<AuthGate allowedRoles={['admin','accountant','principal']}>`. Student payment screens `<AuthGate allowedRoles={['Student']}>` matching `user_id` against the bill's owner.

### H4. Handle every role explicitly (accountant is your primary role)
**Why:** Fees is the most cross-role module — Students pay, Guests pay (admission/brochure), accountant administers, admin/principal oversee, hod reads dept reports. Each must be gated cleanly.
**Change:**
- `backend/app/core/roles.py` (new) — mirror Auth's `/api/roles/catalog`.
- `backend/app/dependencies/auth.py` — `require_roles(*allowed)` Depends.
- **Self-only enforcement:** Student endpoints (`GET /bills/me`, `POST /payments/create-order`) must verify `bill.user_id == current_user.user_id`.
- **Guest payment flow:** Brochure (₹200) and admission fee — Guest token issued by Admission/Auth must be accepted on `POST /payments/*` for `bill_type in ['brochure','admission']` only.
- `frontend/src/pages/AccessDenied.jsx` (new) — see context.md.

**This module's role matrix:**

| Role | Access in Fees |
|---|---|
| Student | View own bills (`GET /bills/me`), pay (`POST /payments/create-order` for own bills), view own receipts/refunds, request refund |
| Guest | `POST /payments/create-order` for `bill_type in ['brochure','admission']` only — no other access |
| admin | Full CRUD on all resources |
| principal | Same as admin |
| vice_principal | Same as admin |
| accountant | **Primary role** — full CRUD on bills, payments, refunds, audit logs, dashboard, stats |
| hod | Read-only dept-level fee reports (`GET /dashboard?dept=<own-dept>`); 403 on individual bill/payment endpoints |
| TPO | 403 |
| Faculty *(pending)* | 403 (faculty don't manage fees) |

### H5. Naming consistency (rename to canonical)
**Why:** You're the most cross-module API surface — Admission, Placement (later), every payment flow calls you. Inconsistent field names break clients silently. See full naming rules in `docs/PROJECT_CONTEXT.md`.

**Renames to apply:**

| Current | Target | Notes |
|---|---|---|
| **Repo:** `erp_Project` | `pvg-fees` | Generic name → descriptive; snake → kebab |
| `Bill.status` values: `'UNPAID'`, `'PAID'` | `'unpaid'`, `'paid'` | Lowercase snake (system standard) |
| `Payment.status` values: `'PENDING'`, `'SUCCESS'`, `'FAILED'` | `'pending'`, `'success'`, `'failed'` | Same |
| `Refund.status` values: `'PENDING'`, `'completed'` (mixed!) | `'pending'`, `'completed'` | Pick lowercase for all |
| `Bill.bill_id` (PK) | (keep) | ✓ matches `<table_singular>_id` |
| `Payment.payment_id`, `Receipt.receipt_id`, `Refund.refund_id` | (keep) | ✓ |
| `Payment.razorpay_order_id`, `razorpay_payment_id` | (keep — third-party preserves) | ✓ |
| `Receipt.receipt_number` (separate from `receipt_id`?) | (keep as display-format) | Document distinction: `receipt_id` is PK, `receipt_number` is human-friendly serial |
| `Bill.user_id` | Either `student_id` (FK to SIS) OR `user_id` (FK to Auth user) — **pick one** | Currently ambiguous. Brochure payers (Guests) need `user_id`; enrolled students could use `student_id`. Recommend: `payer_user_id` always (Auth-level identity); separate `student_id` column nullable for student-bound bills. |
| `AuditLog.event_name` | (keep) | ✓ |
| `AdminUser` model | **delete** — Module-Specific #1 (use Auth) | |
| `Bill.bill_type` values | `brochure`, `admission`, `tuition`, `hostel`, `placement` (lowercase snake) | Document the full enum |

**API endpoint paths to align:**
- `/api/v1/bills/`, `/api/v1/payments/`, `/api/v1/receipts/`, `/api/v1/refunds/`, `/api/v1/audit-logs/`, `/api/v1/dashboard/` — all plural ✓.
- `/api/v1/payments/create-order` — kebab verb ✓.
- `/api/v1/payments/razorpay-webhook` — kebab ✓.

**Env vars to standardize:**
- `FEES_PORT=8005`
- `DATABASE_URL`
- `JWT_SECRET`
- `AUTH_URL`, `SIS_URL`, `ADMISSION_URL`, `NOTIFY_URL`
- `NOTIFY_API_KEY` = `FEES_KEY_2026`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `ADMISSION_INTEGRATION_SECRET` (HMAC for outbound webhook)

### H6. Code quality bar (lint, type-check, test)
**Why:** Money module — bugs are not "annoying", they're "students get charged twice / Razorpay disputes / DPDP audit findings". Strict tooling is non-negotiable.
**Change:**
- `.pre-commit-config.yaml` — `black`, `ruff`, `prettier`, `eslint`.
- `backend/pyproject.toml` — `ruff` + `mypy --strict` + `pytest --cov` ≥ **85%** (higher bar for money handling).
- `frontend/.eslintrc.cjs` + `tsconfig.json` strict.
- `.editorconfig`.
- `.github/workflows/ci.yml`.
- **Property-based tests** with `hypothesis` for amount/refund math — multi-currency edge cases, partial refunds, idempotency.
- **Razorpay webhook signature test** — already mentioned in Module-Specific #2; CI must fail if removed.

### H7. Observability (health, logging, request IDs)
**Why:** Payment flows span Razorpay → you → Admission → SIS → Notify. Without trace correlation, "where's my receipt" investigations take hours.
**Change:**
- `GET /healthz`, `GET /readyz` (Postgres + Razorpay-API reachable).
- **Structured JSON logging** — every log includes `request_id`, `razorpay_order_id` (where applicable), `bill_id`.
- **Request ID middleware** + propagation on outbound webhooks to Admission/SIS/Notify.
- **Sentry stub.**
- **Razorpay webhook trace** — every webhook receipt logs full event metadata (signature-verified) with request_id.
- **Scheduler heartbeat** — your background due-date scheduler writes `last_run_at` + `next_run_at` to a `system_heartbeats` table; `/healthz` checks `last_run_at` was within expected interval.

### H8. Payment data handling (audit + privacy)
**Why:** You handle payment data — even tokenized, the metadata (who paid what when) is sensitive under DPDP Act 2023. Indian fintech regulations are tightening.
**Change:**
- Audit every read/write to `payments`, `refunds`, `receipts`: `{user_id, request_id, action, target_id, timestamp}`.
- **Field masking in logs:** never log full webhook body, never log `RAZORPAY_KEY_SECRET`. Payment IDs are opaque refs and OK to log.
- `GET /api/v1/audit-logs/payments/{payment_id}` — admin endpoint for compliance/dispute investigation.
- `docs/payment-data-policy.md` — document retention (e.g., 7 years for tax compliance), archival schedule, who can access what, breach response timeline.
- **Webhook idempotency key** — already mentioned in Module-Specific #7; required for PCI-adjacent best practice.

---

## 🔴 Red — Module-Specific (do after hygiene)

### 1. Enforce JWT auth on all admin endpoints
**Why:** Today `AdminUser` has email/password auth via env-seeded credentials. Should integrate with the central Auth module instead.
**Change:**
- `app/dependencies/auth.py` (new) — JWT verification dep using shared `SECRET_KEY` from Auth.
- `app/api/v1/dashboard.py`, `app/api/v1/audit-logs.py`, `app/api/v1/refunds.py` — apply `Depends(get_current_user)` with role check `in ['admin', 'accountant', 'principal']`.
- Eventually deprecate `AdminUser` model — migrate admin accounts to Auth module's user table.

### 2. Verify Razorpay webhook signature (already done — keep it that way)
**Why:** Already implemented (SHA256 HMAC). Don't accidentally remove it during refactor.
**Change:** Add an integration test in `tests/test_webhook_signature.py` that asserts unsigned/bad-signature requests are rejected.

### 3. Audit outbound webhook authentication
**Why:** You fire to Admission, SIS, and Notify on payment success. If Admission's webhook URL is hijacked, you could trigger phantom enrollments.
**Change:**
- Sign outbound webhooks with HMAC (shared secret per-recipient module).
- Coordinate with Admission (this is the `ADMISSION_INTEGRATION_SECRET` you already have — good) and SIS owners.

## 🟠 Orange — Important

### 4. Make the bill-creation API the single entry point for other modules
**Why:** Admission, Placement (later), and any other module that needs to charge a student should call YOU. Today Admission has its own payment models duplicating this.
**Change:**
- Document `POST /api/v1/bills/create` schema clearly in `README.md`:
  ```json
  { "user_id": ..., "amount": ..., "bill_type": "brochure|admission|fees|placement-app",
    "due_date": "...", "callback_url": "...", "metadata": {...} }
  ```
- Coordinate with Admission to migrate them off their local `BroPayment`/`Payment` (see Admission todo #3).

### 5. Replace hardcoded module URLs with env config
**Why:** `ADMISSION_WEBHOOK_URL`, `SIS_MODULE_URL`, `NOTIFICATION_MODULE_URL` should be env vars, not constants.
**Change:** `app/core/config.py` — load all from `os.environ`. Add `.env.example` with placeholders.

### 6. Background scheduler for due-date checks — observability
**Why:** You run a background scheduler. Failures will go silent.
**Change:** Add structured logging + heartbeat metric. On fatal exceptions in the scheduler, fire to Notify with `FEES_KEY_2026`.

### 7. Add idempotency keys to `POST /create-order`
**Why:** Mobile network retries can cause double-charges. You already do this for webhooks — extend to order creation.
**Change:** `app/api/v1/payments.py` — accept `Idempotency-Key` header. Cache response by key for 24h.

## 🟡 Yellow — Polish

### 8. Theme usage — only 80 token uses across frontend
**Why:** You're on the right theme version (^1.1.0) but tokens aren't widely used. Probably lots of TailwindCSS classes hardcoding colors.
**Change:** Configure Tailwind to extend with theme tokens: `frontend/tailwind.config.js` — map `theme.extend.colors.primary` → `var(--erp-primary)`. Then `bg-primary` references the shared theme.

### 9. Align FastAPI version
**Why:** On 0.110.1 — others moving to 0.135.x.
**Change:** `backend/requirements.txt` — `fastapi==0.135.2`.

### 10. Receipt PDF generation — verify rendering quality
**Why:** Receipt is rendered as PDF for download. Common gotchas: font missing in container, INR symbol broken.
**Change:** Add a smoke test that generates a sample receipt and asserts PDF page count + text content.

### 11. Recharts is on v3.6.0 — unusual major
**Why:** Recharts is typically v2.x. v3.6.0 might be a release-candidate or pre-release.
**Change:** Verify v3.6.0 is GA and supported. If not, pin to a stable v2.x release.

### 12. Document the audit log retention policy
**Why:** `AuditLog` returns the 100 most recent — but is the table pruned? If not, it'll grow unbounded.
**Change:** Add a scheduled job (or document a manual prune query) to archive logs older than N months.
