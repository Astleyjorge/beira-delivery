// Mirrors the `products` table in schema.sql.

export interface Product {
  id: number;
  vendorId: number;
  name: string;
  description: string | null;
  priceCents: number;
  isAvailable: boolean;
  createdAt: string;
}

export interface CreateProductInput {
  vendorId: number;
  name: string;
  description?: string;
  priceCents: number;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  priceCents?: number;
  isAvailable?: boolean;
}

export interface ProductRow {
  id: number;
  vendor_id: number;
  name: string;
  description: string | null;
  price_cents: number;
  is_available: number;
  created_at: string;
}
