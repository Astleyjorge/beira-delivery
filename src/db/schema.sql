-- ============================================================
-- Beira Delivery Platform — Database Schema
-- SQLite (will port near-identically to PostgreSQL later)
-- ============================================================

PRAGMA foreign_keys = ON;

-- Users: one table, role column distinguishes customer/rider/vendor_owner/admin.
-- This lets one person hold multiple roles later without restructuring.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,        -- phone is the primary identifier here (mobile money + SMS friendly)
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'rider', 'vendor_owner', 'admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vendors: restaurants/shops. Owned by a user with role = vendor_owner.
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  phone TEXT,
  is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Products: menu items belonging to a vendor.
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),  -- store money as integer cents, never float
  is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Orders: the central transaction record.
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  rider_id INTEGER REFERENCES users(id),              -- nullable: no rider assigned yet
  status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN (
    'placed', 'confirmed', 'preparing', 'ready_for_pickup',
    'rider_assigned', 'picked_up', 'delivered', 'cancelled'
  )),
  delivery_address TEXT NOT NULL,
  delivery_latitude REAL,
  delivery_longitude REAL,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Order line items. Price is COPIED at order time — never recalculated from products table,
-- so a later price change at the vendor doesn't rewrite history.
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,           -- snapshot, in case product is renamed/deleted later
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0)
);

-- Payments: one row per payment attempt. An order could have multiple rows
-- if a payment fails and is retried.
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  method TEXT NOT NULL CHECK (method IN ('mobile_money', 'cash')),
  provider TEXT CHECK (provider IN ('mpesa', 'emola', NULL)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  provider_transaction_ref TEXT,        -- the ID M-Pesa/e-Mola gives back
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for the lookups we'll do constantly
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_rider ON orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
