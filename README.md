# Admin Panel — Management Dashboard

A secure **Next.js 16** admin dashboard for managing both **Ghadaq Association** and **Manasik Foundation** platforms.

## Latest Updates (2026-03-16)

- Booking page now uses a custom calendar date picker (single date and range) with clearer blocked-date management UX.
- Admin login now includes a password visibility toggle (show/hide) for safer and easier credential entry.
- Storefront reservation fields now include a custom image picker with preview/remove flow.
- Storefront **The person on whose behalf** now uses a single-input multi-name chip flow.
- Storefront billing phone input now enforces an undeletable `+` prefix and submits in international format.
- Orders page now supports deep-link search with URL query format `/orders?q=...` and keeps the search box in sync.
- Appearance page now supports precise works-image positioning by reordering images inside each row in addition to moving between rows.

---

## Architecture

This app is a **client-only frontend**. It has no direct database connection. All data operations are handled by the shared `next-backend` Next.js serverless API, which this app communicates with via Next.js rewrites.

```
admin_panel (:3003)  →  /api/* rewrite  →  next-backend (:3000) → /api/admin/*  →  MongoDB Atlas
```

> The admin panel's `/api/*` calls are automatically prefixed with `/api/admin/` by the rewrite, so the backend can apply `requireAuth` middleware to all of them.

---

## Tech Stack

| Concern       | Technology                              |
| ------------- | --------------------------------------- |
| Framework     | Next.js 16.1.6 (App Router)             |
| Language      | TypeScript                              |
| Styling       | Tailwind CSS v4                         |
| i18n          | next-intl v4 (Arabic RTL + English LTR) |
| Rich text     | react-quill-new (Quill editor)          |
| Notifications | react-toastify                          |
| Theme         | next-themes (5 custom themes)           |
| Icons         | Lucide React + React Icons              |

---

## Features

### Authentication & Access Control

- JWT auth via `admin-token` HTTP-only cookie (managed by backend)
- Two roles: `super_admin` (full access) and `admin` (configurable page access)
- Per-page permissions — `super_admin` can restrict which pages each `admin` can see
- Automatic redirect on session expiry

### Dashboard

- Stats overview: total products, orders, users, countries
- Fetched from `GET /api/admin/stats` at runtime (dynamic page)

### Product Management

- Create, edit, delete Islamic service products
- Rich text description editor (Quill)
- Multi-image upload via Cloudinary (through backend)
- Multi-currency pricing per country/currency
- Product categories, display ordering, visibility control
- Partial payment configuration

### Order Management

- Full order list with status, source (manasik/ghadaq), and search
- Filter by status and source
- View complete order details and EasyKash transaction info
- Manually mark orders as paid (triggers order confirmation email via backend)

### Coupon Management

- Percentage or fixed-amount coupons
- Validity dates, max uses, minimum order amount
- Per-product restrictions

### Country Management

- Activate/deactivate countries for platform availability
- Bulk management of supported regions

### User Management

- Create and manage admin users
- Assign `admin` or `super_admin` roles
- Configure per-page access for `admin` role

### Referral Management

- Create and manage referral partners
- Referral IDs linked to orders

### Appearance Management (Per-Project)

- Manage works gallery images separately for **Ghadaq** and **Manasik**
- Two image rows per project
- Upload directly to Cloudinary via backend
- Changes reflect live on the respective public site

### Exchange Rates

- View current exchange rates and cron execution history
- Source column distinguishes **Cron Job** (automatic) vs **Manual** (admin-triggered) updates
- Trigger manual price updates across all products

### Activity Log

- Complete audit trail of all admin actions
- Filter by action type and resource

### Themes

5 built-in admin themes, switchable from the user menu:

| Theme       | Description                              |
| ----------- | ---------------------------------------- |
| **Light**   | White background, blue gradient          |
| **Black**   | Pure dark background, blue gradient      |
| **Manasik** | Navy background, green gradient          |
| **Ghadaq**  | Forest green background, gold gradient   |
| **Colors**  | Deep purple background, rainbow gradient |

