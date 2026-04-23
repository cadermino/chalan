# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chalán is a marketplace for moving/freight services deployed in Mexico (chalan.mx) and Peru (chalan.pe). Customers create orders, carrier companies submit quotations, customers pay via Stripe, and carriers fulfill the move. Real estate agents can refer customers via referral links and earn commission on completed orders.

## Architecture

The project is a **monorepo with two Flask backends and three frontends**, all orchestrated via Docker Compose and routed through Nginx.

### Services (local dev via `docker-compose -f docker-compose.local.yml up`)

| Service | Port | Tech | Purpose |
|---------|------|------|---------|
| `flask` | 8001 | Flask/Python 3.11 | Main API (`/api/v1`, `/api/auth`, `/landing`) |
| `backoffice-api` | 8002 | Flask/Python 3.11 | Admin API (separate app, separate models) |
| `vuex` | 8080 | Vue 2.6 | Customer-facing SPA (legacy) |
| `nextjs` | 3000 | Next.js 15 + TypeScript | Marketing/blog site (Peru production) |
| `backoffice` | 5173 | React 18 + Vite | Admin dashboard |
| `nginx` | 80 | Nginx | Reverse proxy |
| `db` | 5432 | PostgreSQL 17 | Database |

### Nginx Routing (production)
- `/api/*` → Flask (8001)
- `/backoffice-api/*` → Backoffice API (8002)
- `/backoffice/*` → React backoffice static files
- `/` → Next.js or Vue frontend

### Two Separate Flask Apps
The main API (`app/`) and backoffice API (`backoffice-api/`) are **independent Flask applications** with their own models, routes, and config. They share the same PostgreSQL database but have separate entry points (`chalan.py` vs `backoffice-api/run.py`) and separate Docker containers.

### Main API Structure (`app/`)
- `app/__init__.py` — App factory, registers blueprints: `/api/v1`, `/api/auth`, `/landing`
- `app/models.py` — All SQLAlchemy models, Marshmallow schemas, and mirror models (`AdminUser`, `ReferredOrder`) for shared tables
- `app/api/` — REST endpoints (orders, customers, quotations, reviews, carrier companies)
- `app/api/order/` — Multi-step order creation (addresses, belongings, appointment)
- `app/api/order/order_status.py` — Order status constants (1=pending, 2=in_progress, 3=completed, 4=cancelled)
- `app/api/quotation/` — Quotation workflow and calculations
- `app/auth/` — JWT authentication for customers
- `app/storage/` — Pluggable file storage (S3 default, factory pattern)

### Backoffice API Structure (`backoffice-api/`)
- `backoffice-api/app/models.py` — AdminUser model with roles (superadmin, admin, carrier_company, real_estate_agent), ReferredOrder model
- `backoffice-api/app/api/` — Admin routes (users, carriers, vehicles, orders, referred-orders)
- `backoffice-api/app/auth/` — JWT authentication for admin users, public registration

### Backoffice Frontend Structure (`backoffice/`)
- `backoffice/src/App.jsx` — Routes with role-based `ProtectedRoute` wrappers
- `backoffice/src/components/Sidebar.jsx` — Navigation filtered by `user.role`
- `backoffice/src/pages/referred-orders/List.jsx` — Referred orders view for real estate agents
- Role-based access: `real_estate_agent` only sees referred orders and profile; carrier/admin roles see orders, companies, vehicles

## Build & Run Commands

### Local Development (Docker)
```bash
docker-compose -f docker-compose.local.yml up        # start all services
docker-compose -f docker-compose.local.yml up flask   # start only Flask API
docker-compose -f docker-compose.local.yml up --build # rebuild containers
```

### Database Migrations (inside flask container)
```bash
docker-compose -f docker-compose.local.yml exec flask flask db migrate -m "description"
docker-compose -f docker-compose.local.yml exec flask flask db upgrade
```

### Frontend Commands
```bash
# Vue (frontend/)
cd frontend && npm run serve     # dev server
cd frontend && npm run build     # production build
cd frontend && npm run lint      # lint

# Next.js (frontend-react/)
cd frontend-react && npm run dev   # dev server (port 3000)
cd frontend-react && npm run build # production build
cd frontend-react && npm run lint  # lint

# Backoffice React (backoffice/)
cd backoffice && npm run dev     # dev server (port 5173)
cd backoffice && npm run build   # production build
```

