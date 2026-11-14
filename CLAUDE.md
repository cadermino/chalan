# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chalán is a marketplace for moving/freight services deployed in Mexico (chalan.mx) and Peru (chalan.pe). Customers create orders, carrier companies submit quotations, customers pay the carrier in cash, and carriers fulfill the move. Real estate agents can refer customers via referral links and earn commission on completed orders.

## Architecture

The project is a **monorepo with two Flask backends and three frontends**, all orchestrated via Docker Compose and routed through Nginx.

### Services (local dev via `docker-compose -f docker-compose.local.yml up`)

| Service | Port | Tech | Purpose |
|---------|------|------|---------|
| `flask` | 8001 | Flask/Python 3.11 | Main API (`/api/v1`, `/api/auth`, `/landing`) |
| `backoffice-api` | 8002 | Flask/Python 3.11 | Admin API (separate app, separate models) |
| `vuex` | 8080 | Vue 3 + Vite + Pinia | Customer-facing SPA (order flow, carrier quotation link) |
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
- `backoffice/src/pages/customers/List.jsx` — Customer list with search (admin/superadmin only)
- `backoffice/src/pages/orders/Edit.jsx` — Edit order fields (superadmin only)
- Shared by the detail pages (order, service request): `components/Card.jsx` (card with the one title style), `components/CopyButton.jsx` (the only copy button, plus `CopyRow`: title + hint + button) and `components/ClientContact.jsx` (name · WhatsApp · Copiar número: customers are written to from the external WhatsApp, not the internal chat). Both details open with the same "Cliente" card (contact + customer link, and the review link on a completed order) and end with "Transportistas". Use these instead of local copies
- Role-based access: `real_estate_agent` only sees referred orders and profile; carrier/admin roles see orders, companies, vehicles; customers page is admin/superadmin only

### Backoffice Password Reset
"¿Olvidaste tu contraseña?" in the login (`pages/ForgotPassword.jsx`, `/recuperar`) sends `POST /backoffice-api/auth/password-reset {email}`: always the same 202, account or not (otherwise it tells who has one), and at most one email every 2 minutes per user (`admin_users.password_reset_requested_at`, migration 044). The email (`email/password_reset`) links to `{SITE_URL}/backoffice/restablecer/<token>` (`pages/ResetPassword.jsx`), where `POST /auth/password-reset/confirm {token, password}` (8+ characters) saves it and returns the same session as the login. The token (`backoffice-api/app/password_reset.py`, itsdangerous, salt `password-reset`) carries the user id and a fingerprint of the current password hash, so it works once with no token table; 1 hour from the email, 24 hours from the link a superadmin copies in Usuarios → editar ("Link para crear contraseña", `GET /api/users/:id/password-reset-link`) to send over WhatsApp. Inactive users get no email and their links fail. 401 `reason`: `expired`, `used`, `invalid`. Old sessions are not closed when the password changes (the JWT lasts 24 h), and "Mi perfil" still changes it without asking the current one.

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
Base URL defaults to `http://local.chalan.mx` (override with `BASE_URL` env var). They run headless; add `--headed` (with `SLOWMO=1000` to follow along) or `--ui` to watch them.

### Vue frontend (Vue 3, Vite, Pinia)
- **Store**: one Pinia store, `useStore` (id `main`) in `frontend/src/store/index.js`. The old Vuex mutations are actions with the same name and payload (`setOrder({ section, field, value })`, `setCustomerData`...), and components map them with `mapState`/`mapActions(useStore, [...])`. `store/pinia.js` holds the single Pinia instance the router guards use. `utils/sessionTags.js` tags Inspectlet/Clarity through `$onAction`.
- **Env**: Vite reads the old `VUE_APP_*` names (`envPrefix` in `vite.config.mjs`) as `import.meta.env.VUE_APP_*`, so the server's `frontend/.env.production` and the `ENV` in `Dockerfile.nginx.peru.prod` work unchanged.
- **Build output** goes to `dist/js`, `dist/css` and `dist/img`, the paths nginx serves with immutable cache. `index.html` sits at `frontend/` (not `public/`); its `<!-- if:production -->` / `<!-- if:analytics -->` blocks (Inspectlet, Clarity, GA) are resolved by the `indexHtml` plugin in `vite.config.mjs`.
- **Local dev**: the dev server uses the base `/vue-dev/` (the local nginx sends it to `vuex`) and serves the app routes (`/order`, `/acceso`...) through a fallback, like services-web. After changing `frontend/package.json`, recreate the container with `up -d --build -V vuex` or the old anonymous `node_modules` volume stays mounted.
- **The order draft** (`currentOrder`, `orderDetailsOrigin`, `orderDetailsDestination`, `services`) lives in localStorage so a reload or a later visit keeps it. Entering step 1 discards it when it is no longer a draft (`utils/orderDraft.js`, `discardOrderDraft` in the store): its order is no longer pending, its moving day passed, or it was not touched in 5 days (`orderDraftSavedAt`, written by `setOrder`), or it was scheduled in this browser (the payment modal writes `payment_method`; it is not cleared right there because going back to step 3 to confirm the same quotation again must keep working, and `getOrderFromDataBase` resets it). The customer session and the load type stay. Before this, a customer coming back weeks later sent step 1's PUT to their scheduled order: 403 with an expired session, or it rewrote that move and cancelled its quotations. The API now answers 409 to a PUT with `orderEditedByCustomer` on an order that is not pending (internal callers excepted), and step 1 then creates a new order (also on 403/404) instead of showing an error. Step 1 creates the order with the customer only while the session is valid; with an expired one it goes without an owner, like a new visitor's. Logging in or registering hands the draft to whoever came in (`attachDraftAfterLogin` in the store, used by the three login/register views); when the API refuses it (403: another account's order, e.g. after opening someone else's access link in the same browser; 404; 409: no longer pending) the draft is discarded, the customer's last pending order is loaded and the login goes to `/dashboard` instead of the old order. Before, the login stuck on "Hubo un error" and reloading did not help.
- **Addresses in step 1** (`components/SearchBoxPlacesApiGoogle.vue`): an address is complete once it has a place (`*_map_url`, country), which stays required because carriers price from the exact spot. That place can come from a Places suggestion, from a tap on the map (from zoom 16; a tap farther out zooms in there by 4 levels, so country, city, neighbourhood, street), or from pressing "Guardar y continuar" with text but no pick: the typed text is looked up (`findTyped`, `findPlaceFromQuery`) and shown as a pin to confirm, and the next press goes on. Before, people whose address Google didn't suggest got stuck. A pin's `map_url` is a coordinates link. A pin writes its address into the street field, and the notice asks the customer to correct the number (or Mz. and Lt.) there. The typed lookup keeps what was written. The address and area (country, postal code, district) come from the Geocoder. When the key lacks the Geocoding API, as the local key does, they come from Places instead: the found place's details, or the nearest non-political place to a pin, whose number may be off. Saved coordinates put the pin back on return. GA4: `address_pin_set`, `address_typed_lookup` (`found`).
- **Things to move in step 2**: the list is written first; the photo is a secondary button under it ("¿Prefieres una foto?"), because the big photo box on top made people without photos think it was required. Photos are shrunk in the browser to a JPEG ≤2000 px (`utils/shrinkPhoto.js`) before `POST /order/recognize-items`, and what happened shows right under the button (reading, items added, nothing found, failed), not at the top of the page. GA4: `photo_uploaded` (`size_kb`), `photo_recognized` (`items_count`, `seconds`), `photo_failed` (`reason`: timeout/network/server/rejected), with Inspectlet labels `photo_uploaded`, `photo_empty`, `photo_failed:<reason>`. "Siguiente" with a field missing takes you to the first one (`FIELD_ELEMENTS` in `Step-two.vue`).
- **Budget in step 2**: `approximate_budget` is required (more than 0) when the customer submits step 2 (`nextStep` in `Step-two.vue`), not in the store's requisites: the step-three guard needs step 2 complete, and older orders and the quotation agent's have it empty or 0 (the API stores 0 for empty). Carriers see it without the fee.
- **e2e** reach the store through `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('main')` and call actions directly (`store.setOrder(...)`).
- **Tailwind 3.4, not 4**: v4 needs Safari 16.4+, and the order flow has to work on older iPhones. `tailwind.config.js` sets the Tailwind 1 values the app was designed with (screens, palette, shadows, font sizes without line heights, gray-300 default border; the placeholder color is in `tailwind.css`), so the upgrade repainted nothing. The palette replaces v3's: a color v1 didn't have does not exist unless it is added there (`gray-50` and `green-50` were). Spacing, opacity, widths and the rest are v3's defaults. `postcss.config.js` expands `inset` into top/right/bottom/left for Safari < 14.1. Classes are found through `content` (index.html, `src/**/*.{vue,js}`): don't build class names by concatenation.
- `moment` locales must be imported (`main.js` imports `moment/locale/es`); webpack used to bundle them all. The appointment is a day from `@vuepic/vue-datepicker` (date only, date-fns `es` locale) plus an hour button, on the hour from 7 am to 6 pm (`Step-two.vue`); today's past hours are disabled, and after 6 pm the calendar starts tomorrow. `appointment_date` is still `YYYY-MM-DD HH:00:00`, written once both are chosen.

### Production Builds
```bash
docker-compose -f docker-compose.prod.yml up --build       # Mexico
make deploy-peru                                           # Peru (see below)
```

Peru deploys go through `make deploy-peru` (plan only: `make deploy-peru-plan`, undo: `make deploy-peru-rollback`). It deploys `origin/master`, runs the API tests and the Next type check locally (the server's `next build` skips it with `SKIP_TYPECHECK`: from swap it took 26 minutes), triggers the DB backup workflow when there is a migration, and runs `deploy/peru.sh` on the server: builds only the changed services one at a time (`nginx` last; the 924 MB host cannot build in parallel). `nextjs` is the exception: its build got stuck in swap on the host, so `peru-local.sh` builds it on the laptop (`linux/amd64`, from a clean worktree of `origin/master`, with the server's `NEXT_PUBLIC_*`) and uploads it as `chalan-prebuilt/nextjs:<commit>`, which `peru.sh --prebuilt nextjs` tags as `chalan-nextjs` (needs Docker running locally; `ARGS=--build-on-server` for the old way). It migrates before restarting `backoffice-api`, health-checks every route and rolls back on failure. If there is less than 3 GB free, it empties the Docker build cache itself before building; the `chalan-prev/*` rollback images stay. It only stops if that is still not enough. When there is a migration it triggers a DB backup first, and a retry of the same deploy (same target commit and same server starting point, under 12 hours) reuses that backup instead of making another; `--new-backup` forces a fresh one (`ARGS=--new-backup`). Before recreating `nginx` (deploy or rollback) it saves the container's access log, gzipped, to `~/deploy-logs/nginx/` on the server (30 days): the log lives in the container, so before this nothing older than the last deploy survived. Never use a combined `up --build` on the Peru host.

