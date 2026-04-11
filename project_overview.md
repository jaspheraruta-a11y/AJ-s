# AJ's Café — Complete Project Overview

## What Is This Project?

**AJ's Café** is a full-stack, production-ready web application for a real café located in **Laligan, Valencia, Bukidnon, Mindanao, Philippines**. It acts as an online ordering system, loyalty rewards platform, and admin management dashboard — all in one single-page app.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + TypeScript (via Vite 6) |
| **Styling** | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| **Animations** | Framer Motion (`motion/react`) |
| **Icons** | Lucide React |
| **Routing** | React Router DOM v7 |
| **Backend / Database** | Supabase (PostgreSQL + Auth + Realtime) |
| **Payment — GCash** | PayMongo API (via Vite dev proxy) |
| **Payment — Cards** | Stripe (via Vite dev proxy + React Stripe.js) |
| **AI** | `@google/genai` (imported but not yet wired into UI) |
| **Dev Server** | Vite on port 3000, bound to `0.0.0.0` (LAN accessible) |

---

## Application Routes

| Route | Component | Who Can Access |
|---|---|---|
| `/` | `ShopView` | Everyone (customer-facing) |
| `/admin` | `AdminDashboardWrapper` → `AdminDashboard` | Admin users only (auto-redirect enforced) |
| `/payment` | `PaymentDashboard` | Logged-in customers during checkout |

---

## Database Schema (Supabase/PostgreSQL)

### Tables

| Table | Purpose |
|---|---|
| `profiles` | Extended user data linked to `auth.users`. Stores full name, phone, address, role (`client` / `admin`), and loyalty **points balance**. |
| `categories` | Café menu categories (name, slug, description, image, sort order). |
| `products` | Individual menu items — price, image, availability flag, stock quantity, size/addon flags. |
| `product_sizes` | Size variants per product (Small/Medium/Large) with a `price_modifier`. |
| `product_addons` | Optional add-ons per product with individual prices. |
| `inventory` | One-to-one with products, tracks `quantity` and `low_stock_threshold`. |
| `orders` | Every order placed. Supports `order_type` enum: `walkin`, `online`, `qr`. Has `status` enum: `pending → confirmed → preparing → ready → completed / cancelled`. |
| `order_items` | Line items inside an order. Stores product name (snapshot), size, quantity, unit_price, addons (JSONB), notes, line_total. |
| `payments` | One per order. Stores `method` (cash/card/gcash/paymaya), `status` (pending/paid/failed/refunded), amount, and reference. |
| `redeemable_products` | Products that customers can claim using loyalty points. Has stock, validity window, and per-user redemption cap. |
| `points_history` | Audit log for earned/redeemed/refunded loyalty points. |
| `favorite_orders` | Saved order templates per user (JSONB items). |
| `admin_logs` | Audit trail of every admin action (action type, entity, details JSONB). |
| `sales_reports` | Daily aggregate: total orders, revenue, walk-in vs online counts. |

### Custom ENUMs
- `order_status`: `pending`, `confirmed`, `preparing`, `ready`, `completed`, `cancelled`
- `payment_status`: `pending`, `paid`, `failed`, `refunded`
- `user_role`: `client`, `admin`

---

## Feature Deep-Dive

### 1. Customer Shop (`/` — ShopView.tsx)

#### Hero Banner
- Full-width 500 px hero image (Unsplash) with a dark overlay.
- Animated entrance text using Framer Motion (`opacity + y` transitions, staggered delays).
- Location badge: *"Laligan, Valencia, Bukidnon"*.
- "Order Now" CTA button.

#### Navbar
- Sticky, frosted-glass (`backdrop-blur-md`) navbar.
- **Cart icon** with animated badge showing item count.
- **User greeting** shown when logged in.
- **Loyalty Points badge** (amber pill, ⭐ icon) showing the logged-in user's current points balance in real-time.
- **Login button** or **Logout button** depending on auth state.
- Auto-redirects admin users to `/admin` upon login.

#### Three-Tab System
The main content area switches between three tabs via pill-style tab bar:

##### Tab 1: Menu
- Horizontally scrollable **category filter pills** (All Items + each category from DB).
- **Product grid** (1–4 columns responsive) — each card shows:
  - Product image (with hover scale animation).
  - Product name + price.
  - Size/Add-on availability indicators.
  - Quick-add `+` button (adds directly to cart without opening modal).
  - Click opens **Product Modal**.
