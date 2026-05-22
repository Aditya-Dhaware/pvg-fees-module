# PVG ERP — Project Context

> One-page reference for anyone (human or AI) picking up work on the PVG ERP system. Last surveyed: 2026-05-22.

## What we're building

PVG ERP is a college Enterprise Resource Planning system split across **9 separate student-owned GitHub repositories**. Each student owns one functional module as their academic project. The `RD1991` GitHub account is added as collaborator across all of them to coordinate.

All 9 repos are cloned locally under `./modules/<repo-name>/`.

## The 9 modules

| Module | Owner | Repo | Responsibility |
|---|---|---|---|
| **Auth** | PhapaleSai | `Authetication_module_ERP_latest` | Identity, JWT issuance, RBAC, login audit |
| **SIS** | Yogendra-Wadkar | `Student-Information-System-SIS-PVG-Review` | Student master record (source of truth) |
| **Academic Planning BE** | pratikshakasbe | `pvg-academic-planning-backend` | Departments, programs, courses, timetable |
| **Academic Planning FE** | pratikshakasbe | `pvg-academic-planning-frontend` | Admin UI for academic structure |
| **Admission** | shravanius | `Admission-and-Enrollment-Module` | Brochure → app → docs → review → enrollment |
| **Fees / Billing** | Aditya-Dhaware | `erp_Project` | Razorpay payments, bills, receipts, refunds |
| **Attendance** | ghulerohit | `erp-attendance-module` | Sessions, attendance, OCR ingestion |
| **Placement** | YashBorade834 | `ERP-Placement-System` | Drives, eligibility, applications, offers |
| **Notify** | ANUSHKA348 | `erp_notify_final` | Email / SMS / WhatsApp comms hub |

## Target architecture (the rules)

These are the principles every module **must** follow. Today, several modules violate one or more — see each repo's `todo.md`.

1. **Same stack pattern**: FastAPI + PostgreSQL + SQLAlchemy + Alembic on the backend, Vite + React 19 + `college-erp-theme ^1.1.0` on the frontend. (SIS Next.js + Placement no-theme + Attendance React 18 are drift.)
2. **All auth goes through the Auth module** — no module rolls its own login or user table. Modules verify JWT via the shared `SECRET_KEY` and never trust URL/query params for identity.
3. **SIS is the only place that defines students** — every other module stores only `student_id` (foreign key) and queries SIS for name/email/CGPA/etc. No duplicated student tables.
4. **Auth defines users + roles** — modules store only `user_id`. No duplicated User/Role tables.
5. **All payments go through the Fees module** — no direct Razorpay calls from Admission, Placement, etc.
6. **All outbound notifications go through Notify module** — modules call `POST /api/module-notification` with their assigned API key.
7. **Shared theme** — every frontend imports `college-erp-theme` and uses `--erp-*` CSS variables. No bespoke color palettes.
8. **Configuration via env vars only** — no hardcoded URLs, passwords, or secrets in source. Especially no hardcoded ngrok URLs in production paths.

## Integration contracts (the wires)

### Auth contract
- Login flow: `POST /api/auth/login` → returns JWT (HS256 + refresh token)
- JWT claims: `sub` (email), `email`, `role`, `user_id`, `username`, `full_name`, `exp`
- Token validation: shared `SECRET_KEY` + `UserToken` table lookup for revocation
- Handoff: Auth redirects to `<module>/callback?user_id=<id>&role=<role>` after login
- **Modules MUST**: verify JWT on every protected endpoint via shared secret + check `UserToken.is_active` if calling Auth API

### Notify contract
- Endpoint: `POST /api/module-notification` (on notify module URL)
- Auth: per-module API key (`AUTH_KEY_2026`, `ACAD_KEY_2026`, `ADMISS_KEY_2026`, `SIS_KEY_2026`, `FEES_KEY_2026`, `ATT_KEY_2026`, `EXAM_KEY_2026`, `PLACE_KEY_2026`, `ALUMNI_KEY_2026`, `FEED_KEY_2026`)
- Channels: `delivery_modes: [email, sms, whatsapp]` — caller picks
- Targets: `recipient_roles`, `recipient_emails`, `department`

### SIS contract (source of truth)
- Read endpoints other modules consume:
  - `GET /api/v1/students/{student_id}` — full profile
  - `GET /api/v1/academic/student/{student_id}/mapping` — enrollment (dept/program/class/batch)
  - `GET /api/v1/students?filter=...` — filtered list (used by attendance for class rosters)
