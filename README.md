# Admin Panel — Centralized Management Dashboard

A dedicated, secure admin dashboard built with Next.js 16 for managing both **Ghadaq Association** and **Manasik Foundation** platforms. Runs independently on port 3001 and shares the same MongoDB database with both client applications.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Shared MongoDB Database                      │
│                  mongodb://localhost:27017/manasik               │
└──────────┬────────────────────┬──────────────────────────┬──────┘
           │                    │                          │
    ┌──────▼──────┐     ┌───────▼──────┐       ┌──────────▼───────────┐
    │   ghadaq/   │     │  manasik-v2/ │       │    admin_panel/      │
    │  :3002      │     │   :3001      │       │       :3000          │
    │ Public site │     │ Public site  │       │  Admin dashboard     │
    └─────────────┘     └──────────────┘       └──────────────────────┘
```

The admin panel writes data; both client apps read from the shared database through their own public APIs.

> **Port Note:** `ghadaq` and `manasik-v2` both use port 3000 and cannot run simultaneously. Run them one at a time during development. The admin panel always runs on port 3001.

---

## ✨ Features

### Authentication & Access Control

- **JWT Authentication** — Secure login via `admin-token` HTTP-only cookie
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
- View Paymob transaction info

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

### Payment Settings (Per-Project)

- Set the active payment method independently for **Ghadaq** and **Manasik**
- Supported gateways: **Paymob** and **EasyKash**
- Changes take effect immediately on the next checkout

### Activity Log

- Complete audit trail of all admin actions
- Filter by action type and resource
- Tracks create, update, delete, login, and logout events

### Themes

5 built-in admin themes, switchable from the user menu:

| Theme | Description |
|---|---|
| **Light** | White background, blue gradient accents |
| **Black** | Pure dark background, blue gradient accents |
| **Manasik** | Navy blue background, green gradient matching the Manasik brand |
| **Ghadaq** | Forest green background, gold gradient matching the Ghadaq brand |
| **Colors** | Deep purple background, vibrant rainbow gradient |

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Language | TypeScript |
| Database | MongoDB + Mongoose v9 |
| Authentication | JWT (jsonwebtoken) + bcryptjs |
| Styling | Tailwind CSS v4 with CSS custom properties |
| Internationalization | next-intl v4.8.3 |
| Rich Text | react-quill-new (Quill editor) |
| Image Upload | Cloudinary v2 |
| Toast Notifications | react-toastify |
| Themes | next-themes v0.4.6 |
| Icons | Lucide React + React Icons |
| Country Flags | country-flag-icons |

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
│   │   ├── payment-settings/   # Per-project payment method config (Ghadaq / Manasik tabs)
│   │   └── logs/               # Activity log viewer
│   ├── login/                  # Login page (bypasses dashboard layout)
│   └── api/                    # Admin API routes
│       ├── admin/
│       │   └── payment-settings/ # GET (all projects) / PUT (by project)
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
│   ├── PaymentSettings.ts      # Payment method per project
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

### Payment Settings API
```
GET  /api/admin/payment-settings           → Fetch all projects' payment methods
GET  /api/admin/payment-settings?project=ghadaq  → Fetch one project
PUT  /api/admin/payment-settings           → Update { project, paymentMethod }
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