- Empty state shown if no products in selected category.
- Products filtered client-side by `category_id`.

##### Tab 2: Redeem (Points Rewards)
- Only visible to all users; "Redeem" tab turns amber when active.
- **Points banner** at top showing user's current balance and earning rate (₱1 = 0.01 pts).
- Grid of **RedeemableProductCards** fetched from `redeemable_products` table.
- Each card shows:
  - Product image or Gift icon placeholder.
  - Points-required badge (amber pill).
  - Stock left count.
  - Max-per-user limit.
  - **"Redeemable"** badge (green) if user has enough points, or *"Need X more pts"* (gray) if not.
  - Out-of-stock overlay.
  - Expired overlay.
- Fetched on-demand when the tab is activated.

##### Tab 3: My Orders
- Only visible to **logged-in clients**.
- **Active orders badge** on the tab pill — pulses orange if any order is `preparing` or `ready`.
- Active orders **callout banner** (animated bell 🔔) with real-time notification text.
- **Status legend** row showing all possible statuses and their colors.
- **Order grid** (1–3 col responsive) of `OrderCard` components.
- Each OrderCard shows:
  - Order number + date/time.
  - Animated **StatusBadge** component:
    - `preparing` → pulsing orange ring + rotating 🔥 flame emoji.
    - `ready` → pulsing green glow + bouncing 🍽️ emoji.
    - Other statuses → plain badge with icon.
  - Animated glowing top-bar for active orders (orange/green gradient).
  - Order type + table number + total.
  - Collapsed preview: up to 3 item chips.
  - Expandable detail section (Framer Motion height animation):
    - Full item list with sizes, add-ons, notes.
    - Subtotal / delivery fee / discount / total breakdown.
    - Customer notes.
- **Refresh button** + Supabase **real-time subscription** — orders auto-update without page refresh.
- Filters out `completed` orders (only shows active/recent history, max 30).

---

### 2. Shopping Cart (CartDrawer)

- **Slide-in drawer** from the right, spring-animated.
- Backdrop overlay (blurred, soft `[#7b6a6c]/20` tint).
- Empty state with illustration and "Browse Menu" button.
- Per-item: thumbnail, name, selected size name, price per unit, quantity +/- controls, remove button, line total.
- Handles **size variants** — same product with different sizes counted as separate cart entries.
- Checkout button:
  - If logged in → navigate to `/payment` with cart + total in route state.
  - If not logged in → open Login Modal instead.

---

### 3. Authentication (LoginModal.tsx)

A single modal handles all three auth flows:

#### Login Mode
- Email + password.
- Google OAuth (redirects using Supabase `signInWithOAuth`).
- Link to switch to Signup or Magic Link.

#### Signup Mode
- Full Name, Email, Phone, Address, Password, Confirm Password.
- Animated **Password Strength Meter**:
  - 4-segment bar that fills with gradient colors (red → orange → green → cyan/purple).
  - Evaluates: length ≥8, length ≥12, mixed case, digits, special characters.
  - Animated pill badge showing `Weak / Fair / Strong / Very Strong` with contextual tips.
- **Password match indicator** — live ✓/✗ feedback on the confirm field.
- Creates Supabase `auth.users` entry + `profiles` upsert with all extra fields.
- Enforces minimum `Fair` (score ≥ 2) password strength.
- Animated field slide-in/out when switching modes.

#### Magic Link Mode
- Email only → sends OTP link via `signInWithOtp`.
- Success message shown inline.

---

### 4. Product Modal (ProductModal.tsx)

- Appears on product click.
- Large image header (taller for single-size products).
- Product name, base price, In Stock / Out of Stock badge.
- Product description.
- If `has_sizes`: shows **large-size variants** as grid buttons (filtered to sizes containing "large", "l", or "big" in the name). Clicking a size button adds that variant to cart and closes the modal.
- If no sizes: shows a **Quick Add to Cart** button.
- Feature tags: Multiple Sizes, Add-ons Available, Ready to Order.

---

### 5. Checkout & Payments (`/payment` — PaymentDashboard.tsx)

The checkout page is a **two-column layout** (payment methods left, order summary right).

#### Payment Methods (3 options)