- Write back to SIS: `PATCH /api/v1/students/{student_id}/fees` (from Fees on payment success)

### Fees contract
- Bill creation: `POST /api/v1/bills/create` (from Admission with admission fee details)
- Payment success webhook fires to: Admission (`ADMISSION_WEBHOOK_URL`), SIS (`/api/v1/students/{id}/fees`), Notify

## Current integration map

```
                    ┌────────┐
                    │  AUTH  │  JWT issuer (shared SECRET_KEY)
                    └────┬───┘
                         │  /callback?user_id=&role=
        ┌────────────────┼─────────────────┐
        ▼                ▼                 ▼
   ┌────────┐      ┌─────────┐       ┌──────────┐
   │ADMISSN │─────▶│   SIS   │◀──────│ ATTEND.  │
   └───┬────┘ enr. │ (master)│ sync  └──────────┘
       │           └────┬────┘
       │ webhook        │ PATCH /fees
       ▼                ▼
   ┌────────┐     ┌─────────┐
   │ FEES   │────▶│ FEES    │  Razorpay
   └───┬────┘     └─────────┘
       │
       └──webhook──▶ ┌──────────────────────┐
                    │  NOTIFY (email/SMS)  │
                    └──────────────────────┘

PLACEMENT — uses dummy student, no auth, no theme (most disconnected)
ACADEMIC PLANNING — no auth middleware, hardcoded DB password (security gap)
```

## Known gaps (May 2026)

| # | Gap | Severity | Module(s) |
|---|---|---|---|
| 1 | DB password `pra12345` hardcoded in `database.py` | 🔴 Critical | Academic Planning BE |
| 2 | No auth middleware, CORS open to `*` | 🔴 Critical | Academic Planning BE |
| 3 | Dummy student (`id=1`, CGPA 8.0, CSE) instead of SIS | 🔴 Critical | Placement |
| 4 | Auth via URL param `?role=admin` (trivially spoofable) | 🔴 Critical | Academic Planning FE |
| 5 | Own `User` table duplicating Auth | 🔴 Critical | Attendance |
| 6 | Own `Student` table duplicating SIS | 🔴 Critical | Attendance |
| 7 | No theme dep, 0 token usage | 🟠 Important | Placement |
| 8 | Theme version stuck at `^1.0.0` | 🟡 Polish | SIS |
| 9 | ngrok URLs hardcoded in many modules | 🟠 Important | Most |
| 10 | Notify API keys reference EXAM/ALUMNI/FEED that don't exist | 🟡 Polish | Notify |
| 11 | Stack drift: SIS Next.js vs everyone Vite+React | 🟠 Important | SIS |
| 12 | Stack drift: React 18 vs 19, Vite 5 vs 8, FastAPI 0.110→0.136 | 🟡 Polish | Multiple |

## Local accounts & ports

- GitHub: `RD1991` (collaborator across all 9 module repos) — see `~/.claude/.../memory/reference_github_accounts.md`
- All backends are FastAPI; expect each to bind to its own port (defaults vary, mostly 8000 + 5173 frontend)
- Auth shared `SECRET_KEY` must be identical across all modules' `.env`

## Where to look first when picking up a task

- "fees / billing / razorpay" → `modules/erp_Project/`
- "timetable / courses / departments" → `modules/pvg-academic-planning-backend/` (+ `-frontend/`)
- "student profile / certificates / MOOC" → `modules/Student-Information-System-SIS-PVG-Review/`
- "admission / brochure / docs upload" → `modules/Admission-and-Enrollment-Module/`
- "attendance / OCR" → `modules/erp-attendance-module/`
- "placement / drives / TPO / offers" → `modules/ERP-Placement-System/`
- "login / JWT / roles / RBAC" → `modules/Authetication_module_ERP_latest/`
- "email / SMS / WhatsApp / Twilio" → `modules/erp_notify_final/`

## Canonical folder structure (every repo must follow this)