## Key Technical Details

- **Auth**: JWT tokens (PyJWT) for both customer and admin APIs, validated via decorators in `app/api/decorators.py` and `backoffice-api/app/api/decorators.py`
- **Config**: Environment-driven via `.env.dev` / `.env.prod` files; `config.py` maps `FLASK_ENV` to config classes
- **Payments**: cash only (`PUT /api/v1/order/checkout-cash/:order_id`), which creates a `payments` row and emails carrier + customer. In the order detail's "Pagos" card, the reservation marked paid (or registered as received, for an order closed over WhatsApp) puts the order in progress through the main API's `confirm-reservation`, and the carrier cash marked paid completes it (undoing it puts it back in progress), like a service's balance. Confirming the reservation of an order whose moving day already passed (an admin recording a move done over WhatsApp) puts it in progress without the "Hemos agendado tu mudanza" emails. Stripe was removed; the `lu_payment_type` row `stripe` and `payments.reference` stay for historical rows. Culqi is the planned gateway for Peru
- **Customer dashboard** (`views/Dashboard.vue`, where scheduling lands): the last order as a card, like the services quotations page. It shows the total, the reservation, the balance to pay the carrier on the day, and the carrier's WhatsApp only once the move is confirmed (in progress or completed); while the yapeo is being verified there is no contact. `GET /api/v1/customer/<id>/orders` adds `status`, `total_amount`, `carrier_amount`, `reservation`, `carrier_cash_status` and `carrier_contact`, and answers 403 to a token of another customer (before, any session read anyone's last order).
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
1. Agent registers in backoffice with role `real_estate_agent` → auto-generates a unique `referral_code` (e.g., `AGT-X7K2`). A superadmin creating one, or switching a user to that role, in Usuarios also generates it (`_ensure_referral_code` in `backoffice-api/app/api/users.py`)
2. Agent shares link: `https://chalan.pe/?ref=AGT-X7K2`. The agent sees it in their "Órdenes referidas"; superadmins copy any agent's link from Usuarios (the agent's row and its edit form; `GET /api/users` also gives a code to an agent left without one). The URL is built by `backoffice/src/lib/referral.js`
3. Vue `App.vue` and Next.js `ReferralCapture.tsx` capture `?ref=` param → save to `chalan_ref` cookie (30-day TTL)
4. Customer creates order → Vue `Step-one.vue` reads cookie and sends `referral_code` in the create order payload
5. Main API `app/api/orders.py` looks up agent by `referral_code` → creates `referred_orders` record
6. Carrier submits a quotation (`app/api/quotations.py`) — stored **raw**, exactly as the carrier typed it. Neither the fee nor the commission is written into it
7. When the customer lists quotations, `commission_rate` + `PLATFORM_FEE` are applied on top to produce the `total_amount` shown. On picking one, that total is persisted to `orders.total_amount` and the commission is stored in `referred_orders.commission`

### Commission Calculation

**`quotations.amount` always holds the carrier's raw price.** Neither `PLATFORM_FEE` nor the agent commission is ever written into it — both are applied on top, from the same formula, at display time and at pick time. Don't divide a stored amount to "back out" the fee; there is nothing baked in to remove.

- **create_quotation** (`app/api/quotations.py`): stores the carrier's price as-is. No fee, no commission.
- **Display** (`app/api/quotation/quotation.py`, `toJson`): `total_amount = round(amount * (1 + commission_rate + PLATFORM_FEE), 2)`. The response carries **both** `amount` (raw) and `total_amount`, so `total_amount - amount` is exactly what the customer owes Chalán — use that instead of recomputing the fee client-side.
- **pick_quotation** → `_accept_quotation` (`app/api/quotations.py`): persists the same formula into `orders.total_amount`, and stores `referred_orders.commission = quotation.amount * commission_rate` — a straight percentage of the raw amount, no division.
- `commission_rate` is `0` unless the order has a `referred_orders` row. So a non-referred order with a carrier price of 100 and `PLATFORM_FEE=0.1` shows a total of 110; the same order referred by an agent at 5% shows 115.
- Commission balance is calculated on-the-fly by summing `referred_orders.commission` for orders NOT in completed (3) or cancelled (4) status (`backoffice-api/app/api/orders.py`)

### Key Tables
- `admin_users.referral_code` — unique code per agent (e.g., `AGT-X7K2`)
- `admin_users.commission_rate` — per-agent rate (default 0.05 = 5%), negotiable
- `referred_orders` — links `admin_user_id` ↔ `order_id` with `commission` amount
- `referred_orders.commission` — the agent's commission for that specific order, set when customer picks a quotation

### Mirror Models
The main API (`app/models.py`) has lightweight mirror models for `AdminUser` and `ReferredOrder` (with `extend_existing=True`) since both Flask apps share the same database.

## Next.js Landing v2 (Peru)

The `frontend-react/` site was redesigned with a new landing page and shared components.

### New Components
- `frontend-react/src/components/LandingNav.tsx` — new navbar (replaces `Navbar.tsx`, which was removed)
- `frontend-react/src/components/LandingFooter.tsx` — new footer (replaces `Footer.tsx`, which was removed)
- `frontend-react/src/components/QuoteWidget.tsx` — interactive quote estimator widget
- `frontend-react/src/app/landing.css` — landing-specific styles (Inter Tight font, custom layout)

### Fonts
The site's fonts (Instrument Serif, Inter Tight, JetBrains Mono, Outfit) are served from the repo with `next/font/local`: the `.woff2` files (latin subset, OFL) live in `frontend-react/src/fonts/` and are declared once in `src/lib/fonts.ts`, which every page imports. They used to come from `next/font/google`, which downloads at build time and made Peru deploys fail now and then (`Cannot read properties of null (reading '1')`). To change a font, drop its latin `.woff2` from Google Fonts into `src/fonts/` and edit `fonts.ts`.

### Blog in GA4
Every `page_view` of the Next site carries `content_group` (`home`, `blog`, `blog_index`, `service`, `carriers`, `professionals`, `landing`; `PageViewTracker.tsx`), which GA4 reads as its standard "Grupo de contenido". A post's also carries `post_category` and `post_date`, read from the `data-*` of `#blog-article`, and `BlogReadDepth.tsx` sends `blog_read_depth` (`percent` 25/50/75/100 of the post's text, `post_category`). `post_category`, `post_date` and `percent` are custom dimensions registered in GA4: they only carry values from the day they were registered.

**A/B of the quote widget (November 2026, temporary)**: on screens ≥1024 px, posts that end in the quote widget (`inBlogTest`: not `Transportistas`, no `cta`) show it inline as before (`inline`) or sticky in a right column (`sidebar`), which hides the inline one, the sentence that introduces it (`:has`) and the one at the end. A script in the layout `<head>` assigns the version (cookie `chalan_blog_ab`, 90 days) to `<html data-blog-layout>` before paint, and the CSS in `globals.css` does the rest. Every event and page view on those posts on wide screens carries `blog_layout` (`lib/blogLayoutTest.ts`, through `track()` and `PageViewTracker`), and `PageViewTracker` tags the Inspectlet session and the Clarity recording with `blog_layout` too (`tagRecordings`). Metric: sessions with `quote_widget_start` over sessions on those posts, then `quote_cta_click`; until 2026-11-30 (extended from 2 weeks: only ~30 people per version reached it in the first 11 days). When it ends, keep the winner and remove what `blogLayoutTest.ts` lists. The `body` has `overflow-x: clip` (not `hidden`, which made the body a scroll container and broke `position: sticky` site-wide).

**A/B of the quote widget's button (November 2026, temporary)**: everywhere the widget is, on any screen, "Continuar con esta cotización" (`continuar`) or "Comparar precios de transportistas" with "Sin compromiso · Te avisamos por WhatsApp cuando lleguen" under it (`comparar`). A second `<head>` script (`lib/ctaTextTest.ts`, cookie `chalan_cta_ab`, 90 days, drawn apart from the blog test) sets `<html data-cta-text>`; both texts are in the HTML and `globals.css` hides one. The widget's `quote_*` events carry `cta_text` (`track()` in `lib/analytics.ts`), and Vue's `order_created` too (`ctaTextVersion()` in `frontend/src/utils/analytics.js`, same cookie). Starting to use the widget tags the Inspectlet session and the Clarity recording with `cta_text` (`tagCtaText`). Metric: people with `quote_cta_click` over people with `quote_widget_start`; control: `order_created`. 6 weeks or 170 people per version. When it ends, keep the winner and remove what `ctaTextTest.ts` lists.

### QuoteWidget
Client-side widget (`'use client'`) that estimates a move price based on:
- Move size: small (room/packages), medium (1–2 bedroom apt), large (family home)
- Origin/destination via Google Places Autocomplete (requires `NEXT_PUBLIC_PLACES_API_KEY`)
- Calculates estimated price range and links to the order creation flow

The widget is embedded across multiple pages: homepage, `como-funciona`, `fletes-peru`, `mudanzas-lima`, `mudanzas-huancayo`, `preguntas-frecuentes`, and blog posts.

### NEXT_PUBLIC_PLACES_API_KEY at Build Time
`NEXT_PUBLIC_*` variables are inlined into the JS bundle at build time. The Dockerfile uses `ARG NEXT_PUBLIC_PLACES_API_KEY` + `ENV` to pass it in. When building locally, load the env first:
```bash
set -a && source .env.prod && set +a
docker-compose -f docker-compose-peru.prod.yml up --build
```

## Customers in Backoffice

Admins can view and search all registered customers.

- **API**: `GET /backoffice-api/api/customers?q=<search>` — searches name, email, phone; returns up to 200 results; admin/superadmin only
- **Frontend**: `backoffice/src/pages/customers/List.jsx` — table with search form; accessible via sidebar
- **API file**: `backoffice-api/app/api/customers.py`
- **Create**: `POST /backoffice-api/api/customers` (superadmin, `pages/customers/Create.jsx`) creates the customer **without a password**, through the main API's `/api/auth/register` with the internal token (the public site still requires one). The customer opens their order with the order link below.