**A) GCash (via PayMongo)**
- Creates a PayMongo "Source" for the `gcash` type with redirect URLs.
- Saves cart + user ID to `sessionStorage` as a pending order.
- Redirects user to GCash's hosted checkout page.
- On return: reads `?status=success/failed` from URL, finalizes the order, awards points, redirects home.
- Uses a `useRef` guard to prevent double-execution in React 18 Strict Mode.

**B) Credit/Debit Card (via Stripe)**
- Embedded `StripeCardForm` inside `<Elements>` provider.
- Custom card preview UI (decorative card with cardholder name preview).
- Three separate Stripe Elements: CardNumber, CardExpiry, CardCvc — each with custom styles.
- Focus ring highlights on active field.
- Click "Pay Securely" →
  1. Creates a PaymentIntent via Stripe proxy.
  2. Confirms card payment with `stripe.confirmCardPayment`.
  3. Saves order + payment to Supabase.
  4. Awards loyalty points.
- Trust badge: *"Secured by Stripe · 256-bit SSL encryption"*.

**C) Pay in Counter**
- No redirect — immediately saves order to DB with `status: 'pending'`.
- Shows "Order Placed!" success screen with message to visit the counter.

#### Order Summary Panel (sticky)
- Lists every cart item with name, size, quantity, and line total.
- Subtotal + Tax (₱0.00) + Total breakdown.
- Confirm Payment button (disabled if no method selected or cart empty).

#### Post-Payment Screens
- **Success**: Animated `CheckCircle2` icon + order message + **Points Earned badge** (amber, shows exact points awarded).
- **Failed**: Red `XCircle` + error message + Try Again button.
- **GCash Redirecting**: Spinning loader screen while redirect happens.
- Auto-navigates back to `/` after 4 seconds on success.

#### Security — API Key Proxy
Both payment APIs are accessed through **Vite dev proxy**:
- `/api/paymongo/*` → proxied to `https://api.paymongo.com` with Basic auth injected server-side.
- `/api/stripe/*` → proxied to `https://api.stripe.com` with Bearer auth injected server-side.
- Secret keys **never exposed to the browser**.

#### Loyalty Points System
- Formula: **₱1 spent = 0.01 pts** (e.g. ₱500 order = 5 pts).
- Points added to `profiles.points` column atomically after every paid order.
- Shown in navbar and "Redeem" tab.
- History tracked in `points_history` table.
- Counter (pay-at-counter) orders also earn points.

---

### 6. Admin Dashboard (`/admin` — AdminDashboard.tsx)

Access-controlled: `AdminDashboardWrapper` checks the user's role before rendering. Only profiles with `role = 'admin'` see this.

#### Sidebar Navigation
- Tabs: Overview, Orders, Products, Inventory, Users, Promos, Logs.
- Admin user name + avatar displayed.
- Logout button.
- **Last Updated** timestamp (refreshes on real-time events).

#### Real-Time Data
The admin controller sets up **5 separate Supabase realtime channels**:
- `admin-orders-realtime` → fetches fresh orders on any change.
- `admin-products-realtime` → refetches products.
- `admin-inventory-realtime` → refetches inventory.
- `admin-users-realtime` → refetches profiles.
- `admin-promos-realtime` → refetches redeemable products.

All 9 data sets are loaded in parallel on mount via `Promise.all`.

#### Tab: Overview
- **4 stat cards**: Today's Orders, Today's Revenue, Pending Orders, Low Stock Items.
- Low Stock card has a **pulsing red dot** indicator (`animate-ping`) when count > 0.
- **Trend indicators** on some cards (hardcoded for now).
- **Recent Orders list** (last 5 orders shown inline).
- **Quick Action buttons**: Manage Products, Create Promo, View Reports.

#### Tab: Orders
- **Search** by order number or customer name.
- **Status filter** dropdown (All / Pending / Preparing / Ready / Completed / Cancelled).
- Full data table with columns: Order #, Date, Customer (avatar + name), Order Type badge, Total, Status badge.
- **Inline status dropdown** per row — admin can change status directly; disables while updating.
- **Eye button** → opens order detail panel (fetches `order_items` for that order).
- **Export PDF button** → generates a print-ready HTML page with full orders table and opens browser print dialog.