```
<module-repo>/
├── README.md              # Quick start + links to docs/
├── run.sh                 # Bash setup+run (Mac/Linux/WSL/Git-Bash)
├── run.ps1                # PowerShell setup+run (native Windows)
├── .env.example
├── .gitignore             # Must exclude: .env, node_modules/, .venv/, __pycache__/, dist/, build/, *.zip, *.mp4, ngrok*
├── docs/                  # All docs, screenshots, ER diagrams, postman collections
│   ├── api.md
│   ├── architecture.md
│   ├── integration.md
│   └── assets/
├── backend/               # FastAPI service
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── core/          # config.py, security.py
│   │   ├── api/v1/        # routers per resource
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic
│   │   ├── services/      # business logic + external API clients (sis_client, auth_client, notify_client, fees_client)
│   │   ├── dependencies/  # auth.py (JWT verify Depends), db.py (session Depends)
│   │   └── db/
│   ├── alembic/
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── tests/
│   └── .env.example
├── frontend/              # Vite + React (rename ANY sis-frontend/, placement-frontend/, etc. to this)
│   ├── src/
│   │   ├── api/           # client.js (single axios w/ auth interceptor)
│   │   ├── auth/          # AuthGate.jsx, useAuth.js, callback.jsx
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── App.jsx
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js  # extends college-erp-theme tokens
│   └── .env.example
└── scripts/               # optional — DB seeders, migration helpers, etc.
```

**Hard rules:**
- **No code files at repo root.** No `main.py`, `models.py`, `database.py` etc. at the root. They live under `backend/app/`.
- **No binaries committed to git.** No `.zip`, `.mp4`, `.pdf`, ngrok executables, screenshots committed to the repo. Use Git LFS only if absolutely needed; otherwise host externally and link.
- **No `.bat` files.** Replaced by `run.ps1`.
- **All documentation lives under `docs/`,** not at root (except `README.md`).
- **Frontend dir is named `frontend/`** — never `sis-frontend/`, `placement-frontend/`, etc.
- **No double-nested same-name folders** (e.g. `erp_notify_final/erp_notify_final/` — collapse).

## `run.sh` / `run.ps1` contract (every module ships both)

Every module ships both scripts; user picks the appropriate one for their OS. They must do the same things.

**`run.sh`** (bash — Mac, Linux, WSL, Git-Bash on Windows):

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Detect OS + check prerequisites; auto-install with prompt if missing
#    - Python 3.10+ (brew install python | apt install python3 | choco)
#    - Node 18+   (nvm | brew | apt | choco)
#    - Postgres 14+ accessible at $DATABASE_URL
#
# 2. Backend setup
#    cd backend/
#    python -m venv .venv && source .venv/bin/activate
#    pip install -r requirements.txt
#    [ -f .env ] || cp .env.example .env   # prompt user to fill required values
#    alembic upgrade head
#
# 3. Frontend setup
#    cd frontend/
#    npm install
#    [ -f .env ] || cp .env.example .env
#
# 4. Run both processes
#    uvicorn app.main:app --reload --port <module-backend-port> &
#    npm --prefix ../frontend run dev -- --port <module-frontend-port> &
#    trap "kill 0" EXIT
#    wait
```

**`run.ps1`** is the PowerShell equivalent for native Windows.

**Required flags:** `--setup-only`, `--backend-only`, `--frontend-only`, `--reset-db`.

**Assigned ports (every module must use these — print them at startup):**

| Module | Backend port | Frontend port |
|---|---|---|
| Auth | 8001 | 5173 |
| SIS | 8002 | 5174 |
| Academic Planning BE | 8003 | (paired with FE below) |
| Academic Planning FE | — | 5175 |
| Admission | 8004 | 5176 |
| Fees | 8005 | 5177 |
| Attendance | 8006 | 5178 |
| Placement | 8007 | 5179 |
| Notify | 8008 | 5180 |

## Frontend AuthGate pattern (every module's frontend must implement this)

**Rule:** No user sees ANY protected page until that page's render is preceded by a successful auth check against THAT module's backend. Modules are micro-services; tokens may be revoked, expired, or audience-mismatched — never trust localStorage on its own.

```
┌──────────────────────────────────────────────────────────────┐
│  User opens https://<module-frontend>/anything               │
│                  │                                           │
│                  ▼                                           │
│   <AuthGate>  (wraps every protected route in App.jsx)       │
│                  │                                           │
│                  ▼                                           │
│   GET /api/auth/me   (calls THIS module's backend, NOT       │
│                       Auth module directly)                  │
│                  │                                           │
│      ┌───────────┴────────────┐                              │
│      ▼                        ▼                              │
│   200 OK                    401                              │
│   render page               window.location =                │
│   with user+role            ${VITE_AUTH_URL}/login           │
│   in context                  ?redirect=<current-url>        │
└──────────────────────────────────────────────────────────────┘

