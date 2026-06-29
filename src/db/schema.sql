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

-- Bikes: physical delivery vehicles owned by the company (fleet model).
-- Each bike can be assigned to at most one rider (enforced via UNIQUE on riders.bike_id).
CREATE TABLE IF NOT EXISTS bikes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plate TEXT NOT NULL UNIQUE,        -- license plate / asset identifier
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',       -- in service, can be assigned
    'maintenance',  -- temporarily out for repair
    'retired'       -- permanently removed from fleet
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Riders: extends users with role='rider' with delivery-specific fields.
-- Follows the same pattern as vendors (vendor_owner user → vendors row).
CREATE TABLE IF NOT EXISTS riders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  is_approved INTEGER NOT NULL DEFAULT 0 CHECK (is_approved IN (0, 1)), -- admin must approve before riding
  is_available INTEGER NOT NULL DEFAULT 0 CHECK (is_available IN (0, 1)), -- offline by default
  bike_id INTEGER UNIQUE REFERENCES bikes(id), -- nullable + UNIQUE: at most one rider per bike
  current_latitude REAL,
  current_longitude REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Rider assignments: tracks every offer made to a rider for a specific order.
-- Separate from order status so we have a full audit trail:
-- one order can be offered to multiple riders before one accepts.
CREATE TABLE IF NOT EXISTS rider_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  rider_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN (
    'offered',   -- admin offered this order to the rider
    'accepted',  -- rider accepted, becomes the assigned rider
    'rejected'   -- rider declined, admin can offer to someone else
  )),
  offered_at TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_riders_user ON riders(user_id);
CREATE INDEX IF NOT EXISTS idx_riders_available ON riders(is_available);
CREATE INDEX IF NOT EXISTS idx_bikes_status ON bikes(status);
CREATE INDEX IF NOT EXISTS idx_assignments_order ON rider_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_assignments_rider ON rider_assignments(rider_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON rider_assignments(status);