#### Tab: Products
- **Category filter** dropdown.
- Table: Product image thumbnail, name, description snippet, category, price (₱), stock quantity, availability toggle, Edit/Delete buttons.
- Stock column shows an **animated red pulsing dot + warning icon** if item is low stock.
- **availability toggle button** → calls `updateProductAvailability` → updates Supabase instantly.
- **"+ Add Product" button** → opens **Add Product Modal**:
  - Fields: Name, Description, Price, Category (dropdown), Image URL, Stock Quantity, Availability toggle.
  - **"Has Sizes" toggle** → reveals size editor with 3 rows (Small/Medium/Large) each with a price modifier.
  - On submit: inserts to `products` + optional `product_sizes` rows + creates `inventory` record.

#### Tab: Inventory
- **Search** by product name.
- **Category filter** dropdown.
- **Checkbox filters**: Low Stock only / Optimal only.
- Table: Product name + image, category, current quantity (red if low), low-stock threshold, status badge, **inline quantity updater**.
- `InventoryUpdateCell` component: enter a number (positive to add, negative to subtract) + click Add.

#### Tab: Users
- Full table of all registered users: avatar, name, email, role badge (purple=admin, blue=client), join date.

#### Tab: Promos
- Table of `redeemable_products`: name, description, points required (shown as "Discount"), stock (shown as "Usage"), active status.
- **"+ Create Promo" button** → opens **Create Promo Modal**:
  - Fields: Product Name, Description, Points Required, Stock, Image URL, Active toggle.

#### Tab: Logs
- Shows the last 50 `admin_logs` entries — action type, entity, timestamp, details.

#### Computed Stats (`getStats()`)
- Today's orders (filtered by today's date).
- Today's revenue + total revenue.
- Counts of pending / preparing / completed orders.
- Low stock items count.
- Active promos count.
- Walk-in vs online split.
- Total / available products.
- Total / admin / client user counts.

---

### 7. Data Models & Controllers

#### `useShopController`
- Loads all categories and products in parallel on mount.
- Client-side category filtering.
- JWT expiry handling (signs out + redirects).

#### `useCartController`
- In-memory cart state.
- `addToCart`: supports size variants (same product + different size = different cart entry).
- `removeFromCart`: by product ID + optional size ID.
- `updateQuantity`: removes item if quantity drops to 0.
- `totalAmount`: computed from `reduce`.

#### `useAdminController`
- All 9 data resources in one hook.
- 5 realtime channels.
- `updateOrderStatus`, `updateProductAvailability`, `updateInventory`, `createPromo`.
- `logAdminAction` — writes to `admin_logs` after every admin mutation.
- `getStats()` — derived stats object (no extra DB queries).

#### `useOrderManagement`
- Fetches `order_items` for a given `order_id` on demand.

---

## Security Highlights

- Supabase Row-Level Security (RLS) is expected to be configured server-side.
- Payment API secret keys are **never sent to the browser** — Vite proxy injects them at the server level.
- Admin role check is enforced in `AdminDashboardWrapper` — non-admin users are redirected.
- Password strength enforcement in signup (min "Fair" strength required).
- JWT expiry silently handled by signing the user out and redirecting to `/`.

---

## Animations & UX Polish

- **Framer Motion** used throughout: page transitions, cart drawer spring slide, modal scale-in, product card entrance, order card layout animations.
- `AnimatePresence` for clean mount/unmount of modals, tabs, expanded order details.
- Status badges for `preparing` and `ready` have continuous looping animations (pulse rings, emoji wobble, glow).
- Password strength meter animates smoothly between states.
- Cart badge count appears/disappears with animation.
- Low stock indicators use CSS `animate-ping` for real-time urgency signalling.

---

## What Is NOT Yet Fully Wired

- **Edit / Delete product** buttons exist in the Products tab but have no handler yet.
- **Quick Actions** on the Overview tab (Manage Products, Create Promo, View Reports) are aesthetic buttons with no `onClick`.
- **`@google/genai`** is installed as a dependency but not used in any UI yet.
- **`favorite_orders`** table exists in the DB but no UI for saving/restoring favorites.
- **`sales_reports`** table exists and is loaded but not displayed in any tab.
- **Footer links** (Our Story, Menu, Locations, Contact, social links, Privacy Policy, Terms) are `href="#"` placeholders.
