import { db } from "../db/connection";
import type { Product, ProductRow, CreateProductInput, UpdateProductInput } from "../types/Product";

function mapRowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    isAvailable: row.is_available === 1,
    createdAt: row.created_at,
  };
}

// Products are always viewed in the context of a vendor (a menu belongs to a restaurant),
// so "get all products" is scoped by vendorId rather than truly global like vendors were.
export function getProductsByVendor(vendorId: number): Product[] {
  const rows = db
    .prepare("SELECT * FROM products WHERE vendor_id = ? ORDER BY created_at DESC")
    .all(vendorId) as ProductRow[];
  return rows.map(mapRowToProduct);
}

export function getProductById(id: number): Product | null {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as ProductRow | undefined;
  return row ? mapRowToProduct(row) : null;
}

export function createProduct(input: CreateProductInput): Product {
  const result = db
    .prepare(
      `INSERT INTO products (vendor_id, name, description, price_cents)
       VALUES (?, ?, ?, ?)`
    )
    .run(input.vendorId, input.name, input.description ?? null, input.priceCents);

  const newProduct = getProductById(Number(result.lastInsertRowid));
  if (!newProduct) {
    throw new Error("Failed to load product immediately after creation");
  }
  return newProduct;
}

// Partial update: only touches the fields that were actually provided.
// This is the new pattern compared to vendorService — worth reading carefully.
export function updateProduct(id: number, input: UpdateProductInput): Product | null {
  // Build the SET clause and matching values dynamically, based on which
  // fields were actually passed in. Each entry is one "column = ?" piece.
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (input.name !== undefined) {
    fields.push("name = ?");
    values.push(input.name);
  }
  if (input.description !== undefined) {
    fields.push("description = ?");
    values.push(input.description);
  }
  if (input.priceCents !== undefined) {
    fields.push("price_cents = ?");
    values.push(input.priceCents);
  }
  if (input.isAvailable !== undefined) {
    fields.push("is_available = ?");
    values.push(input.isAvailable ? 1 : 0);
  }

  // Nothing to update — return the product unchanged rather than running an empty/invalid query.
  if (fields.length === 0) {
    return getProductById(id);
  }

  // values.push(id) at the end because the WHERE clause's `?` is the last placeholder
  // in the full query string below.
  values.push(id);

  db.prepare(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  return getProductById(id);
}
