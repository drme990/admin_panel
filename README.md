# Admin Panel (admin_panel)

Central operations dashboard for running both storefronts: Ghadaq and Manasik.

## Latest Updates (April 2026)

- Product model migration completed from legacy `images` to `media`.
- Product media is now platform-aware per media item:
  - `shared`
  - `ghadaq`
  - `manasik`
- Product form now manages platform at the media-item level.
- Orders page filters upgraded:
  - status tabs with status-color styling
  - advanced date filtering (specific/range and quick date workflow)
- Payment links, webhook robustness, and order/payment status handling improved.

## What This App Does

- Authenticates admins with role and page-level permission checks.
- Manages products, orders, customers, payments, coupons, countries, referrals, and admins.
- Controls platform appearance and booking blocked dates.
- Provides analytics and activity monitoring.

## Product Management Highlights

- Full CRUD and reorder support.
- Media management with mixed image/video support.
- Per-item media platform visibility (`shared`, `ghadaq`, `manasik`).
- Multi-currency pricing and minimum-payment controls.
- Reservation field presets and configuration.
- Upgrade product + upgrade features management.

## Order and Payment Highlights

- Search/filter/paginate orders with details modal.
- Bulk status updates.
- Payment timeline visibility.
- Create and manage payment links.
- Better retry and status clarity across apps.

## Architecture

- Next.js App Router + TypeScript + Tailwind CSS v4.
- i18n via `next-intl` (Arabic/English).
- Backend-first architecture: all domain logic is in `backend`.
- Request flow:
  - Browser -> admin_panel -> backend `/api/admin/*` -> MongoDB/services

## Main Pages

- `/login`
- `/`
- `/products`
- `/orders`
- `/customers`
- `/payments`
- `/analytics`
- `/booking`
- `/coupons`
- `/countries`
- `/admins`
- `/referrals`
- `/appearance`
- `/exchange`
- `/logs`

## Environment

Create `admin_panel/.env.local`:

```env
BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_DESIGN_APP_URL=http://localhost:3001
```

## Scripts

- `npm run dev`
- `npm run build`
- `npm start`
- `npm run lint`

## Local Run

```bash
cd admin_panel
npm install
npm run dev
```

Default URL: `http://localhost:3003`

## Related Apps

- `backend` (canonical API and business logic)
- `ghadaq` (public storefront)
- `manasik-v2` (public storefront)