### E2E Tests (Playwright)
```bash
cd e2e && npx playwright test                    # run all tests
cd e2e && npx playwright test tests/step-one.spec.js  # run single test
```
Base URL defaults to `http://local.chalan.mx` (override with `BASE_URL` env var).

### Production Builds
```bash
docker-compose -f docker-compose.prod.yml up --build       # Mexico
docker-compose -f docker-compose-peru.prod.yml up --build  # Peru
```

## Key Technical Details

- **Auth**: JWT tokens (PyJWT) for both customer and admin APIs, validated via decorators in `app/api/decorators.py` and `backoffice-api/app/api/decorators.py`
- **Config**: Environment-driven via `.env.dev` / `.env.prod` files; `config.py` maps `FLASK_ENV` to config classes
- **Payments**: Stripe integration with success/cancel redirect URLs
- **Storage**: S3-backed file uploads via factory pattern (`app/storage/factory.py`)
- **Serialization**: Marshmallow schemas defined alongside models in `app/models.py`
- **Two deployment targets**: Mexico (`Dockerfile.prod`) and Peru (`Dockerfile.peru.prod`) with timezone and domain differences

## Order Statuses

Defined in `app/api/order/order_status.py` and `lu_order_status` table:

| ID | Status |
|----|--------|
| 1 | pending |
| 2 | in_progress |
| 3 | completed |
| 4 | cancelled |

**Important**: The Vue frontend (`frontend/src/views/order/Step-one.vue` and `Step-four.vue`) hardcodes these IDs. Do NOT change the numeric values without updating Vue as well.

## Admin User Roles

Defined in `backoffice-api/app/models.py`:

| Role | Purpose |
|------|---------|
| `superadmin` | Full access to all backoffice features |
| `admin` | Admin access (no user management) |
| `carrier_company` | Carrier companies — see orders, vehicles, company profile |
| `real_estate_agent` | Real estate agents — only see their referred orders |

## Referral System (Real Estate Agents)

Real estate agents refer customers to Chalán via a referral link and earn commission.

### Flow
1. Agent registers in backoffice with role `real_estate_agent` → auto-generates a unique `referral_code` (e.g., `AGT-X7K2`)
2. Agent shares link: `https://chalan.pe/?ref=AGT-X7K2`
3. Vue `App.vue` and Next.js `ReferralCapture.tsx` capture `?ref=` param → save to `chalan_ref` cookie (30-day TTL)
4. Customer creates order → Vue `Step-one.vue` reads cookie and sends `referral_code` in the create order payload
5. Main API `app/api/orders.py` looks up agent by `referral_code` → creates `referred_orders` record
6. When carrier submits quotation (`app/api/quotations.py`), if order is referred, agent's `commission_rate` is added to the price before `PLATFORM_FEE`
7. When customer picks a quotation, commission is calculated and stored in `referred_orders.commission`

### Commission Calculation (in `app/api/quotations.py`)
- **create_quotation**: `amount = base + (base * agent.commission_rate) + (base * PLATFORM_FEE)` — agent commission baked into price
- **pick_quotation**: `base = quotation.amount / (1 + commission_rate + PLATFORM_FEE)` → `commission = base * commission_rate` — stored in `referred_orders.commission`
- Commission balance is calculated on-the-fly by summing `referred_orders.commission` for orders NOT in completed (3) or cancelled (4) status

### Key Tables
- `admin_users.referral_code` — unique code per agent (e.g., `AGT-X7K2`)
- `admin_users.commission_rate` — per-agent rate (default 0.05 = 5%), negotiable
- `referred_orders` — links `admin_user_id` ↔ `order_id` with `commission` amount
- `referred_orders.commission` — the agent's commission for that specific order, set when customer picks a quotation

### Mirror Models
The main API (`app/models.py`) has lightweight mirror models for `AdminUser` and `ReferredOrder` (with `extend_existing=True`) since both Flask apps share the same database.

## Database Migrations

Migrations live in `migrations/versions/` and follow sequential numbering (`001_`, `002_`, etc.). They run inside the `flask` container. The backoffice-api does NOT have its own migrations — all schema changes go through the main API's Alembic setup since both apps share the same database.

When writing migrations for tables that may already exist (e.g., created manually or by another process), use raw SQL with `IF NOT EXISTS` instead of `op.create_table()` to avoid `DuplicateTable` errors.
