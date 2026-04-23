# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chalán is a marketplace for moving/freight services deployed in Mexico (chalan.mx) and Peru (chalan.pe). Customers create orders, carrier companies submit quotations, customers pay via Stripe, and carriers fulfill the move.

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
- `app/models.py` — All SQLAlchemy models and Marshmallow schemas
- `app/api/` — REST endpoints (orders, customers, quotations, reviews, carrier companies)
- `app/api/order/` — Multi-step order creation (addresses, belongings, appointment)
- `app/api/quotation/` — Quotation workflow and calculations
- `app/auth/` — JWT authentication for customers
- `app/storage/` — Pluggable file storage (S3 default, factory pattern)

### Backoffice API Structure (`backoffice-api/`)
- `backoffice-api/app/models.py` — AdminUser model with roles (superadmin, admin, carrier_company)
- `backoffice-api/app/api/` — Admin routes (users, carriers, vehicles, orders)
- `backoffice-api/app/auth/` — JWT authentication for admin users

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
