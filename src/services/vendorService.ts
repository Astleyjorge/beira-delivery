import { db } from "../db/connection";
import type { Vendor, VendorRow, CreateVendorInput } from "../types/Vendor";

// Converts a raw database row (snake_case, 0/1 booleans) into our app-level Vendor type.
function mapRowToVendor(row: VendorRow): Vendor {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    phone: row.phone,
    isOpen: row.is_open === 1,
    createdAt: row.created_at,
  };
}

export function getAllVendors(): Vendor[] {
  // .prepare() compiles the SQL once; .all() runs it and returns every matching row.
  const rows = db.prepare("SELECT * FROM vendors ORDER BY created_at DESC").all() as unknown as VendorRow[];
  return rows.map(mapRowToVendor);
}

export function getVendorById(id: number): Vendor | null {
  // .get() returns a single row, or undefined if nothing matched.
  const row = db.prepare("SELECT * FROM vendors WHERE id = ?").get(id) as unknown as VendorRow | undefined;
  return row ? mapRowToVendor(row) : null;
}

export function createVendor(input: CreateVendorInput): Vendor {
  // The `?` placeholders are parameter bindings, NOT string concatenation.
  // This is what prevents SQL injection: even if `input.name` contained something
  // like `'; DROP TABLE vendors; --`, it would be treated as plain text data,
  // never as part of the SQL command itself.
  const result = db
    .prepare(
      `INSERT INTO vendors (owner_id, name, address, latitude, longitude, phone)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.ownerId,
      input.name,
      input.address,
      input.latitude ?? null,
      input.longitude ?? null,
      input.phone ?? null
    );

  // result.lastInsertRowid is the auto-generated id of the row we just created.
  const newVendor = getVendorById(Number(result.lastInsertRowid));
  if (!newVendor) {
    // This should be unreachable in practice — we just inserted the row —
    // but TypeScript doesn't know that, and defensive code here is cheap insurance.
    throw new Error("Failed to load vendor immediately after creation");
  }
  return newVendor;
}
