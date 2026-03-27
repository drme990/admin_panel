# Admin Panel (admin_panel)

Management dashboard for Ghadaq and Manasik operations.

## Last Updated

- 2026-03-27

## Release Notes

- 2026-03-27: Added user management and analytics dashboard.
- 2026-03-19: Refactored icons to React Icons and updated button styling system.
- 2026-03-19: Refactored payments and exchange UX, plus translation updates.
- 2026-03-17: Added payments management page with analytics and payment-link workflows.
- 2026-03-16: Added deep-link search support on orders page and appearance image reordering improvements.

## Architecture

- Next.js App Router frontend for admin operations.
- Uses app-level API proxying/rewrites to the shared backend in apps_backend.
- Authentication is cookie-based with admin permissions enforced by backend.

Flow:

- Browser -> admin_panel -> /api/_ -> apps_backend /api/admin/_ -> MongoDB

## Stack

- Next.js 16.1.6
- TypeScript
- Tailwind CSS v4
- next-intl (ar/en)
- react-toastify
- react-icons
- next-themes

## Core Features

- Authentication and role-based page access.
- Dashboard stats and analytics charts.
- Orders management (search, filters, bulk status updates, details).
- Payments management (direct payment-link creation + lifecycle tracking).
- Products, coupons, countries, users, referrals CRUD.
- Appearance management per project.
- Exchange rates review and manual update trigger.
- Activity logs (admin activity only).

## Admin Pages And Feature Coverage

- `/` Dashboard: global counters and revenue-over-time chart.
- `/products`: full product listing, create/edit/delete, ordering controls.
- `/orders`: filters, search, bulk status updates, detailed order modal.
- `/customers`: cross-app customer list and ban/unban controls.
- `/payments`: direct payment-link creation and lifecycle tracking.
- `/analytics`: revenue (day/month), orders by status, payment split, top products, country/weekday charts.
- `/booking`: blocked execution dates management.
- `/coupons`: coupon CRUD and status management.
- `/countries`: country activation and currency/order controls.
- `/admins`: admin user CRUD and per-page permission assignment.
- `/referrals`: referral partner CRUD.
- `/appearance`: project-based visuals/content settings.
- `/exchange`: exchange logs and manual update trigger.
- `/logs`: admin activity audit logs.
- `/login`: admin authentication entry page.

## Current Behavior Notes

- Orders customer type is resolved safely for legacy records:
  - If isGuest is present, its value is respected.
  - If isGuest is missing, fallback is inferred from userId presence.
- Payments page is direct-link only and tracks link lifecycle states: unused, opened, used.

## Environment

Create admin_panel/.env.local:

```env
BACKEND_URL=http://localhost:3000
```

## Scripts

- npm run dev
- npm run build
- npm start
- npm run lint

## Run Locally

```bash
cd admin_panel
npm install
npm run dev
```

Default local URL:

- http://localhost:3003

## Related Apps

- apps_backend: canonical API/backend.
- ghadaq: public storefront.
- manasik-v2: public storefront.