---

## Getting Started

### Prerequisites

- Node.js 18+
- `next-backend` running on port 3000 (or configured via `BACKEND_URL`)
- First admin user created via `npm run create-admin` in `next-backend/`

### Install & run

```bash
cd admin_panel
npm install
npm run dev   # http://localhost:3001
```

### Environment variables

Create a `.env.local` file:

```env
# Backend API (the shared Next.js serverless API)
BACKEND_URL=http://localhost:3000
```

That is the **only** environment variable required. All auth, DB, Cloudinary, and payment credentials live in `next-backend/.env.local`.

---

## Scripts

| Command         | Description                                       |
| --------------- | ------------------------------------------------- |
| `npm run dev`   | Start development server (Turbopack) on port 3003 |
| `npm run build` | Production build                                  |
| `npm start`     | Start production server                           |
| `npm run lint`  | Run ESLint                                        |

---

## Related Projects

| Project         | Role                                |
| --------------- | ----------------------------------- |
| `next-backend/` | Shared API server (required to run) |
| `manasik-v2/`   | Public app — Manasik Foundation     |
| `ghadaq/`       | Public app — Ghadaq Association     |

---

## License

Private and proprietary. Shared infrastructure for **Ghadaq Association** and **Manasik Foundation**.

- **Two Roles**: `super_admin` (full access) and `admin` (configurable page access)
- **Per-Page Permissions** — `super_admin` can restrict which pages each `admin` user can access
- **Session Management** — Token-based with automatic redirect on expiry

### Dashboard & Analytics

- Overview statistics: total orders, revenue, products, users
- Recent orders and activity summary

### Product Management

- Create, edit, delete Islamic service products
- Rich text description editor (Quill)
- Multi-image upload via Cloudinary
- Multi-currency pricing (set price per country/currency)
- Product categories and ordering (drag-to-reorder)
- Product visibility control

### Order Management

- View all customer orders with full details
- Order status tracking (pending, processing, paid, failed, refunded, cancelled)
- Filter and search orders by name, email, order number, status, and referral
- View EasyKash transaction info

### Coupon Management

- Create percentage or fixed-amount discount coupons
- Set validity dates, max uses, min order amount
- Enable/disable coupons

### Country Management

- Activate or deactivate countries for platform availability
- Search by name, code, or currency
- Bulk management of supported regions

### User Management

- Create and manage admin users
- Assign `admin` or `super_admin` roles
- Configure per-page access permissions for `admin` role users

### Referral Management

- Create and manage referral partners
- Track referral IDs linked to orders

### Appearance Management (Per-Project)

- Manage works gallery images separately for **Ghadaq** and **Manasik**
- Two image rows per project (Row 1 = first slider, Row 2 = second slider)
- Upload images directly to Cloudinary
- Drag images between rows with move up/down controls
- Changes reflect immediately on the respective public site

### Exchange Rates

- View current exchange rates and cron job execution history
- Source column shows whether each update was triggered by **Cron Job** (automatic daily) or **Manual** (admin)
- Trigger manual price recalculation across all products
- Currency-specific rounding rules applied (see backend README)

### Activity Log

- Complete audit trail of all admin actions
- Filter by action type and resource
- Tracks create, update, delete, login, and logout events

### Themes

5 built-in admin themes, switchable from the user menu:

| Theme       | Description                                                      |
| ----------- | ---------------------------------------------------------------- |
| **Light**   | White background, blue gradient accents                          |
| **Black**   | Pure dark background, blue gradient accents                      |
| **Manasik** | Navy blue background, green gradient matching the Manasik brand  |
| **Ghadaq**  | Forest green background, gold gradient matching the Ghadaq brand |
| **Colors**  | Deep purple background, vibrant rainbow gradient                 |

---

## 🛠️ Tech Stack

