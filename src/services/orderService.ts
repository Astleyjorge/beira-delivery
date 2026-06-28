import { db } from "../db/connection";
import type { Order, OrderRow, OrderItem, OrderItemRow, CreateOrderInput } from "../types/Order";
import type { OrderStatus } from "./orderStateMachine";
import { canTransition } from "./orderStateMachine";
import { getProductById } from "./productService";

function mapRowToOrder(row: OrderRow, items: OrderItem[]): Order {
  return {
    id: row.id,
    customerId: row.customer_id,
    vendorId: row.vendor_id,
    riderId: row.rider_id,
    status: row.status as OrderStatus,
    deliveryAddress: row.delivery_address,
    deliveryLatitude: row.delivery_latitude,
    deliveryLongitude: row.delivery_longitude,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  };
}

function mapRowToOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
  };
}

function getOrderItems(orderId: number): OrderItem[] {
  const rows = db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .all(orderId) as unknown as OrderItemRow[];
  return rows.map(mapRowToOrderItem);
}

export function getOrderById(id: number): Order | null {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as unknown as OrderRow | undefined;
  if (!row) return null;
  return mapRowToOrder(row, getOrderItems(id));
}

export function getOrdersByCustomer(customerId: number): Order[] {
  const rows = db
    .prepare("SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC")
    .all(customerId) as unknown as OrderRow[];
  return rows.map((row) => mapRowToOrder(row, getOrderItems(row.id)));
}

// Custom error types let the route layer distinguish "bad request" (400)
// from "not found" (404) from "invalid state transition" (409), instead of
// every failure becoming a generic 500.
export class OrderValidationError extends Error {}
export class ProductNotFoundError extends Error {}

export function createOrder(input: CreateOrderInput): Order {
  if (input.items.length === 0) {
    throw new OrderValidationError("Order must contain at least one item");
  }

  // Look up each product's REAL current price from the database — never trust
  // a price from the client. Also confirms every product actually exists and
  // belongs to the vendor being ordered from.
  const resolvedItems = input.items.map((item) => {
    const product = getProductById(item.productId);
    if (!product) {
      throw new ProductNotFoundError(`Product ${item.productId} not found`);
    }
    if (product.vendorId !== input.vendorId) {
      throw new OrderValidationError(
        `Product ${item.productId} does not belong to vendor ${input.vendorId}`
      );
    }
    if (!product.isAvailable) {
      throw new OrderValidationError(`Product ${item.productId} is not currently available`);
    }
    return {
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPriceCents: product.priceCents,
    };
  });

  const totalCents = resolvedItems.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0
  );

  // node:sqlite's DatabaseSync has no built-in `.transaction()` helper (unlike the
  // better-sqlite3 npm package). We implement the same all-or-nothing guarantee
  // manually: BEGIN starts the transaction, COMMIT makes it permanent, and if
  // anything throws in between, the catch block runs ROLLBACK to undo everything
  // attempted since BEGIN — so a failure partway through never leaves a half-written order.
  db.exec("BEGIN");
  let orderId: number;
  try {
    const orderResult = db
      .prepare(
        `INSERT INTO orders (customer_id, vendor_id, delivery_address, delivery_latitude, delivery_longitude, total_cents)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.customerId,
        input.vendorId,
        input.deliveryAddress,
        input.deliveryLatitude ?? null,
        input.deliveryLongitude ?? null,
        totalCents
      );

    orderId = Number(orderResult.lastInsertRowid);

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price_cents)
       VALUES (?, ?, ?, ?, ?)`
    );

    for (const item of resolvedItems) {
      insertItem.run(orderId, item.productId, item.productName, item.quantity, item.unitPriceCents);
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const created = getOrderById(orderId);
  if (!created) {
    throw new Error("Failed to load order immediately after creation");
  }
  return created;
}

export class InvalidTransitionError extends Error {}

// Moves an order to a new status, but ONLY if the state machine says that move is legal.
export function transitionOrderStatus(orderId: number, toStatus: OrderStatus): Order {
  const order = getOrderById(orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (!canTransition(order.status, toStatus)) {
    throw new InvalidTransitionError(
      `Cannot move order from "${order.status}" to "${toStatus}"`
    );
  }

  db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
    toStatus,
    orderId
  );

  const updated = getOrderById(orderId);
  if (!updated) {
    throw new Error("Failed to load order immediately after status update");
  }
  return updated;
}
