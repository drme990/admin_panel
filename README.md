# Admin Panel (admin_panel)

Central operations dashboard for managing the full Ghadaq + Manasik platform.

## What This App Does

- Authenticates admins and enforces page-level permissions.
- Manages products, orders, customers, payments, coupons, countries, referrals, and admin users.
- Controls storefront appearance and booking blocked dates.
- Monitors exchange-rate updates, analytics, and activity logs.
- Uploads product media (images and videos) through backend APIs.

## Architecture

- Framework: Next.js App Router + TypeScript + Tailwind CSS.
- i18n: Arabic/English via next-intl.
- API pattern:
- Preferred for large uploads: direct backend API calls with NEXT_PUBLIC_BACKEND_URL.
- Fallback: Next.js rewrites from /api/_ to apps_backend /api/admin/_.
- Auth model: cookie-based admin session validated by backend.

Request flow:

- Browser -> admin_panel -> apps_backend -> MongoDB + external services

## Feature Inventory

### Authentication and Access

- Admin login/logout and current session resolution.
- Role support (admin / super_admin).
- Page-level permission gating based on allowedPages.

### Dashboard and Analytics

- KPI counters (orders, products, users, countries).
- Revenue and operational charts.
- Orders by status/country/weekday and payment split views.

### Product Management

- Full CRUD for products.
- Product ordering/reordering.
- Product media management:
- Image upload/delete.
- Video upload/delete.
- Media ordering with first media reserved as main thumbnail image.
- Bilingual name/content.
- Multi-currency price editor with auto-price + lock behavior.
- Partial payment settings and minimum payment controls.
- Product size variants and feeds-up capacity.
- Reservation field builder (typed dynamic fields).
- Upgrade-to product configuration.
- Best seller and active/inactive controls.

### Order and Customer Management

- Order list with search, filter, pagination, and details modal.
- Bulk order status updates.
- Customer listing and moderation controls.

### Payments and Links

- Payment link management (create, track, remove).
- Status lifecycle visibility (unused, opened, used).
- Payment metadata review from backend.

### Platform Settings and Operations

- Coupon CRUD with rule configuration.
- Country CRUD, activation, and ordering.
- Referral CRUD.
- Appearance editor per project (ghadaq/manasik).
- Booking blocked-date management.
- Exchange logs and manual price-update trigger.
- Admin activity log viewer.
- Admin user management and permissions.

## Main Pages

- /login
- /
- /products
- /orders
- /customers
- /payments
- /analytics
- /booking
- /coupons
- /countries
- /admins
- /referrals
- /appearance
- /exchange
- /logs

## Tech Stack

- Next.js 16
- TypeScript
- Tailwind CSS v4
- next-intl
- react-toastify
- react-icons
- next-themes

## Environment Variables

Create admin_panel/.env.local:

```env
BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

Notes:

- BACKEND_URL is used by rewrite/proxy fallback.
- NEXT_PUBLIC_BACKEND_URL allows direct browser-to-backend API calls (important for large uploads).

## Scripts

- npm run dev
- npm run build
- npm start
- npm run lint

## Local Development

```bash
cd admin_panel
npm install
npm run dev
```

Default local URL:

- http://localhost:3003

## Related Projects

- apps_backend: canonical API and business logic.
- ghadaq: public storefront (brand A).
- manasik-v2: public storefront (brand B).