| Category             | Technology                                 |
| -------------------- | ------------------------------------------ |
| Framework            | Next.js 16.1.6 (App Router, Turbopack)     |
| Language             | TypeScript                                 |
| Database             | MongoDB + Mongoose v9                      |
| Authentication       | JWT (jsonwebtoken) + bcryptjs              |
| Styling              | Tailwind CSS v4 with CSS custom properties |
| Internationalization | next-intl v4.8.3                           |
| Rich Text            | react-quill-new (Quill editor)             |
| Image Upload         | Cloudinary v2                              |
| Toast Notifications  | react-toastify                             |
| Themes               | next-themes v0.4.6                         |
| Icons                | Lucide React + React Icons                 |
| Country Flags        | country-flag-icons                         |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MongoDB running on `localhost:27017` (or configured via env)
- Cloudinary account
- The same MongoDB instance used by ghadaq and/or manasik-v2

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env.local   # or create manually (see below)

# 3. Create your first super admin user
npx tsx scripts/create-admin.ts

# 4. Seed countries (if not done already via ghadaq/manasik)
npx tsx scripts/seed-countries.ts

# 5. Start the development server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) and log in with the credentials you created.

---

## ⚙️ Environment Variables

Create a `.env.local` file in the project root:

```env
# ── Authentication ────────────────────────────────────────────────
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars

# ── Database ──────────────────────────────────────────────────────
DATA_BASE_URL=mongodb://localhost:27017/manasik

# ── Application ───────────────────────────────────────────────────
BASE_URL=http://localhost:3001
NODE_ENV=development

# ── Cloudinary (Image Upload) ─────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

> `DATA_BASE_URL` must point to **the same MongoDB database** as ghadaq and manasik-v2. All three apps share one database.
> `JWT_SECRET` must be the same value as the one used in ghadaq and manasik-v2 if those apps validate admin tokens.

---

## 📁 Project Structure

```
admin_panel/
├── app/
│   ├── layout.tsx              # Root layout (fonts, theme provider, intl)
│   ├── globals.css             # Theme definitions (Light/Black/Manasik/Ghadaq/Colors)
│   ├── (dashboard)/            # Protected admin route group
│   │   ├── layout.tsx          # Sidebar, nav, auth guard, UserMenu
│   │   ├── page.tsx            # Dashboard home (stats overview)
│   │   ├── products/           # Product list + new/edit sub-pages
│   │   ├── orders/             # Order list + detail sub-pages
│   │   ├── coupons/            # Coupon management
│   │   ├── countries/          # Country activation management
│   │   ├── users/              # Admin user management
│   │   ├── referrals/          # Referral partner management
│   │   ├── appearance/         # Per-project works image management (Ghadaq / Manasik tabs)
│   │   └── logs/               # Activity log viewer
│   ├── login/                  # Login page (bypasses dashboard layout)
│   └── api/                    # Admin API routes
│       ├── appearance/
│       │   └── [project]/      # GET + PUT appearance for 'ghadaq' or 'manasik'
│       ├── auth/               # Login / logout / me
│       ├── countries/          # CRUD countries
│       ├── coupons/            # CRUD coupons
│       ├── currency/rates      # Exchange rate proxy
│       ├── logs/               # Activity log fetch
│       ├── orders/             # Order list + detail
│       ├── products/           # CRUD products + reorder + auto-price
│       ├── referrals/          # CRUD referrals
│       ├── upload/image        # Cloudinary image upload handler
│       └── users/              # CRUD admin users
├── components/
│   ├── admin/                  # Admin-specific components (tables, forms)
│   ├── providers/
│   │   ├── auth-provider.tsx   # Auth context (user, login, logout)
│   │   └── theme-provider.tsx  # next-themes wrapper (5 themes)
│   ├── shared/
│   │   ├── logo.tsx            # Admin logo
│   │   ├── lang-toggle.tsx     # AR/EN language switcher
│   │   ├── theme-toggle.tsx    # 5-theme dropdown switcher
│   │   ├── user-menu.tsx       # User info + lang/theme + logout
│   │   └── page-title.tsx      # Page heading component
│   └── ui/
│       ├── button.tsx          # Button with gradient-site primary variant
│       ├── input.tsx           # Styled input field
│       └── loading.tsx         # Page and inline loading states
├── lib/
│   ├── auth-middleware.ts      # requireAuth HOF for API route protection
│   ├── cloudinary.ts           # Cloudinary upload config
│   ├── db.ts                   # MongoDB connection
│   ├── jwt.ts                  # Token sign/verify
│   ├── logger.ts               # Activity log writer
│   ├── rate-limit.ts           # API rate limiter
│   ├── server-auth.ts          # Server-side auth helpers
│   └── utils.ts                # cn() and other utilities
├── models/                     # Mongoose models (shared DB)
│   ├── ActivityLog.ts          # Admin action audit trail
│   ├── Appearance.ts           # Works images (project: 'ghadaq' | 'manasik')
│   ├── Country.ts              # Countries and currencies
│   ├── Coupon.ts               # Discount coupons
│   ├── Order.ts                # Customer orders
│   ├── Product.ts              # Islamic service products
│   ├── Referral.ts             # Referral partners
│   └── User.ts                 # Admin users
├── types/                      # TypeScript interfaces matching models
├── messages/
│   ├── ar.json                 # Arabic UI translations
│   └── en.json                 # English UI translations
├── public/
│   └── fonts/                  # Satoshi & Expo Arabic fonts
└── scripts/
    ├── create-admin.ts         # Create the first super_admin user
    └── seed-countries.ts       # Seed default countries into MongoDB