## Order Access Link (no password)

The customer session lasts 24 hours and there is no password reset, so a customer coming back from the "new quotation" WhatsApp another day or on another phone used to hit the login. The notice now carries `{SITE_URL}/acceso/<token>`: the order and its customer (`[order_id, customer_id]`) signed with `SECRET_KEY` by itsdangerous (salt `order-access`, short on purpose because it goes in a WhatsApp, valid 60 days).

- **Main API**: `app/api/order_access.py` makes and reads it; `POST /api/auth/order-access {token}` returns the same session as the login plus `order_id`. 401 with `reason` `expired` or `invalid`; the link stops working if the order changes customer. Used by the new-quotation email and WhatsApp (`app/api/quotations.py`).
- **Vue**: `/acceso/:token` (`views/OrderAccess.vue`) redeems it, replaces any session in that browser and opens `/order/<id>/step-three`. On failure it goes to the login with a message. nginx routes `/acceso` to Vue (`nginx.chalan-prod-peru.conf`, local conf).
- **Backoffice**: the order detail (admins) has "Link del cliente": `GET /backoffice-api/api/orders/:id/customer-link` returns the token (409 if the order has no customer) and the page builds `{origin}/acceso/{token}`. `backoffice-api/app/order_access.py` makes the same token: change both together.
- Customers without a password (Google, Facebook, backoffice) get a clean 400 from the password login (`Customer.verify_password`).

## Contact Step Instead of Registration (moving orders)

Between step 2 and step 3 the Vue router used to send visitors to `/register` (password, and there is no password reset). It now sends them to `/order/contacto` (`views/order/Contact.vue`): name, email and WhatsApp, no password, with a typo hint for common email domains. `POST /api/auth/order-contact {order_id, name, email, mobile_phone}` (`app/auth/auth_routes.py`):

- **New email**: creates the customer without a password, links the unowned order and returns the same session as the login (201). Step 3 then requests the quotations as before.
- **Email that already has an account**: no session (whoever types someone else's email would see their orders). It links the order to that account, keeps the typed phone in `orders.lead_phone` (always the last one typed; the account's phone is not touched, and the backoffice order detail shows it to admins as "WhatsApp de este pedido" when it differs), and emails the order access link (`email/order_access_link`, see Order Access Link) to that address (202, masked email in the body). The order reaches carriers only when the link is opened, because step 3 is what notifies them.
- 409 if the order already has a customer, 400 for missing fields or a malformed email.
- Carriers are only notified for an order that has a customer (`send_email_to_carrier_companies` in `app/api/orders.py`). An unowned order can be edited without a session, so before this anyone could make every carrier receive a fake order. External callers (the quotation agent) save the order data without a session, then call `order-contact`, and request quotations with the 201 session.
- The login's "Regístrate" link goes to the contact step when the redirect is step 3 (`signUpRoute` in `components/Login.vue`). `/register` still exists outside the order flow.
- **Who closed step 1's WhatsApp modal** (`lead_phone_prompted` and no phone) sees a green box above the fields: only 44 % of them passed this step, against 95 % of those who left their number (GA4 exploration "Contacto: dejó vs omitió WhatsApp", Oct–Nov 2026). A move or items order with both ends in Lima (by coordinates) gets the real range of Lima move quotations (`LIMA_MOVE_RANGE`, p25–p75 with `PLATFORM_FEE`, from the price study); every one gets how fast the first quotation comes, and other routes and loads also how much comparing saves. Not the landing widget's formula, which estimates about half of what carriers quote. Update the numbers with the price study.
- GA4: `sign_up` with `method: 'contact'`, and `contact_existing_account`. Opening an order access link sends `login` with `method: 'order_link'` (`views/OrderAccess.vue`), so whoever came in through the emailed link counts in the funnel step "Pasó el registro" (`sign_up` or `login`).

## What an Order Carries (load type)

A quarter of the orders that came in through the moving form were not moves (sacks of rice, cement, 13.6 t of geomembrane, a pickup truck), and the form asked them for floors and a household inventory. Migration 030 added `orders.load_type` (`moving`, `items`, `cargo`, `vehicle`) and `orders.cargo_weight_kg` (the top of a weight range: 500, 1500, 3000, 10000, and 20000 for "more than 10 t"). Both empty = an order from before, read as a move.

- **Lists**: `app/api/order/load.py` (API), `frontend/src/utils/loadTypes.js` (Vue), a copy in `backoffice-api/app/api/orders.py`, and labels in the backoffice `orders/Detail.jsx` and `Edit.jsx`. Change them together.
- **Weight is required for `cargo` only**: step 2 shows the range select (`isRequired` in `store/index.js` skips `cargo_weight_kg` otherwise), `BelongingsAppointmentDate.is_complete()` keeps a cargo without weight from going to carriers, and `notify-carriers` lists it as missing. Any other load type drops the weight.
- **The API only writes them when the body has `load_type`** (`_set_load` in `app/api/order/order.py`): callers that don't send it (the quotation agent) keep what was saved.
- **Vue**: step 1 asks "¿Qué vas a transportar?" first (default `moving`). Both floors start at 1 for every load type (an empty floor select blocked step 1), and cargo and vehicle label it "Piso". Step 2 changes the inventory label and placeholder (`INVENTORY_COPY`). Carriers see "Qué lleva" in `quotation.vue` and `order-details.vue`.
- **Landing widget** (`QuoteWidget.tsx`): chips above the sizes. Cargo and vehicle relabel the sizes (Camioneta / Camión / Camión grande) and hide the moving icons; the price formula is the same for now. The choice goes to Vue by merging `load_type` into `localStorage.currentOrder`, on the chip click and on the CTA. `load="cargo"` opens a widget on cargo: `/fletes-peru` and the flete post, whose frontmatter `quoteLoad: "cargo"` also sets the widget that closes it.
- **GA4**: `load_type` on `quote_widget_start`, `quote_estimated`, `quote_cta_click`, `order_created`, `step_one_blocked`, `step_two_submitted` (with `cargo_weight_kg`) and `step_two_blocked`.

## Edit Order in Backoffice

Superadmins can edit order fields directly from the backoffice.

- **API**: `PUT /backoffice-api/api/orders/:id` — editable fields: `appointment_date`, `order_status_id`, `approximate_budget`, `total_kilometers`, `comments`, `load_type` and `cargo_weight_kg` (400 outside the lists), `origin` address, `destination` address; superadmin only
- **Frontend**: `backoffice/src/pages/orders/Edit.jsx` — form accessible from the orders list via "Editar" link (superadmin only)

## Order Videos (backoffice → carrier link)

Customers send videos of their things over WhatsApp. A superadmin uploads them in the backoffice order create/edit form (`components/OrderVideosField.jsx`, `lib/orderVideos.js`), and carriers watch them on the quotation link (`quotation.vue`, also `order-details.vue`) under "Videos de la carga", with an "Abrir video" link because an iPhone HEVC `.mov` does not play in every browser.

- **Table** `order_videos` (migration 035), separate from `order_images`: every reader of that one draws an `<img>` and AI item recognition runs on it. `Order.details()` returns `videos` next to `images`.
- **Upload**, like service request media: browser → S3 with a presigned POST, never through the backoffice-api (250 MB). backoffice-api `POST /api/orders/:id/videos/presign`, `POST /api/orders/:id/videos` `{storage_key}`, `DELETE /api/orders/:id/videos/:vid` (superadmin) forward with the internal token to the main API `/api/v1/order/:id/videos...` (`app/api/order_videos.py`, internal only), which re-checks the stored file with `head`. MP4/MOV/WEBM, 250 MB, 5 per order. Keys `orders/<id>/video-<uuid>.<ext>`, public under the bucket's `orders/*` policy.
- The forms queue the videos and upload them on save, one at a time with a progress bar; edit uploads them before "Guardar y enviar" notifies carriers. A failed one stays in the queue with its error.
- **CORS**: the bucket accepts POST from `https://chalan.pe`, which covers the backoffice in production. The local backoffice (`http://localhost:5173`) is not in the bucket's CORS list, so a real upload from there fails at the S3 step until that origin is added.

## Quotation Links (Admin Feature)

Admins can generate quotation links per carrier company from any order detail page in the backoffice.

### Flow
1. Admin opens an order detail (`/orders/:id`) in the backoffice
2. The page calls `GET /backoffice-api/api/orders/:id/quotation-links` (admin/superadmin only)
3. The API returns the active carrier companies that offer moving (see Services per Company) with the **short quotation link** code of each one (`code`, see Reminder to Carriers)
4. The frontend builds the URL as `{window.location.origin}/c/{code}` — domain is relative to the current environment
5. Admin copies the link and sends it to the carrier company manually

### Key Files
- `backoffice-api/app/api/orders.py` — `get_quotation_links()` endpoint, uses `make_code` from `app/quotation_short_link.py`
- `backoffice/src/pages/orders/Detail.jsx` — shows the company list with copy buttons for admin roles; carrier company users still see the single "Cotizar ahora" CTA

### Reminder to Carriers
"Recordar a transportistas" in the orders list (admins, `components/CarrierReminders.jsx`) lists, per company that does moves, the pending orders it neither quoted nor declined: already sent to carriers (`quotation_requested`), with a customer, the moving day from today on and no selected quotation. Each row has "Copiar número" and "Abrir WhatsApp" (`wa.me` with the message written; a 9-digit phone gets `51`; without a phone, "Copiar mensaje"): up to 20 orders, the soonest, with date, origin and destination district, load type and each one's **short quotation link** (no password; the backoffice login has no password reset). `GET /backoffice-api/api/orders/carrier-reminders` (`carrier_reminders` in `orders.py`). Load type labels live in `backoffice/src/lib/loadTypes.js`. The message greets the company's **coordinator** by first name ("Hola Jackelinne, tienes 3 órdenes…"; just "Hola," without one): `carrier_company.coordinator_name` (migration 049), whoever Carlos talks to over WhatsApp, since the account is made with the legal representative's name. Only admins set it (company form, 403 for the company itself), and the companies list shows it in a "Coordinador" column. It is not `contact_name`, which replaces the company name for customers.

