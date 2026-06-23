# Beira Delivery Platform — Backend API

A REST API for a food and goods delivery platform targeting the Beira, Mozambique market. Built as a learning project by a software engineering student, modelled on how platforms like Uber Eats work under the hood.

## What it does

- Customers browse vendors and products, place orders, and pay via mobile money
- Vendors manage their menu and track incoming orders through a state machine
- Riders accept delivery assignments and update order status
- Payments are handled through a pluggable provider abstraction (M-Pesa / e-Mola ready)
- All routes are protected with JWT authentication and role-based authorization

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 22 | Built-in SQLite support, no extra dependencies |
| Language | TypeScript | Type safety, closer to C#/Java background |
| Framework | Express 5 | Minimal, well-documented, industry standard |
| Database | SQLite (node:sqlite) | Zero setup for development; SQL transfers to PostgreSQL |
| Validation | Zod | Schema validation at the HTTP boundary |
| Auth | bcryptjs + jsonwebtoken | Password hashing + JWT signing |

## Project structure

```
src/
├── app.ts                  # Express app — middleware, route mounting
├── server.ts               # Entry point — starts listening
├── db/
│   ├── schema.sql          # Full database schema with constraints and indexes
│   ├── connection.ts       # Single shared SQLite connection
│   └── init.ts             # Runs the schema to create tables
├── middleware/
│   ├── auth.ts             # JWT verification + requireRole() helper
│   └── ForbiddenError.ts   # Shared 403 error class
├── routes/                 # HTTP layer — validates input, calls services, returns responses
│   ├── auth.ts             # POST /api/auth/register, /api/auth/login
│   ├── vendors.ts          # GET/POST /api/vendors
│   ├── products.ts         # GET/POST/PATCH /api/vendors/:id/products
│   ├── orders.ts           # GET/POST/PATCH /api/orders
│   └── payments.ts         # GET/POST /api/payments
├── services/               # Business logic — no HTTP knowledge
│   ├── authService.ts      # Registration, login, JWT signing/verification
│   ├── vendorService.ts    # Vendor CRUD
│   ├── productService.ts   # Product CRUD with partial updates
│   ├── orderService.ts     # Order creation (transactions), status transitions
│   ├── orderStateMachine.ts # Directed graph of valid order status transitions
│   ├── paymentService.ts   # Orchestrates payment attempts + status polling
│   └── payments/
│       ├── IPaymentProvider.ts      # Interface all payment providers implement
│       └── FakePaymentProvider.ts   # Simulates async mobile money for development
└── types/                  # Shared TypeScript interfaces
    ├── User.ts, Vendor.ts, Product.ts, Order.ts, Payment.ts
```

## Key design decisions

**Money as integer cents** — prices and totals are stored as whole integers (centavos), never floats. Floating point arithmetic cannot represent values like 0.1 exactly, which causes silent errors in financial totals.

**Server-side price computation** — when a customer places an order, the server looks up current product prices from the database and computes the total itself. Any price sent by the client is ignored. This prevents a trivial attack where someone sends a modified price.

**Price snapshotting** — `order_items` records `unit_price_cents` at the time of the order, not a live reference to the product's current price. A vendor changing a price tomorrow doesn't rewrite historical order totals.

**Order state machine** — order status follows a directed graph of allowed transitions (`placed → confirmed → preparing → ready_for_pickup → rider_assigned → picked_up → delivered`). Each transition is also role-gated: only vendors can confirm, only riders can mark pickup, etc.

**Atomic transactions** — creating an order inserts into `orders` and `order_items` together inside a `BEGIN/COMMIT` block. A failure partway through rolls back the whole operation — no half-written orders.

**Payment provider abstraction** — `IPaymentProvider` is an interface with `initiatePayment()` and `checkStatus()`. Today it's backed by `FakePaymentProvider` (simulates async mobile money timing). Swapping in a real M-Pesa implementation requires changing one line.

**One payment row per attempt** — a payment that fails and gets retried creates a new row each time, preserving a full audit trail.

**Timing-safe login** — even when a phone/email isn't registered, the server still runs `bcrypt.compare` against a dummy hash before returning an error. This prevents an attacker from detecting whether an account exists by measuring response time.

## Getting started

**Prerequisites:** Node.js 22+

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/beira-delivery.git
cd beira-delivery
npm install

# Configure environment
cp .env.example .env
# Edit .env and set JWT_SECRET to a long random string

# Initialize the database
npm run db:init

# Start the development server
npm run dev
```

The server starts at `http://localhost:3000`.

## API overview

### Auth (public)
```
POST /api/auth/register    # Create account (customer, rider, or vendor_owner)
POST /api/auth/login       # Login with phone or email + password → JWT token
```

### Vendors (public reads, protected writes)
```
GET  /api/vendors              # List all vendors
GET  /api/vendors/:id          # Get one vendor
POST /api/vendors              # Create vendor (vendor_owner only)
```

### Products (public reads, protected writes)
```
GET   /api/vendors/:id/products         # List a vendor's menu
GET   /api/vendors/:id/products/:pid    # Get one product
POST  /api/vendors/:id/products         # Add product (vendor owner only)
PATCH /api/vendors/:id/products/:pid    # Update product (vendor owner only)
```

### Orders (all protected)
```
POST  /api/orders              # Place order — customerId taken from token
GET   /api/orders?customerId=X # Order history (own orders only)
GET   /api/orders/:id          # Get order (own order, assigned rider, or admin)
PATCH /api/orders/:id/status   # Transition status (role-gated per target status)
```

### Payments (all protected)
```
POST /api/payments              # Initiate payment for an order (own order only)
GET  /api/payments?orderId=X    # List payment attempts (own order only)
POST /api/payments/:id/refresh  # Poll provider for updated status
```

All protected routes require an `Authorization: Bearer <token>` header.

## Payment providers

Currently uses `FakePaymentProvider` which simulates the async mobile money flow (payment goes `pending`, becomes `confirmed` after ~2 seconds to simulate the customer approving on their phone).

To add a real provider, implement `IPaymentProvider` and swap the one line in `src/routes/payments.ts`:
```typescript
const provider: IPaymentProvider = new MpesaPaymentProvider(config);
```

Target providers: M-Pesa (Vodacom Mozambique), e-Mola (Movitel).

## License

MIT