Each module's backend /api/auth/me handler:
  1. Read Authorization: Bearer <jwt>
  2. Decode with shared SECRET_KEY (HS256)
  3. Verify exp; optionally call <AUTH_URL>/api/auth/verify for revocation
  4. Return { user_id, email, role, permissions } or 401
```

**Required implementation in every frontend:**

1. **`frontend/src/auth/AuthGate.jsx`** — wraps the router. On mount + on every route change, calls `GET /api/auth/me` against this module's own backend. 401 → `window.location.href = ${VITE_AUTH_URL}/login?redirect=${encodeURIComponent(window.location.href)}`. 200 → store user+role in React context, render children.

2. **`frontend/src/api/client.js`** — single axios instance. Auto-injects `Authorization: Bearer ${localStorage.getItem('token')}`. Interceptor on 401 → triggers AuthGate redirect.

3. **`backend/app/api/v1/auth.py` → `GET /api/auth/me`** on every module's backend.

4. **`backend/app/dependencies/auth.py` → `get_current_user()`** Depends — applied on every protected router. The DB-level revocation check (optional) is a call to Auth module's `/api/auth/verify`.

5. **Forbidden anywhere:** `?role=...` URL params, `localStorage.setItem('role', ...)`, sessionStorage role storage, trusting any user-supplied identity field except a verified JWT.

6. **Role-based route gating:** `<AuthGate allowedRoles={['admin','TPO']}>` wraps role-restricted pages. Mismatch → 403 page (not redirect).

## Role taxonomy (every module must handle every role)

Auth defines the canonical role list. **Every module must handle every role explicitly**, even roles that have no access to that module — explicit denial is part of the security model. A logged-in user with any of these roles may arrive at any module's URL; modules must respond with a clear 403 (not silent 401 or crash) when the role isn't authorized for the requested resource.

### Canonical roles (issued by Auth)

| Role | Description | Notes |
|---|---|---|
| `Student` | Enrolled student | Default access: own data only (own profile, own attendance, own fees, own placement apps) |
| `Guest` | Pre-enrollment user (admission applicant) or unauthenticated visitor | Primary role for Admission module before enrollment; 403 in most other modules |
| `admin` | System administrator | Cross-module full access |
| `principal` | Principal / institute head | Cross-module full access (peer to admin) |
| `vice_principal` | Deputy principal | Broad admin access |
| `hod` | Head of Department | Full access scoped to own department |
| `accountant` | Finance officer | Primary role for Fees module; read-only on student fee fields elsewhere |
| `TPO` | Training & Placement Officer | Primary role for Placement module |

**Pending addition:** Several modules (Attendance, Academic Planning) expect a `Faculty` role that isn't yet in Auth's role table. **Auth module must add `Faculty` as a 9th canonical role** (see Auth todo). Until that happens, modules should accept `Faculty` in their `roles.py` enum but document that it's not yet issuable from Auth.

### How modules consume the role list

Auth ships `GET /api/roles/catalog` returning the canonical list. Every module:
1. Mirrors the list in `backend/app/core/roles.py` (StrEnum) — for type safety + IDE autocomplete.
2. On startup (or first request), pulls `/api/roles/catalog` and warns on drift between local enum and Auth's authoritative list.

### Per-resource role contract (every endpoint must declare)

```python
from app.dependencies.auth import require_roles
from app.core.roles import Role