**Short quotation link**: `chalan.pe/c/<order>-<company>-<signature>` (~40 characters instead of ~210 with the JWT). The signature is 10 characters of an HMAC-SHA256 with `SECRET_KEY` (salt `quotation-short-link`), so neither number can be changed; it does not expire, the quotation page checks the order. backoffice-api `app/quotation_short_link.py` makes it and the main API `app/api/quotation_short_link.py` reads it: change both together (a main API test compares them). Next `app/c/[code]/page.tsx` (noindex, in `robots.ts`) trades it at `GET /api/v1/quotation-links/<code>` for a fresh 10-day JWT and redirects to `/quotation/<jwt>`; 404 for a bad code or a deleted order/company. No nginx change: `/c/` falls into Next's `location /`. The order detail's "Transportistas" card uses it too; the new-order notices still send the long link.

### Reminder to Customers
"Recordar a clientes" in the orders list (admins, `components/CustomerReminders.jsx`, next to "Recordar a transportistas") lists the pending orders with a customer, at least one quotation the customer sees (not cancelled, from a company with a vehicle, like `toJson`) and none selected, **including those whose moving day passed** ("Fecha pasada": they may still move and need a new date). `GET /backoffice-api/api/orders/customer-reminders` (`customer_reminders` in `orders.py`) gives each one's lowest total as the customer sees it (`PLATFORM_FEE` plus the agent's commission when referred), the phone of this order (`lead_phone`, else the account's), districts and the order access token. "Abrir WhatsApp" (or "Copiar mensaje" without a phone) writes the message with that price and `{origin}/acceso/<token>?r=whatsapp`, and calls `POST /api/orders/:id/customer-reminded`, which stamps `orders.customer_reminded_at` and `customer_reminder_count` (migration 045). Order: not reminded first, then upcoming by date, then past from the most recent. A past date asks for the new one instead of "elige". **Measuring it**: in the database, orders reminded vs. those that then got a selected quotation; in GA4, `reminder_opened` (`channel`, `order_id`; Vue `views/OrderAccess.vue` reads `r`), and `quotation_selected` / `order_confirmed` carry `reminder` when that browser came in through a reminder for that order in the last 14 days (`utils/reminderVisit.js`). `reminder` only shows in reports once it is registered as a custom dimension.

### Completing Half-Done Orders
"Completar órdenes" in the orders list (admins, `components/CompleteOrders.jsx`, next to the two reminders) lists the pending orders of the last 30 days that never went to carriers and have a WhatsApp: the one left in step 1's "¿Te ayudamos por WhatsApp?" modal (`lead_phone`, usually with no customer yet) or the account's. One row per number (last 9 digits), the newest order, and none for a number that later sent an order to carriers. Each row says what is missing (`missing`, `_completion_missing` in backoffice-api `orders.py`): `origin`/`destination` (step 1's requisites, map point included), `date` (null or equal to `created_date`: the column defaults to `now()`, so an order that never reached step 2 has its creation time), `comments`, `cargo_weight` for cargo, and `contact` (name and email) when there is no customer; an order missing nothing is left out. "Abrir WhatsApp" writes a message asking only for those, and calls `POST /api/orders/:id/completion-asked` (`orders.completion_asked_at`, `completion_ask_count`, migration 046), which sends it to the bottom. `GET /backoffice-api/api/orders/incomplete`. Carriers are only notified for an order with a customer, so the order detail of a pending order without one has **"Enlazar cliente"** (superadmin, `components/LinkCustomer.jsx`): name, email and WhatsApp (prefilled with `lead_phone`). backoffice-api `POST /api/orders/:id/customer` forwards to the main API's internal `POST /api/v1/order/:id/customer` (`link_order_customer` in `app/api/orders.py`), with the contact step's rules: a new email creates the customer without a password, an email with an account (matched without case) links the order to it without touching its name or phone; either way the typed number goes to `lead_phone`. 409 if the order already has a customer. No session and no email is sent: the admin then completes the order in Editar ("Guardar y enviar") and sends the customer link.

### Token Structure
JWT signed with `SECRET_KEY`, payload: `{ carrier_company_id, order_id, exp (10 days), iat }`. Same token format used throughout the quotation flow (`frontend/src/views/carrier-company/quotation.vue` decodes it).

### Carrier Note on a Quotation
`quotations.note` (migration 036, up to 500 characters, optional): what the carrier says next to the price ("voy con 2 cargadores", "se hace en 2 viajes"). The carrier writes it under the price on the quotation link (`quotation.vue`, "Comentarios para el cliente"), with a hint asking not to put prices there: the customer sees one total (with the fee), and a carrier who wrote "290 soles por viaje, estibas S/ 80 c/u" left them unsure what they would pay. `POST /api/v1/quotations` takes `note` and validates it with `parse_note` from service requests (400 if it is not text or too long, blank is null). A re-quote without `note` keeps the old one, and an empty one clears it. The customer sees it on the quotation card (`Step-three.vue`, from `toJson`) and admins in `orders/Quotations.jsx`. It is **not** in `QuotationsSchema` or the backoffice `Quotation.to_dict()`: the carrier link (`GET /api/v1/orders/details`) only carries that carrier's own quotation, with its note. That link reuses the customer view's `Order.details()`, so `order_detail` in `app/api/orders.py` also drops the customer's contact and, when another company was chosen, its price, vehicle and the payments: before, devtools showed every carrier how many quoted and at what price. A phone number written in it reaches the customer as "[número oculto]" (`without_phones` in `app/api/service_request/validation.py`, the same as the shared request page), on moves (`toJson`) and services (`_customer_quotation`): a carrier wrote "precio de instalación nos contacta al 9…". An amount written in it reaches the customer as "[monto oculto]", on moves and services too (`without_amounts`, same file: a number with a currency, or right after "precio"/"costo"; "2 cargadores" and "20 m2" stay), since the customer sees one total with the fee; the services carrier view (`CarrierView.jsx`) has the same "no pongas precios" hint as `quotation.vue`. It is stored whole; admins and the carrier itself read it as written.

## Database Migrations

Migrations live in `migrations/versions/` and follow sequential numbering (`001_`, `002_`, etc.). They run inside the `flask` container. The backoffice-api does NOT have its own migrations — all schema changes go through the main API's Alembic setup since both apps share the same database.

**Every new table must enable row level security in its own migration** (`ALTER TABLE <name> ENABLE ROW LEVEL SECURITY`, no policies). Production is a Supabase Postgres, which exposes `public` to its Data API (PostgREST); without RLS, anyone with the project's anon key could read and write the table, and Supabase's linter reports it as `rls_disabled_in_public`. Both apps connect as `postgres`, the tables' owner, which RLS does not apply to, so nothing else changes. Migration 038 did this for the tables created since 018; the older ones had it turned on by hand. Locally no table had RLS before 038.

When writing migrations for tables that may already exist (e.g., created manually or by another process), use raw SQL with `IF NOT EXISTS` instead of `op.create_table()` to avoid `DuplicateTable` errors.

## Services per Company

What a carrier company does lives in `carrier_company_service_types` ↔ `lu_service_types` (migration 022): `moving` (Mudanzas y fletes), `packing` (Embalaje), `furniture_assembly` (Armado y desarmado de muebles). Admins tick them in the backoffice company form/list; companies cannot change their own.

- **Moving is a capability, not a request flow.** Moving orders keep their own tables and flow; the `moving` type only decides who gets them. New-order notifications (`get_carrier_companies()` in `app/api/orders.py`), quotation links and the dashboard's carrier count only include active companies with `moving`. Before 022 every active company with a country got every move.
- **New companies are born with `moving`** (`create_blank_company_and_vehicle` for sign-ups; admin create when no `service_type_ids` is sent; the admin form pre-ticks it). A company without it receives no moving orders and nothing warns.
- **`requestable`** marks types asked for through the service-request form (services-web, backoffice "new request"): `packing` (`/embalaje/cotizar`) and `furniture_assembly` (`/armado/cotizar`, migration 025). The main API also requires the code in `SERVICE_TYPES` (`app/api/service_request/types.py`), which holds each service's own rules. `moving` is never requestable.
- **Furniture assembly requests**: each item has `work` (`assemble`, `disassemble`, `both`) and `pack`; packed items take materials from the **packing** catalog (`materials_from`). A `both` item needs `details.destination` (same Google Places rule as the address), checked on submit. One request, quoted by the assembler. services-web picks the service from the URL (`services-web/src/config.js`).
- `furniture_assembly` is not `lu_services.assembly`/`disassembly`: those are extras inside a moving order.
- **Painting requests** (`/pintura/cotizar`, `requestable` since migration 034): no list of things (`needs_items: False` in `SERVICE_TYPES`). Step 2 is "¿Qué quieres pintar?" (`services-web/src/pages/painting/DetailsStep.jsx`): a description in `details.description`, required unless the customer uploaded a video (they often explain it talking over the video; `check_painting_submit`, mirrored by `itemsDone` in `RequestContext.jsx`), and `details.area_m2` (wall m², required since both painting and tiles are quoted per m²; the form explains how to estimate it), plus optional answers in `details` (`area`, `size`, `paint_by`, `wall_issues`; codes in `PAINTING_*` of `types.py`, labels in services-web `config.js` and backoffice `PAINTING_LABELS` in `ServiceRequestView.jsx`). Photos and videos are optional (videos up to 250 MB for every service). Quoted by the companies with `painting` ticked; payment copy says "al terminar el trabajo" (`payDay` in `config.js`). The landing and the blog's painting box lead to the form, with WhatsApp as a second option (`formUrl` in `homeServices.ts`, `ServiceLanding`). nginx routes `/pintura/cotizar` to services-web (local and Peru confs, plus the Vite dev fallback in `services-web/vite.config.js`). The backoffice "Nuevo servicio" takes a painting request with a required description.
- **Tile installation requests** (`/porcelanato/cotizar`, code `masonry`, `requestable` and renamed "Instalación de porcelanato y cerámica" by migration 039; it was "Albañilería" since 027): porcelain and ceramic tiles only, floors and walls. Like painting, no list (`needs_items: False`): `details.description` is required unless there is a video, and `details.area_m2` always (`check_tiling_submit`), plus optional answers in `details` that move the price per m² (`material`, `surface`, `rooms`, `tile_size`, `remove_old`, `screed`, `tiles_by`; codes in `TILING_*` of `types.py`, labels in services-web `config.js` and backoffice `TILING_LABELS`). Painting and tiles share the validation (`_described_details`) and, in services-web, the `DESCRIBED` flag and `components/Choices.jsx`. The landing and the posts with `cta: "porcelanato"` lead to the form, WhatsApp second; other masonry jobs (tarrajeo, walls) still go over WhatsApp. nginx routes `/porcelanato/cotizar` to services-web (local and Peru confs, services-web `nginx.conf`, Vite dev fallback; locally the nginx conf and `services-web/vite.config.js` are baked into their images, so rebuild them).
- **Microcement requests** (`/microcemento/cotizar`, code `microcement`, in the catalog since 027 and `requestable` since migration 043). Microcement means applying it, not selling it. Like tiles, no list (`needs_items: False`): `details.description` is required unless there is a video, and `details.area_m2` always (`check_microcement_submit`, through `_check_described`), plus optional answers in `details`: `surface`, `rooms` and `base_issues` (lists), `base` (what is underneath: it goes on top of firm tiles without demolishing) and `material_by` (labour only or all-in, the main price lever); codes in `MICROCEMENT_*` of `types.py`, labels in services-web `config.js`, backoffice `MICROCEMENT_LABELS` and Next `serviceLabels.ts`. The backoffice create/edit form shares one block with tiles (`PER_M2` in `Create.jsx`), and `DESCRIBED_CODES` in `ServiceRequestView.jsx` lists the services without a list. The landing and the posts with `cta: "microcemento"` lead to the form, WhatsApp second. Its Google Maps contacts are 7 applicators, mostly microcement makers and texture shops that also apply (few have 10 reviews). nginx routes `/microcemento/cotizar` like `/porcelanato/cotizar` (rebuild the local nginx and services-web images). The landings share `frontend-react/src/components/ServiceLanding.tsx`. The WhatsApp texts and paths live in `src/lib/homeServices.ts`, which the blog also uses: a post with `cta: "pintura" | "microcemento" | "porcelanato"` ends with that service's box (its form, with WhatsApp second). The moving-quote chat agent (`ChatWidget`) only shows on moving pages. It is hidden on the other services' landings (`NON_MOVING_PATHS`, packing and furniture assembly included), on any post with a `cta`, on `Transportistas` posts and on `/transportistas`. The list is computed in `layout.tsx`. On desktop it opens by itself after 4 s, except on `/` and on blog posts (`ChatWidget.tsx`): every post has the quote widget, and the open chat covered the text and the widget on desktop, where most blog traffic comes from. Prices are "desde", per m², with the commission included, and taken from public Lima references (October 2026). Adjust them with real quotations. `/reparacion-de-departamentos` (key `departamentos` in `homeServices.ts`) is the whole-apartment repair service for landlords between tenants. It has no price table: `ServiceLanding` renders without `prices` and takes a `cta` and `areas`, and the CTA is a free technical visit, after which the exact quote is given. Its catalog row is `apartment_repair` (migration 028, not `requestable`), so admins can tick it for the company that does it. When a service gets a form, add it to `SERVICE_TYPES`, make it `requestable` and switch its landing CTA to the form, as was done for furniture assembly.

## Where a Company Works (departments)

`carrier_company_departments` (migration 037): one row per company and Peruvian department where it does its services, whatever the service. The code is the two-digit ubigeo, the same one `locate()` (backoffice-api `app/carrier_prospects.py`) reads from an order's postal code or address. Lima and Callao are one option, "Lima y Callao", stored as `15`; `07` is rejected. The list of choices is `WORK_DEPARTMENTS` in that module, served by `GET /backoffice-api/api/departments` (Lima first).

- Every company that existed got Lima. New ones are born with Lima too (landing sign-up in `create_blank_company_and_vehicle`, admin create without `department_codes`), like they are born with `moving`.
- Only admins change it (`department_codes` on the company POST/PUT, 403 for the company itself, 400 for an unknown code), from the company form ("Dónde trabaja"). The companies list shows a "Dónde trabaja" column ("Sin departamento" when empty), a department filter (`department` in the URL, shown when there is more than one) and searches by department name. The "Transportistas" card of the order detail shows it in small type next to each name (`departments` in `quotation-links`).
- **Nothing routes orders by it yet**: new-order notifications still go to every active company with `moving`. The next step is for `get_carrier_companies()` (`app/api/orders.py`) to keep only the companies that work in the order's origin or destination department, which needs `locate()` in the main API and a mirror model there.

## Customer Quotations Page (service requests)

Packing and furniture assembly customers have no account, so they see and pick quotations on a page keyed by the request's `public_id` (32 random hex chars, the same credential the form uses; no expiring token): `<form_path>/cotizaciones/<public_id>` in services-web (`pages/Quotations.jsx`), e.g. `/armado/cotizar/cotizaciones/…`. `form_path` lives in `SERVICE_TYPES`, mirrored by `FORM_PATHS` in `backoffice-api/app/api/service_requests.py`.

- **API** (main, public): `GET /api/v1/service-requests/<public_id>/quotations` (404 for a draft) shows each carrier's name and note, plus `total_amount` with `PLATFORM_FEE` (the frozen one once selected) split into `reservation_amount` (Chalán's share) and `on_site_amount` (the carrier's price). It never shows the carrier's phone. `POST /api/v1/service-requests/<public_id>/choose` `{quotation_id, operation_number}` selects with `selected_by_admin_id = NULL`. Choosing the same one again does nothing, or corrects a pending number. Choosing another once one is selected is 409 (`select_quotation(..., replace=False)`). Admins can still change it from the backoffice, which cancels the pending reservation of the old one.
- **Payment, like a move's `PaymentConfirmationModal.vue`** (services-web `components/ConfirmModal.jsx`): with `YAPE_RESERVATION_REQUIRED=true` (the same switch as moves, and the page reads it from the API), choosing means yaping the reservation and reporting the operation number. That creates a `pending` row in `service_request_payments` (migration 026). It is a separate table from `payments`, whose `quotation_id` points to moving quotations. The carrier is **not** told until an admin confirms the yapeo in the request detail (backoffice-api `POST /api/service-requests/:id/payments/:pid` `{status: paid|cancelled}` → main API internal route). `paid` tells the carrier (email + WhatsApp) and the customer (WhatsApp). `cancelled` ("No llegó") frees a customer-made selection so they can choose again. Without the switch, choosing confirms at once and the total is paid in cash to the carrier. `app/api/operation_numbers.py` keeps an operation number from being reused across moves **and** service requests.
- **Contacts, like a scheduled move**: once the job is confirmed (`confirmed_quotation()`: the reservation is paid, or there is none), the customer page shows the chosen carrier's WhatsApp (`carrier_contact`). The carrier gets the customer's WhatsApp and address in the "¡Te eligieron!" email, and in its view (`customer_contact`, state `selected_mine`). While the yapeo is being checked, the carrier view says `selected_pending` and shows no contact. The email tells the carrier how much to collect on site: its own price when the reservation was paid, the total otherwise.
- **Customer name and email** (migration 041, `service_requests.customer_name` and `customer_email`): the form's last step (services-web `ContactStep.jsx`) asks the name (required, up to 60) and the email (optional), next to the WhatsApp. Submit and the backoffice create/edit require the name (`validate_customer_name`/`validate_customer_email` in `app/api/service_request/validation.py`; 400 without it). Requests from before have none. The chosen carrier sees the name with the WhatsApp (`customer_contact.name`, "¡Te eligieron!" email), admins in the detail, the list and the message copied for the customer. Nothing is emailed to the customer yet.
- **Reviews** (migration 042): the same `reviews` table and page as moves (`/reviews/submit/<token>`, Next `TokenReviewForm.tsx`, which ends with the Google review button), with `service_request_id` instead of `order_id` + `customer_id` (both nullable now, a check requires one or the other, one review per request). The token is a JWT with `service_request_id` and `carrier_company_id`, 30 days, made by `app/api/service_request/reviews.py` and backoffice-api `app/service_reviews.py` (change both together); it only exists for a `completed` request, and stops working if it is no longer completed or another company is chosen. The admin copies "Link de reseña" from the Cliente card of the detail (`review_path`), which then shows the review (`review`, read with SQL: no model in backoffice-api). The customer page shows "Calificar a …" once completed (`review_path`, `reviewed`) and each quotation's rating (`rating`: average and count over moves and services). The review page names an inactive contact by `contact_name`. `/reviews` and the sitemap list only active companies with at least one review (`/reviews/companies`), and the Next page of one without reviews is 404, so carriers can't count the others there (the API still answers it, with `total_reviews` 0, for the quotation card's "Nuevo en Chalán"). `/reviews/company/<id>` returns only what the public page shows (name, description, cover, rating, reviews): never the phone, email, RUC, address or `contact_name`, and the page's JSON-LD (one `MovingCompany` with its `review` list inside) has no contact either. Inactive companies have no public page (`/reviews/company/<id>` is 404) and are left out of `/reviews/recent`, so a contact's business name never shows; its rating still shows on the customer page. A service reviewer is shown as "Carla R." from `customer_name`.
- **Review links are checked, not just signed** (`_read_review_token` in `app/api/reviews.py`): every JWT of both apps shares `SECRET_KEY`, and the carriers' quotation links carry `order_id`/`service_request_id` and `carrier_company_id` too, so a carrier could review itself. Review tokens carry `purpose: review` (service ones always; move ones since October 2026, and older move links without it still work only if their `customer_id` owns the order, the order is completed and that company's quotation is the selected one). `POST /api/v1/reviews` without a token is 400: it used to accept any `order_id` + `carrier_company_id`.
- **WhatsApp templates** (each skipped while its variable is unset; outside production, `FLASK_ENV` other than `prod`, the main API logs and skips every WhatsApp, `whatsapp_enabled()` in `app/api/whatsapp.py`, because local and e2e share the Twilio credentials and the test carrier has a real phone; the backoffice chat still sends):

  | Variable | Sent | Variables |
  |----------|------|-----------|
  | `TWILIO_TEMPLATE_SERVICE_CUSTOMER` | to the customer, on the first quotation | `{1}` service, `{2}` page URL |
  | `TWILIO_TEMPLATE_SERVICE_CHOSEN_ADMIN` | to the admin, when the customer chooses | `{1}` carrier, `{2}` backoffice URL |
  | `TWILIO_TEMPLATE_SERVICE_CHOSEN_CARRIER` | to the carrier, when the job is confirmed | `{1}` service, `{2}` carrier link |
  | `TWILIO_TEMPLATE_SERVICE_CONFIRMED_CUSTOMER` | to the customer, when an admin confirms the yapeo | `{1}` service, `{2}` page URL |

  Emails: `service_request_chosen_admin` (with the yapeo to verify) and `service_request_chosen_carrier`.
- **Payments the admin records** (migration 032, `service_request_payments.concept`): `reservation` (customer → Chalán, Yape; every row from before) and `carrier_cash` (customer → carrier, on site). The reservation is always required to schedule a job, also when an admin picked the quotation. When nobody reported it on the page (admin pick, deal closed over WhatsApp), the admin registers it from the detail. The operation number is optional. It is born paid and tells the carrier and the customer, like confirming a yapeo, unless the admin unticks "Avisar" (`notify: false`, for a job already done) (`POST /api/service-requests/:id/reservation` → main API `register_reservation`). Once the reservation is paid, "Registrar saldo pagado" records the carrier's price as `carrier_cash` (`POST|DELETE /api/service-requests/:id/carrier-cash`, no notice). That puts the request in `completed`, and the selection can no longer change (409). Everything that reads the reservation filters by `concept`.
- **Statuses, the same as orders** (migration 033, text in `service_requests.status`, constants in `app/api/service_request/statuses.py`): `pending` from the first form step until the job is firm, `in_progress` once the reservation is paid (or the customer chose without one, switch off), `completed` once the carrier cash is recorded, `cancelled`. A draft is a `pending` without `submitted_at` (`is_draft`): carriers were not told, the customer can still edit it, and its customer page is 404. The main API keeps the status in step with the selection and the payments (`sync_status` in `quotations.py`, called by every function that changes them); an admin pick without a reservation stays `pending`. A superadmin can also set the status by hand from the detail header (`PATCH /api/service-requests/:id {status}`; admins can only cancel, a draft can only be cancelled), for what happened outside the system; the next selection or payment change recalculates it. The backoffice list has the orders list's filters (default Pendiente) and status icons; who has quotations or a deposit is read from the Cotizaciones and Adelanto columns, the Creación column is `created_date` like orders, and a draft says "Incompleto" under it.
- **Session recordings**: services-web loads Inspectlet (same account as Next and Vue, `initInspectlet` in `src/analytics.js`, production only) and Clarity, and tags both with `service` and `service_request_id` (the backoffice "Servicio #N"), from the form and the quotations page. The API returns `id` for that (create, GET, quotations). Never tag the `public_id`: it opens the request.
- **GA4 funnel**: `service_cta_click` (Next, `components/ServiceCtaTracker.tsx`: one click listener in the layout for every link to a service form or a service WhatsApp; `service`, `channel` form/whatsapp, `placement` nav/footer/home/blog/landing/other; a WhatsApp with no recognizable service, like moving, sends nothing) → services-web `service_request_step_view` (`step` address/items/contact/sent), `service_request_started`, `service_request_submitted`, plus `service_request_blocked` (`step`, `missing_field`: the field, or `network`/`server` when saving failed; also an Inspectlet/Clarity label `<step>_blocked:<field>`). The quotations page (`service_quotations_view`, `service_quotation_chosen`) is usually opened days later from WhatsApp, often on another device: read it as its own funnel. `service` is the `lu_service_types` code (`code` in `homeServices.ts`).
- **Google Maps contacts** (`components/ServiceProspects.jsx`, on the request detail while nothing is selected): businesses that do the service but are not on the platform, for when no company takes it. A hand-made list per service code in `backoffice-api/app/resources/service_prospects.json` (armadores for `furniture_assembly`, 10 with 10+ reviews; contractors and albañiles for `masonry`, 7, since Maps has almost no tile installers with reviews; 7 applicators for `microcement`; October 2026; mobile numbers only, since they are written to on WhatsApp), served by `GET /backoffice-api/api/service-prospects/<code>` (admin). Each has "Copiar número" (they are written to from Chalán's WhatsApp), and "Copiar mensaje" copies an invitation with the request's date, district, destination district and items (or, for painting and tiles, the description and answers), without the customer's name, phone or street.
- **Carrier list** (`/my-service-requests`, "Servicios" in the carrier's menu when the company does any service besides moving; `pages/service-requests/CarrierList.jsx`): the notice's link expires in 10 days, so backoffice-api `GET /api/carrier/service-requests` (carrier role) lists the sent requests of the company's services (same country rule as the notices), leaving out cancelled ones and those given to another company, each with its own quote or decline and a fresh `carrier_path` to the same carrier view. An inactive company gets an empty list.
- **Carrier link shows the district only** until the job is theirs (`_district_only` in backoffice-api `service_requests.py`): the link reaches every company of the service, so street, interior and map link (also the destination's) are null and `address_hidden` is true until `selected_mine`, when the chosen company also gets the customer's WhatsApp. The district comes first from Google's address text (the part with the postal code), then `neighborhood`, then the city: `district_of` in backoffice-api `app/address.py`, mirrored by the main API's `app/api/address.py` (share page, emails, customer page) and `backoffice/src/lib/district.js` (the copied WhatsApp texts). Until October 2026 the services form saved Google's `sublocality_level_1` as `neighborhood`, which in Lima is the urbanización ("Fund Oyague" in Jesús María); it now saves `locality`, the district, and old rows are read right through the address text. Moving orders in the backoffice follow the same rule for carriers (`_address_payload` and `_is_theirs` in `orders.py`): district only until their quotation is selected **and** the order is in progress or completed; before, they saw the street without its number. The Vue quotation link for moves keeps the full address and map link on purpose (decided October 2026): carriers price the route from it.
- **Quotes of contacts outside the platform** (services only): when a Google Maps contact (or anyone) answers over WhatsApp with a price, the admin loads it from the request detail ("Agregar su cotización" on each contact, "+ Agregar la cotización de otro contacto" for anyone else, also on services without a contacts list) with a comment the customer sees, like a company's note. backoffice-api `POST /api/service-requests/:id/contact-quotations` `{name, phone, amount, note}` finds the company by the last 9 digits of its phone or creates it **inactive** (no other requests or notices) with the request's service ticked, Lima, and `rfc`/`email`/`address` as `''` (NOT NULL in Postgres, SQLite tests do not catch it); then it forwards to the same main API route a company link uses, so the customer page, choosing, payments and contacts work unchanged. Loading it again corrects the price. The amount is the contact's own price; the fee goes on top as always. The customer never sees the business name (they would look it up on Google and hire it directly): the form asks for the name of the person who answers, stored in `carrier_company.contact_name` (migration 040), which the customer's quotations page and contact card show instead of `name` when set (`_public_name` in `app/api/service_requests.py`); the admin quotation list shows it next to the business. Registered companies keep it empty and are shown by their name.
- **Media without the public_id, and a link to share it**: the public_id opens the customer's quotations page, and media used to be stored under `service-requests/<public_id>/`, so every photo URL (seen by every company, copied into WhatsApp) carried it. New uploads go to `service-requests/<HMAC of the public_id with SECRET_KEY>/` (`media_prefix` in `app/api/service_request/media_share.py`; registering still accepts the old folder for uploads signed before). `flask move-service-media --apply` (run in the `flask-api` container) copies the old files to the new folder, updates their URL and deletes the originals; without `--apply` it only counts. To send a request over WhatsApp to whoever will quote, `chalan.pe/v/<token>` (Next, `app/v/[token]/page.tsx`, noindex, no chat) shows the service, district (and destination district), date, what to do (items with their work, or the description and answers; labels in `src/lib/serviceLabels.ts`) and the files, from the public `GET /api/v1/service-media/<token>` (itsdangerous, salt `service-media`, 30 days; backoffice-api `app/service_media.py` makes the same token). Phone numbers the customer wrote in free text come masked. The admin detail returns `share_path` for any sent request: "Link del pedido para cotizar" in the Cliente card, and the Google Maps contacts message becomes short (service, district, date, the link).
- **Share previews**: WhatsApp does not run JavaScript, so the services-web build writes one HTML per form (`embalaje.html`, `armado.html`, `pintura.html`, `porcelanato.html`, `microcemento.html`) with its title, description and Open Graph tags from `src/share.js` (`sharePages` in `vite.config.js`), and services-web `nginx.conf` serves each under its prefix. A new form needs its entry there and its location.
- **Naming**: the backoffice screens call them "Servicios" ("Servicio #12", "+ Nuevo servicio", statuses in the masculine). The code, routes, API and tables keep `service_requests`, and the carrier view and emails still say "solicitud". Don't rename the code to match.
- **Backoffice**: the request detail has "Copiar link del cliente" (`customer_quotations_path`), tags a quotation "Elegida por el cliente" (`selected_by_customer`), and a "Pagos" card: the reservations with "Confirmar yapeo" / "No llegó", plus registering the reservation and the balance. The list (`pages/service-requests/List.jsx`) mirrors the orders list: status filters with icons, the customer's WhatsApp, a Precio column (the chosen quotation's carrier price, else "desde" the lowest), an Adelanto column (`deposit`), and bulk cancel (`POST /api/service-requests/bulk-cancel`, admin; it skips requests with a selected quotation).

## Editing a Service Request (backoffice)

Admins correct a sent request (what the customer said over WhatsApp, a wrong address) from "Editar" in its detail: `/service-requests/:id/edit`, the same page as "Nuevo servicio" (`pages/service-requests/Create.jsx`) loaded with the saved data.

- **Rules**: the whole request is replaced with the manual creation's rules (`_manual_fields` in `app/api/service_requests.py`: Maps link and district, items with catalog materials, details, WhatsApp, `check_submit`). The service type does not change. A saved day that already passed can stay; a new one must be from today on. **Nobody is told**: if the change matters, the admin resends the link to the carriers who quoted.
- **When**: until a quotation is selected (the carrier priced what it read): 409 from `_find_editable`, which locks the row. Cancelled requests can be edited.
- **Drafts** (what a customer left halfway, "Incompleto"): the detail says "Completar" instead of "Editar". Saving completes it with the same rules and sends it (`submitted_at`), so the customer's form can no longer change it; its date must be from today on. The page has "Avisar a los transportistas al enviar" (ticked), and calls `notify-carriers` after the photos are up. Deleting a photo of a draft skips the submit rules (they are checked when it is sent).
- **Endpoints**: backoffice-api `PUT /api/service-requests/:id` (admin) → main API `PUT /api/v1/service-requests/:id/manual` (internal).
- **Photos and videos** (create and edit, `components/ServiceRequestMediaField.jsx`, `lib/serviceRequestMedia.js`): new ones are queued and uploaded on save, one at a time, straight to S3 with the customer form's rules (10 per request, photos 10 MB, shrunk in the browser to JPEG ≤2000 px; videos 250 MB). Saved ones are deleted at once. backoffice-api `POST /api/service-requests/:id/media/presign`, `POST .../media` `{storage_key}`, `DELETE .../media/:mid` forward to the same internal paths under `/api/v1/`, with the edit rule above. Same keys as the customer's (`service-requests/<public_id>/…`, public under the bucket policy). A painting explained only in its video cannot lose that video (400). On create with "Avisar" and queued files, the request is created without notifying, the files go up, then `notify-carriers` runs, so the carriers see them. Uploads fail at the S3 step from `http://localhost:5173` (CORS), like the other backoffice uploads.

## Carriers Outside Lima (Google Maps prospects)

All the carriers on the platform are in Lima. For a pending order that is not in Lima, the order detail (admins only) shows `components/NearbyCarriers.jsx`: transport businesses of that department taken from Google Maps, filtered by what the order carries, each with a WhatsApp button (a prefilled invitation to quote, with no customer data). They are cold contacts, not companies: nothing is written to the database.

- **Data**: `backoffice-api/app/resources/carrier_prospects.json`, built by `backoffice-api/scripts/build_carrier_prospects.py` from the `automajob-contacts` repo (Apify, `data/raw`). Run it with that repo's venv: `~/Sites/automajob-contacts/.venv/bin/python backoffice-api/scripts/build_carrier_prospects.py --source ~/Sites/automajob-contacts`, then commit the JSON (it ships inside the backoffice-api image). It reuses that repo's own cleanup (closed businesses, non-transport categories, mobile phones only, dedupe by `placeId`) and adds coordinates. Only the `transporte` vertical.
- **Where an order is**: `app/carrier_prospects.py` (`locate`) takes the department from the postal code (the first two digits, same as the ubigeo; read from `zip_code` or from the end of Google's `street`), else from `city`/`state`, else from the last place name in the address text (`Av. Arequipa` is a street in Lima). Lima and Callao (`15`, `07`) count as Lima: no card. An address that cannot be placed shows a one-line note.
- **What it carries**: `detect_needs` reads `orders.comments` for words (`vehiculos`: camioneta, moto, auto...; `construccion`: cemento, fierros...; `carga`; default `mudanza`). The card preselects that filter and shows the others as chips with counts. Matching uses the `type` that automajob gave each business (`mudanza`, `vehiculos`, `carga`, from its name and Google category), plus hints in its name. The type rules are coarse: motos and construction material have little signal until the scraping keywords include them.
- **Order**: exact type first, then by distance if the order has coordinates, else by automajob's score (rating weighted by reviews).
- **API**: `GET /backoffice-api/api/orders/:id/nearby-carriers?need=&end=` (admin/superadmin). `end` is `origin` or `destination` (the first one outside Lima by default).
- **"Copiar datos de la mudanza"** on the card copies, for whoever agrees to quote: date, load type, origin and destination (street, floor, elevator, parking), the things (`comments`) and the services. Never the customer's name or phone. Built by `moveSummary` in `pages/orders/Detail.jsx`.
- **Coordinates and city on new orders** (migration 029): the Vue order form saves `city`, `state`, `latitude` and `longitude` from the Google place (`from_*` / `to_*`). The main API (`app/api/order/order.py`) drops a coordinate that is not a number in range. Orders from before this only have the written address, which is why `locate` falls back to the postal code and the text. The store state must list these keys or editing an order would send nulls and wipe them (`store/index.js`, also when loading an order).

## Carrier Declines

A carrier can say "I can't do this one" with a reason, instead of just not answering.

- **Tables**: `order_carrier_declines` and `service_request_carrier_declines` (migration 020), one row per carrier per order/request. Deliberately **not** a quotation status: `quotations.amount` is NOT NULL and every quotation query treats a non-cancelled row as a real offer.
- **Reasons**: `date_unavailable`, `zone`, `vehicle`, `budget`, `other` (note required). Validated in `app/api/carrier_declines.py`, where all the write logic lives.
- **Rules**: only while the order is pending / the request is open; a selected quotation cannot be declined (409). Declining withdraws the carrier's live quotation (cancelled for orders, deleted for service requests). Quoting afterwards, or `DELETE`, removes the decline.
- **Endpoints**: main API `POST|DELETE /api/v1/order/:id/decline` (carrier link token, or internal token + `carrier_company_id`) and `POST|DELETE /api/v1/service-requests/:id/decline` (internal only). Backoffice-api forwards from `POST|DELETE /api/orders/:id/decline` (carrier role) and `/api/public/service-requests/:token/decline`.
- **UI**: Vue `quotation.vue` and backoffice `components/DeclinePanel.jsx` (order detail, service request carrier view). The carrier's order list hides declined orders unless `?declined=1`. Admins see who declined in `orders/Quotations.jsx` and the service request detail. No email is sent.

## Carrier Rates and Availability

Toward quoting a move for a carrier that has not answered in 20 minutes (planned November 2026; nothing quotes automatically yet). Migration 047, both tables per company (`vehicle_id` NULL); per vehicle comes later as rows in the same tables. Logic in backoffice-api `app/carrier_rates.py`, routes in `app/api/carrier_rates.py` (the company itself or an admin; 403 for another company).

- **Rates** (`carrier_rates`, numeric soles; backoffice `pages/carrier-companies/Rates.jsx`, "Tarifas"): in Lima a move is `base_fee` + `per_m3` × m³ + `per_loader` × loaders + `per_floor` × floors without elevator (both addresses); outside Lima `per_km_outside_lima` × km is added; `weekend_surcharge_percent` goes on everything and `minimum_fare` is the floor. Rounded to soles (`quotations.amount` is an integer), and it is the carrier's own price: the fee goes on top. Why m³ and not km: in 367 production quotations km explained nothing inside Lima and m³ did. `max_m3`/`max_km` cap what may be quoted for it. The page has a simulator (`POST .../rates/simulate`, nothing saved) with example moves. The older per-vehicle fee columns (`vehicles.charge_per_kilometer`, `charge_per_floor`, `driver_fee`, `loader_fee`, `loaders_quantity`) were never used to price anything and are out of the code and the vehicle form (only a test company and an inactive one had values); drop them with a migration in a deploy after that one, since the migration runs before the old code stops.
- **Consent** (`auto_quote`): needs `base_fee` and `per_m3`, and records who gave it and when (`auto_quote_authorized_by`: the company's user or an admin loading what it said over WhatsApp); withdrawing it clears both.
- **Availability** (`carrier_availability`, "Disponibilidad", `Availability.jsx`): available unless marked. A `weekday` row (0 = Monday) blocks that day every week; a `day` row overrides the week for that date (`blocked` NULL opens it). `blocked` is the part that is not available: `day`, `am`, `pm` (afternoon starts at 13:00). A day equal to its week is not stored, so changing the week carries it. Only today to 400 days ahead can be changed. `moves_per_day` (in `carrier_rates`) is how many moves fit a day: days with a selected quotation of the company in a non-cancelled order count as booked (read from the orders, not stored), and a day with that many is full.
- **Used by**: "Recordar a transportistas" leaves out orders on a blocked part of the day or a full day (`unavailable_pairs`).
- **The formula lives twice**: `backoffice-api/app/rates_formula.py` (the simulator) and `app/api/rates_formula.py` (the main API, which will quote). Both are plain Python with no app imports, and `tests/test_auto_quote.py` checks they are identical. Change both together.

### Quoting silently (migration 048)

Two weeks of computing without showing it before quoting for anyone. `flask auto-quote` (main API, `app/api/auto_quote.py`; a cron on the server runs it every 2 minutes) looks at pending orders sent to carriers 20 minutes to 2 days ago that it has not looked at since their last notice (`orders.auto_quote_checked_at` older than `carrier_notified_at`, so an order the customer changed and was sent again is computed again).

- **Scope** (Carlos, November 2026): moves and items (`load_type` NULL, `moving`, `items`) with both addresses in Lima Metropolitana or Callao: by coordinates (`LIMA_BOUNDS`), else by district name in the address. Otherwise `orders.auto_quote_skip` says why (`load_type`, `outside_lima`, `no_items`, `no_rates`, `no_date`).
- **m³** (`app/api/order/volume.py`): each part of each line of `orders.comments` is looked up in a catalog of typical volumes with Peruvian synonyms (the longest synonym wins), measures written in the line are used, a total the customer wrote ("28 m3") wins, an unrecognized short part counts as 0.3 m³ and a sentence as nothing; the sum gets +25%. Stored in `orders.estimated_volume_m3` and `volume_breakdown`. Lists fall short (people write the big things), so it tends to be low.
- **Per company** with complete rates among those that get the order (`get_carrier_companies`), whether it answered or authorized or not, since that is what lets it be compared: one `auto_quote_estimates` row per notice with `amount` (its own price, no fee) or `skip_reason`: `declined`, `unavailable` (blocked part of the day, or `moves_per_day` already taken by selected quotations), `too_big` (`max_m3`), `too_far` (`max_km`, straight line × 1.35). Floors are `floor_number - 1` per address without elevator; weekend is Saturday and Sunday.
- **Backoffice** (admins): the order detail's "Con sus tarifas (en prueba)" (`components/AutoQuoteEstimates.jsx`, `GET /api/orders/:id/auto-quote`) shows the m³ and how it was read, and each company's estimate next to its real quotation (the one made or changed after that notice and before the next). The Rates page shows "Cuánto acierta" (`GET /api/carrier-companies/:id/auto-quote-accuracy`): ready to quote for once 10 orders are compared and 75% land within ±25% (`TOLERANCE`, `READY_*` in backoffice-api `api/auto_quote.py`).
- **When turned on** (not built): only companies with `auto_quote` and ready, and an automatic quotation must say so in the backoffice and in the "customer chose" notices, because Carlos confirms the carrier's availability by hand before taking the reservation.

## Deleting Vehicles

Admins and superadmins can delete a vehicle from either vehicle list (`components/DeleteVehicleButton.jsx`, two-click confirm); carriers can only deactivate. `DELETE /backoffice-api/api/carrier-companies/:id/vehicles/:vid` hard-deletes, but answers 409 when:

- a quotation points to it through `quotations.vehicle_id` (rarely set, but it has a foreign key), or
- it is the last vehicle of a company that has quotations.

Quotations don't store which vehicle goes: the main API shows `carrier_company.vehicles[0]` (active or not) in the customer's quotation list (`app/api/quotation/quotation.py`) and the order detail (`app/api/order/order.py`). A company left with no vehicles has its quotations silently dropped from the customer's list, even a selected one.

## Vehicle Data (SUNARP card)

Migration 023 added the "Datos del Vehículo" block of the Peruvian Tarjeta de Identificación Vehicular to `vehicles`, all nullable and edited from the backoffice vehicle form (`backoffice/src/pages/vehicles/Form.jsx`), validated in `backoffice-api/app/api/vehicles.py` (`_parse_card_fields`).

- **Weights are in tons with three decimals**, exactly as the card prints them (`gross_weight_tons`, `net_weight_tons`, `payload_tons`). Caps (60 t, 25 m) reject kg or cm typed into the wrong field.
- `vehicle_*_m` are the outside dimensions from the card; `box_*_m` are the cargo box, given by the carrier. Don't mix them.
- `body_type` is one of `furgon`, `baranda`, `plataforma`, `pick_up`, `otro`: what the vehicle was **registered** as. It is not shown to customers, because trucks get rebodied (the first one filled in is a registered furgón with open slatted sides).
- `cargo_cover` (migration 024) is what customers see: `cerrada`, `toldo` or `abierta`, set from photos of the truck, not from the card. No cold chain value on purpose.
- `category`, `serial_number`, `registry_entry` are for checking the vehicle against SUNARP, not shown to customers.
- The old free-text `weight`, `width`, `height`, `length` columns hold mixed units and meanings in production ("2TN", "3.4", "172CM", "6.15"), so nothing was migrated from them. The quotation card (Vue `Step-three.vue`) shows `cargo_cover`, year and `payload_tons` (in kg), and falls back to the raw `weight` text; the backoffice form shows the old values as a reference. Drop them once every active vehicle has card data.

## Company Without Reviews (quotation card)

The moving quotation card (`Step-three.vue`) never makes up stars: a company without reviews shows "Nuevo en Chalán" (it used to show five empty stars and "0 Evaluaciones"), and stars only show once it has one. Showing 5 stars to everyone new was considered and rejected: misleading advertising (Indecopi), a first 4-star review would look like a drop, and the tie-break by rating would put an invented 5.0 above real reviews. If the reviews request fails, neither shows. Next to it, when true: "✓ Documentos verificados" (`documents_verified`: the company uploaded DNI/CE, license and vehicle card; nothing records that an admin checked them, so it relies on reviewing the documents before activating a company) and "N mudanzas hechas con Chalán" (`completed_moves`: its selected quotations in completed orders). Both come from `toJson` (`_trust` in `app/api/quotation/quotation.py`). The services quotations page already hides the rating without reviews.

## Vehicle Photo (carrier page)

Customers judge the truck by the photo: the old fixed placeholder (a big Peterbilt) made some think that was what they would get. Each vehicle has one photo in `vehicles.picture`, shown on the public carrier page (`frontend/src/components/carrierCompany/CarrierCompany.vue`, `/carrier-company/<id>`): one big, the rest of the company's active vehicles with a photo as thumbnails, each with brand, model, year, cargo cover and payload. No photo shows a neutral box ("Todavía no hay foto de sus vehículos"), never a stock truck.

- **Upload**: the backoffice vehicle edit page (`components/VehiclePhoto.jsx`, admins and the company itself; on create it says to upload after saving). The browser shrinks it to a JPEG ≤1600 px and sends it straight to S3 with a presigned POST under `vehicles/<vehicle_id>/photo-<uuid>.<ext>` (JPG/PNG/WEBP, 10 MB). backoffice-api `POST /api/carrier-companies/:id/vehicles/:vid/photo/presign`, `POST .../photo` `{storage_key}` and `DELETE .../photo` check the company (403/404) and forward with the internal token to the same paths under the main API `/api/v1/` (`app/api/vehicle_photos.py`), which re-checks the file with `head`, writes `picture` and deletes the previous file when it was ours (a hand-typed URL from before is replaced but not deleted). The vehicle form no longer sends `picture` on save, so a stale value cannot overwrite an upload.
- **Public bucket path**: `vehicles/*` has to be in the bucket policy (public read, like `orders/*`) and in the IAM user `chalan-s3-app` policy (Put/Get/Delete).
- `GET /api/v1/carrier-company/<id>` (public) returns only active vehicles, oldest first, with `id`, `brand`, `model`, `description`, `picture`, `cargo_cover`, `manufacture_year`, `payload_tons`: no plates.

## Carrier Documents (identity validation)

Carriers who register from the landing (`CarrierSignupForm`) go straight to a documents step (`components/CarrierDocumentsUpload.tsx`): DNI or CE, driver's license and the vehicle's tarjeta de propiedad, photo or PDF, up to 4 files each. The copy explains they are only for validating the account and only the Chalán team sees them. The register response carries `documents_token`, and the carrier also gets the link by email (`email/carrier_documents_request`), for whoever doesn't have the documents at hand. The backoffice `/register` links to the same page.

- **Link**: `{SITE_URL}/transportistas/documentos/<token>` (Next.js page, noindex, no chat widget). The token is the company id signed by itsdangerous (salt `carrier-documents`, 30 days), made in `backoffice-api/app/carrier_documents.py` and read in `app/api/carrier_documents.py`: change both together.
- **Main API** (public with the token): `GET /api/v1/carrier-documents/<token>`, `POST .../presign` `{doc_type, content_type, size_bytes}`, `POST /api/v1/carrier-documents/<token>` `{storage_key}`, `DELETE .../<id>` (only while the company is inactive). Files go browser → S3 (presigned POST) under `carrier-documents/<company_id>/<doc_type>-<uuid>.<ext>`; jpeg/png/webp/pdf, 10 MB. The landing converts photos to JPEG ≤2400 px first. `doc_type` comes from the key, so a key cannot be registered as another type or for another company. When the three types are in for the first time, `ADMIN_MAIL` gets `email/carrier_documents_complete`.
- **One tarjeta de propiedad per vehicle** (`vehicle_id`, SET NULL if the vehicle is deleted): the key carries the vehicle too, `vehicle_card-v<vehicle_id>-<uuid>.<ext>`, so a card cannot be registered on another vehicle. The card takes 2 files per vehicle (front and back, or the electronic card's PDF); DNI and license take 4 per company (they can be of more than one person). With the link, the carrier uploads the card of the company's **first** vehicle (sign-up creates one; `card_vehicle_id` and `max_files` in the GET tell the page which cards and how many); a key without a vehicle (from before) also goes to the first one. Admins upload the card of any vehicle from the vehicle edit page, and delete any document even once the company is active, through internal routes: `POST /api/v1/carrier-companies/<id>/vehicles/<vid>/card/presign`, `POST .../card` `{storage_key}` (no "complete" email: the team uploaded it) and `DELETE /api/v1/carrier-companies/<id>/documents/<doc_id>`, forwarded by backoffice-api from the same paths under `/api/` (admin/superadmin, 404 for a vehicle of another company).
- **Private files**: the bucket policy of `chalan-orders-images` makes only `orders/*` and `service-requests/*` public (ACLs are disabled), so `carrier-documents/*` is private. Never add it to that policy. The backoffice reads them through the internal `GET /api/v1/carrier-companies/<id>/documents` (signed GET URLs, 1 hour), forwarded by backoffice-api `GET /api/carrier-companies/:id/documents` (admin/superadmin, adds `upload_token`). The IAM user `chalan-s3-app` needs `carrier-documents/*` in its policy (Put/Get/Delete), like the other two prefixes.
- **CORS** of the bucket allows POST from `https://chalan.pe`, `https://www.chalan.pe`, `http://localhost` and `http://localhost:5174`: test uploads locally at `http://localhost/transportistas`, not `local.chalan.mx`.
- **Backoffice** (`components/CarrierDocuments.jsx`): the company edit page shows DNI and license, the tarjeta de propiedad grouped by vehicle (plate, "sin tarjeta", plus cards left without a vehicle), and "Link para subir documentos"; the vehicle edit page shows that vehicle's card next to the card fields (sticky on wide screens) for admins, with "+ Subir tarjeta de propiedad" and "Borrar". The S3 step of an upload fails from `http://localhost:5173` (not in the bucket's CORS); it works in production.
- Table `carrier_documents` (migration 031). GA4: `carrier_sign_up` (`service`: `moving`, or the professional's service code), `carrier_document_uploaded` (`doc_type`), `carrier_documents_complete`.

## Professionals Sign-up (services)

Painters, microcement applicators, tile installers, furniture assemblers and packers sign up from `/profesionales/<slug>` (Next `app/profesionales/[oficio]/page.tsx`, one page per trade from `src/lib/professionals.ts`, plus the index `/profesionales`, which also links `/transportistas`). Each customer service landing (`ServiceLanding`, matched by `customerPath`) and the footer link to them; the chat is hidden there and the content group is `professionals`.

- **Sign-up**: the same `CarrierSignupForm`, with `service`. backoffice-api `POST /auth/register` takes `service_code` (400 unless it is an active `requestable` type, so never `moving`): the company is born with only that service, Lima and **no vehicle** (`create_blank_company_and_vehicle(service_type=...)`), so it gets that service's requests once active and no moving orders. The admin email says "Nuevo profesional registrado: <servicio>" and the documents email asks for the professional's documents.
- **Documents**: a company whose services do not include `moving` (and has at least one) uploads `identity` and `work_photo` (3 to 8 photos of its work, up to 8 files) instead of license and vehicle card (`required_types` in `app/api/carrier_documents.py`; a company without services is read as a mover). The documents GET returns `required`, which the upload page (`CarrierDocumentsUpload.tsx`) and the backoffice card (`CarrierDocuments.jsx`) follow; presign refuses other types. The "complete" email fires when the required set is in. `DOC_TYPES` stays the movers' three, which is what the quotation card's "Documentos verificados" counts.
- The copy promises no number of requests and says it is not a job: it is for people who work on their own.
