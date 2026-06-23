import type { OrderStatus } from "../services/orderStateMachine";

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Order {
  id: number;
  customerId: number;
  vendorId: number;
  riderId: number | null;
  status: OrderStatus;
  deliveryAddress: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[]; // populated when fetching a single order with its line items
}

// What a client sends to PLACE an order. Notice: NO totalCents, NO unitPriceCents.
// The client only says WHAT they want (productId + quantity); the server looks up
// real prices and computes the total itself. This is a deliberate security boundary —
// never trust a price or total coming from the client.
export interface CreateOrderInput {
  customerId: number;
  vendorId: number;
  deliveryAddress: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  items: { productId: number; quantity: number }[];
}

export interface OrderRow {
  id: number;
  customer_id: number;
  vendor_id: number;
  rider_id: number | null;
  status: string;
  delivery_address: string;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  total_cents: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
}