@router.get("/students/{id}", dependencies=[Depends(require_roles(
    Role.STUDENT,           # self-only — enforced inside handler
    Role.ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL,
    Role.HOD,               # dept-scoped — enforced inside handler
    Role.ACCOUNTANT,        # read-only on fee fields — handler filters response
    Role.TPO,               # read-only on academic record — handler filters response
))])
```

**Two layers:**
- **Coarse gate** at the route via `require_roles(...)` — fast 403 for roles that have no access at all.
- **Fine-grained checks inside the handler** for self-only (Student), dept-scoped (HOD), or read-only-with-field-filtering (accountant, TPO).

### 403 vs 401 — they mean different things

| Status | Meaning | Frontend response |
|---|---|---|
| **401** | Invalid/expired/missing JWT | Redirect to `${VITE_AUTH_URL}/login?redirect=<current>` |
| **403** | Valid JWT, role not allowed | Render `<AccessDenied />` — DON'T redirect to login (re-logging-in won't help) |

**403 response body shape:**
```json
{
  "detail": "role_not_allowed",
  "your_role": "Student",
  "allowed_roles": ["admin", "principal", "vice_principal", "hod"],
  "resource": "POST /api/v1/programs"
}
```

### Frontend AccessDenied UX (every module ships this page)

`frontend/src/pages/AccessDenied.jsx` displays:
- Header: "Access denied"
- "Your role **'{your_role}'** is not allowed to access this page."
- "Allowed roles: **{allowed_roles}**."
- Buttons: **[Log out and switch account]** | **[Back]** | **[Go to my home]** (route by role: Student→/profile, accountant→/fees, TPO→/placement, etc.)
- Friendly hint per role: e.g. for Student hitting an admin page: "Looking for your dashboard? It's at /home."

### Audit denials

Every module logs 403 denials (user_id, role, attempted_resource, timestamp) to its audit table. Repeated denials from the same user_id should trigger a notification to admin (use Notify module's `${module}_KEY_2026`).

### Role-to-module access summary (target)

| Role / Module | Auth | SIS | Acad | Admiss | Fees | Attend | Placement | Notify |
|---|---|---|---|---|---|---|---|---|
| **Student** | self auth | self read | timetable read | 403 | self bills/pay | self attendance | drives + own apps | self inbox |
| **Guest** | login only | 403 | 403 | **full apply flow** | brochure/admiss pay | 403 | 403 | 403 |
| **admin** | full | full | full | full review | full | full | full read+admin | full |
| **principal** | full | full | full | full review | full | full | full read+admin | full |
| **vice_principal** | full | full | full | full review | full | full | full read+admin | full |
| **hod** | own-dept users | dept students | dept entities | dept review | dept reports | dept attend | dept stats | dept notify |
| **accountant** | self auth | fee fields RO | fees structure RO | payment status RO | **primary — full** | 403 | 403 | fee notify |
| **TPO** | self auth | academic RO | timetable RO | 403 | 403 | placement-applicants RO | **primary — full** | placement notify |
| **Faculty** *(pending)* | self auth | own-class students | own timetable | 403 | 403 | mark own classes | RO | 403 |

## Naming conventions (canonical — every module follows these)

Different modules currently invent their own terminology for shared concepts. This causes silent integration bugs: Module A sends `student_id`, Module B reads `studentId`, fails silently and a student record disappears from a report. **Same concept = same name everywhere.**

### Repository names

Format: `pvg-<module>` or `pvg-<module>-<role>` where role ∈ {`backend`, `frontend`}. All lowercase kebab-case. No suffixes (`_latest`, `_final`, `-Review`, `-Module`, `-System`).

| Current | Target | Why |
|---|---|---|
| `Authetication_module_ERP_latest` | `pvg-auth` | Typo + suffix + mixed case |
| `Student-Information-System-SIS-PVG-Review` | `pvg-sis` | Mixed case + redundant suffix |
| `pvg-academic-planning-backend` | (keep) | ✓ already canonical |
| `pvg-academic-planning-frontend` | (keep) | ✓ already canonical |
| `Admission-and-Enrollment-Module` | `pvg-admission` | Mixed case + `-Module` suffix |
| `erp_Project` | `pvg-fees` | Generic name, snake_case |
| `erp-attendance-module` | `pvg-attendance` | Redundant `-module` suffix |
| `ERP-Placement-System` | `pvg-placement` | Uppercase + `-System` suffix |
| `erp_notify_final` | `pvg-notify` | `_final` is a smell |

Renames on GitHub auto-create redirects, so existing clones still work for a while. Update CI / Docker images / .env URLs after rename.

### Folder names inside repo

- All lowercase. **No spaces** (breaks shell scripts — Admission has `Requirement Documents/` — fix to `docs/requirements/`).
- Visible folders: kebab-case (`docs/`, `frontend/`).
- Python packages: `snake_case` (`backend/app/`).
- Frontend dir: **always `frontend/`** — never `sis-frontend/`, `placement-frontend/`.
- Backend dir: **always `backend/`**.

### Code file names

| Type | Convention | Example |
|---|---|---|
| Python module | `snake_case.py` | `student_service.py` |
| Python class inside | `PascalCase` | `class StudentService:` |
| React component | `PascalCase.jsx`/`.tsx` | `AuthGate.jsx` |
| JS utility | `camelCase.js` | `formatDate.js` |
| Config file | lowercase | `vite.config.js`, `tailwind.config.js` |
| Test file | `test_<unit>.py` (Python) or `<Component>.test.tsx` (Jest) | `test_auth_service.py` |

### Code identifiers

| Identifier | Convention | Example |
|---|---|---|
| Python function / variable | `snake_case` | `get_current_user`, `student_id` |
| Python class | `PascalCase` | `StudentInformation` |
| Python constant | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |
| JS/TS function / variable | `camelCase` | `getCurrentUser`, `studentId` |
| JS/TS React component | `PascalCase` | `AuthGate` |
| JS/TS type / interface | `PascalCase` | `StudentProfile` |
| JS/TS constant | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |

### API URL conventions

- All under `/api/v1/`.
- Resource paths: lowercase **kebab-case plural** nouns. `/api/v1/students`, `/api/v1/placement-drives`, `/api/v1/notification-logs`.
- Resource IDs in path: `/api/v1/students/{student_id}/certificates`.
- Sub-actions on a resource: POST with kebab verb. `/api/v1/applications/{application_id}/approve`.
- Query params: `snake_case`. `?department_id=42&status=approved`.
- **JSON body keys: `snake_case`** at the wire (matches DB). Frontends convert to `camelCase` internally if they prefer.

### Database conventions

- Tables: `snake_case` plural — `students`, `placement_drives`, `notification_logs`.
- Columns: `snake_case`.
- Primary key: `<table_singular>_id` (so `student_id`, `bill_id`, `placement_drive_id`). **Not bare `id`** — disambiguates in joins.
- Foreign keys: `<referenced_table_singular>_id` — `student_id`, `department_id`, `class_id`.
- Timestamps: `created_at`, `updated_at`, `deleted_at` (with `_at` suffix). For date-only fields, `<event>_date` — `birth_date`, `drive_date`.
- Boolean: `is_<adjective>` — `is_active`, `is_approved`. **Never bare adjective** (`approved` is ambiguous: status enum or boolean?).

### Enum / status value conventions

**All enum string values are lowercase `snake_case`.** No Title Case, no UPPER. Examples:

| Field | Canonical values | Avoid |
|---|---|---|
| application status | `draft`, `submitted`, `approved`, `enrolled`, `rejected` | `DRAFT`, `Submitted` |
| payment status | `pending`, `success`, `failed`, `refunded` | `PENDING`, `Success` |
| attendance status | `present`, `absent` | `Present`, `P` |
| session type | `lecture`, `practical`, `tutorial` | `Lecture`, `LECTURE` |
| notification event | `exam`, `holiday`, `fee`, `event`, `general`, `alert` | `Exam`, `EXAM` |
| document status | `pending`, `verified`, `rejected` | `Pending`, `Verified` |

**Roles are the one exception** — the role catalog has mixed case for historical reasons (`Student`, `Guest`, `admin`, `principal`, `vice_principal`, `hod`, `accountant`, `TPO`). Treat them as opaque strings; don't normalize them inside any module.

### Canonical entity vocabulary (one name per concept)

| Concept | Canonical name (DB + API + code) | Avoid |
|---|---|---|
| Reference to a student | `student_id` (int) | `studentId`, `student`, `id`, `student_pk` |
| Reference to an Auth user | `user_id` (int) | `userId`, `user`, `id`, `user_pk`, `uid` |
| Reference to a department | `department_id` (int) | `dept_id`, `department`, `dept` |
| Reference to a class | `class_id` (int) | `cls_id`, denormalized `class_name` |
| Reference to a program | `program_id` (int) | (don't conflate with `course_id`) |
| Reference to a course | `course_id` (int) | `subject_id`, `sub_id` — pick one (use `course_id`) |
| Reference to a faculty | `faculty_id` (int) | `teacher_id`, `prof_id` |
| Reference to a division | `division_id` (int) | `div_id` |
| Reference to a batch | `batch_id` (int) | `bat_id` |
| Reference to a bill | `bill_id` (int) | `invoice_id`, `fee_id` |
| Reference to a payment | `payment_id` (int) | `txn_id` (third-party id is a separate field) |
| Reference to an application | `application_id` (int) | `app_id`, `applicant_id` |
| Reference to a placement drive | `drive_id` (int) | `placement_id`, `event_id` |
| Department display name | `department_name` | `dept`, bare `name` |
| Class display name | `class_name` | `cls`, bare `name` |
| Division display name | `division_name` | `div_name` |
| Person's full name | `full_name` | bare `name`, `fullName` (at API wire) |
| Cross-module timestamp | `created_at`, `updated_at` | `created_date`, `createdAt` (at wire) |

**Naming-at-the-boundary rule:** Database column names = API JSON keys. Both are `snake_case`. Frontends are free to convert to `camelCase` internally, but **the wire format is `snake_case`**.

### Environment variable conventions

`UPPER_SNAKE_CASE` always.

| Pattern | Example |
|---|---|
| Module URL | `AUTH_URL`, `SIS_URL`, `FEES_URL`, `NOTIFY_URL`, `ACADEMIC_URL`, `ATTENDANCE_URL`, `PLACEMENT_URL`, `ADMISSION_URL` |
| Module-to-notify API key | `<MODULE>_KEY_2026` (existing pattern — keep) |
| Service port | `<MODULE>_PORT` |
| Secret | `<NAME>_SECRET` (`JWT_SECRET`, `ADMISSION_INTEGRATION_SECRET`) |
| DB connection | `DATABASE_URL` (single var, full connection string) |
| Frontend (Vite) module URLs | `VITE_AUTH_URL`, `VITE_SIS_URL`, `VITE_FEES_URL`, ... |

### Git branch / commit / PR naming

- Branches: `<type>/<short-description-kebab>` — types: `feature`, `fix`, `chore`, `docs`, `refactor`. Example: `feature/auth-gate-on-fees-admin`.
- Commits: lowercase imperative, conventional-commits style. `fix: handle 403 for student role on admin page`.
- PR titles: same as commit format.

### Auditing your own module

Each module's `todo.md` H5 item lists **specific naming violations** in that module and the rename to apply. Use it as your checklist.

## Umbrella concerns (cross-module — live at this top level)

These don't belong inside any single module's repo. Today they live at this directory; later they may move into a `pvg-platform` repo.

### Local "bring up the world" — Docker Compose

A `docker-compose.yml` at this directory orchestrates all 9 modules + Postgres + Redis (used for rate limits + queues) for end-to-end local testing:

```yaml
services:
  postgres: { image: postgres:15, ports: ["5432:5432"], ... }
  redis:    { image: redis:7,     ports: ["6379:6379"] }
  minio:    { image: minio/minio, ports: ["9000:9000"], ... }  # S3-compatible file storage

  auth:        { build: ./modules/pvg-auth/backend,       ports: ["8001:8001"], depends_on: [postgres] }
  sis:         { build: ./modules/pvg-sis/backend,        ports: ["8002:8002"], depends_on: [postgres, auth] }
  academic:    { build: ./modules/pvg-academic-planning-backend, ports: ["8003:8003"], depends_on: [postgres, auth] }
  admission:   { build: ./modules/pvg-admission/backend,  ports: ["8004:8004"], depends_on: [postgres, auth, sis, fees] }
  fees:        { build: ./modules/pvg-fees/backend,       ports: ["8005:8005"], depends_on: [postgres, auth, sis, notify] }
  attendance:  { build: ./modules/pvg-attendance/backend, ports: ["8006:8006"], depends_on: [postgres, auth, sis, academic] }
  placement:   { build: ./modules/pvg-placement/backend,  ports: ["8007:8007"], depends_on: [postgres, auth, sis, notify] }
  notify:      { build: ./modules/pvg-notify/backend,     ports: ["8008:8008"], depends_on: [postgres, redis] }
  # frontends: similar, ports 5173-5180
