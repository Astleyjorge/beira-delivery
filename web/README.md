# Beira Delivery — Customer Web App

The customer-facing web interface for the Beira Delivery platform. Built with React, TypeScript, Vite, and Tailwind CSS. Talks to the backend API in the parent folder.

## Running it

The backend must be running first (in the parent folder: `npm run dev`).

```bash
cd web
npm install
npm run dev
```

The app starts at http://localhost:5173 and proxies all `/api/*` requests to the backend at http://localhost:3000.

## Customer journey

1. **Sign in / Create account** — phone + password, registers as a customer
2. **Browse** — see open restaurants and shops in Beira
3. **Menu** — view a vendor's products, add items to cart
4. **Cart** — adjust quantities, enter delivery address, place the order
5. **Track** — watch the order move through its lifecycle (auto-refreshes every 4s)

## Structure

```
src/
├── api/client.ts          # Typed fetch wrapper, attaches JWT, handles errors
├── context/
│   ├── AuthContext.tsx     # Logged-in user + token, persisted to localStorage
│   └── CartContext.tsx     # Cart items, single-vendor enforcement, totals
├── pages/
│   ├── AuthPage.tsx        # Login / register
│   ├── VendorListPage.tsx  # Browse vendors
│   ├── VendorMenuPage.tsx  # A vendor's menu
│   ├── CartPage.tsx        # Cart + checkout
│   ├── OrderTrackingPage.tsx # Live order status
│   └── OrdersPage.tsx      # Order history
├── components/Header.tsx   # Shared nav with cart badge
├── lib/format.ts           # Metical currency + status label formatting
└── types/index.ts          # Shared types mirroring the backend
```

## Design

Grounded in Beira's coastal identity: deep ocean teal (#0c2b2e), warm sand (#f0e6d2),
and a coral accent (#e8704a) drawn from the coastline. Mobile-first, since most
customers will order from phones.