```

---

## 🔧 Available Scripts

```bash
npm run dev    # Start development server on port 3001 (Turbopack)
npm run build  # Build for production
npm run start  # Start production server
npm run lint   # Run ESLint
```

### Utility Scripts

```bash
# Create the first super admin
npx tsx scripts/create-admin.ts

# Seed countries into MongoDB (needed once per database)
npx tsx scripts/seed-countries.ts
```

---

## 🔐 Security

- All dashboard routes and API endpoints (except `/login`) are protected by `requireAuth` middleware
- JWT tokens stored in HTTP-only cookies (`admin-token`)
- Passwords hashed with `bcryptjs`
- Role-based access: `super_admin` has full access; `admin` access is restricted to `allowedPages`
- All admin actions are logged to the `ActivityLog` collection
- API input validation on all write endpoints

---

## 🌍 Internationalization

The admin UI supports Arabic and English:

- Locale stored in cookie, switchable from the user menu (bottom of sidebar)
- RTL/LTR layout adapts automatically
- Full translation coverage in `messages/ar.json` and `messages/en.json`

---

## 🎨 Theme System

Themes are stored in `localStorage` via `next-themes` (key: `admin-panel-theme`).
Each theme is defined as a CSS class in `app/globals.css` with custom property overrides:

```
:root          → Light theme  (white bg, blue gradient)
.black         → Black theme  (dark bg, blue gradient)
.manasik       → Manasik theme (navy bg, green gradient)
.ghadaq        → Ghadaq theme (green bg, gold gradient)
.colors        → Colors theme (purple bg, rainbow gradient)
```

All components use `var(--background)`, `var(--foreground)`, `var(--gradient-site)`, etc., so they adapt to any theme automatically.

---

## 📡 API Reference

### Public Appearance API

```
GET  /api/appearance/ghadaq    → Fetch ghadaq works images
GET  /api/appearance/manasik   → Fetch manasik works images
PUT  /api/appearance/:project  → Update works images (auth required)
```

### Auth API

```
POST /api/auth/login    → Login with email + password
POST /api/auth/logout   → Clear admin-token cookie
GET  /api/auth/me       → Get current user from token
```

---

## 📄 License

Private and proprietary. Shared infrastructure for **Ghadaq Association** and **Manasik Foundation**.