```

Per-module `run.sh` is for single-module dev; `docker-compose up` is for cross-module integration testing.

### API error response standard

Every error response (4xx, 5xx) returns JSON in this shape:

```json
{
  "detail": "human-readable short title",
  "code":   "machine-readable code (snake_case)",
  "request_id": "uuid4 from X-Request-ID",
  "...": "additional context per error type"
}
```

Standard codes:

| Status | `code` | Meaning |
|---|---|---|
| 401 | `unauthenticated` | JWT missing/invalid → frontend redirects to login |
| 403 | `role_not_allowed` | Role doesn't permit access (see Role taxonomy section) |
| 403 | `not_resource_owner` | Role permits in general, but this specific resource isn't yours (e.g., Student trying to view another student's bill) |
| 404 | `not_found` | Resource doesn't exist |
| 409 | `conflict` | State conflict (e.g., duplicate application) |
| 422 | `validation_error` | + `errors: [{loc, msg, type}]` Pydantic-style |
| 429 | `rate_limit_exceeded` | + `Retry-After` header |
| 503 | `dependency_unavailable` | Another module is down; frontend should retry with backoff |

### Pagination / sorting / filtering conventions

- **Pagination:** `?page=1&page_size=20`. Default `page_size=20`, max `100`. Response includes `meta: { page, page_size, total, total_pages }`.
- **Sorting:** `?sort=created_at,-name` (prefix `-` for desc).
- **Filtering (simple equality):** `?status=approved&department_id=42`.
- **Complex filters:** document per-module in `docs/api.md`. Don't invent ad-hoc query DSLs.

### Cross-module contract tests

Each module ships consumer-driven contract tests under `backend/tests/contracts/`:

- A module that **calls** SIS includes `test_sis_contract.py` — locks the expected response shape of SIS endpoints it depends on. Fails if SIS changes shape unexpectedly.
- Same pattern for `test_notify_contract.py`, `test_auth_contract.py`, `test_fees_contract.py`.

Each module also exposes `backend/tests/contracts/responses/*.json` — fixture files showing "this is what I return for endpoint X". Consumers point their tests at these fixtures.

**End-to-end happy paths** live at this top level: `tests/e2e/`. The flagship test is `tests/e2e/admission_to_sis.py` which spins up docker-compose and exercises Apply → Pay → Enroll → See-in-SIS.

### Faculty role — resolution plan

`Faculty` is needed by Attendance (marking), Academic Planning (timetable + course assignment), and SIS (faculty-of-record context). Today:

- Academic Planning has a `faculty` table (employment record; internal entity).
- Auth has no `Faculty` role string.
- Attendance has a local `User` with role `Faculty` (to be deleted per Attendance todo).

**Target:**

1. Auth adds `Faculty` to its role catalog (`/api/roles/catalog`) — Auth todo H4.
2. Auth issues `Faculty` JWTs when a user is mapped to a `faculty` entity.
3. Academic Planning's `faculty.user_id` FK to Auth's `users.user_id` — same person, two records (employment record in Academic; identity record in Auth).
4. Other modules: query Academic Planning's `faculty` for employment details (`hod_id`, `department_id`, `designation`); query Auth for identity (`email`, `role`).
5. **No module duplicates Faculty data locally.**

### File storage strategy

Several modules store user-uploaded files: Admission docs, Placement circulars/offers/MOUs, SIS photos/signatures, attendance OCR images. Standardize:

- **Local dev:** Minio (S3-compatible) container in `docker-compose.yml`.
- **Production:** S3 / S3-compatible (Cloudflare R2, DigitalOcean Spaces). Decide later.
- Every module uses `boto3` (Python) with same path convention: `<module>/<entity>/<id>/<filename>`.
- DB stores **object keys** (e.g. `placement/offers/1234/offer-letter.pdf`), not full URLs. Generate presigned URLs on read; 24h expiry default.
- No module stores files on local disk. Local disk is for `__pycache__`, not user data.

### CI / Branch protection / PR conventions

Every module's repo gets:

- **Branch protection on `main`:** require 1 PR review (RD1991 + at least one peer), require passing CI, no force-push, no delete.
- **`.github/workflows/ci.yml`** — runs on every PR: lint (ruff + eslint) + type-check (mypy strict + tsc) + tests (pytest + vitest) + coverage threshold check.
- **`.github/pull_request_template.md`** with sections: What changed, How to test, Screenshots (if UI), Breaking changes, Linked issue.
- **`.github/CODEOWNERS`** — `*  @<student-username>  @RD1991`.
- **Conventional commits enforced** by commitlint hook (optional but recommended).

### Module dependency graph

What can call what. **Dependencies must be acyclic** — if X calls Y, Y must not call X.

```
Auth      ← (everyone calls for /api/auth/verify)
SIS       ← Admission (writes), Attendance (reads), Placement (reads), Fees (writes), Academic (reads student_batches)
Academic  ← Attendance (reads timetable), Placement (reads timetable), SIS (reads enrollment), Admission (reads programs/fees)
Notify    ← every module (sends notifications)
Fees      ← Admission (creates bills), Placement (future bills)
```

Backward-pointing arrows (e.g., Fees calling Admission) only as **webhooks** (one-shot, outbound, fire-and-forget); never as synchronous request/response cycles. Otherwise risk circular blocking.

## Per-repo TODO lists

Each repo has its own `todo.md` with red/orange/yellow prioritized changes the student-owner should implement to bring their module in line with the target architecture above.
