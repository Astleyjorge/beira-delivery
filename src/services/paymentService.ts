import { db } from "../db/connection";
import type { Payment, PaymentRow } from "../types/Payment";
import type { IPaymentProvider } from "./payments/IPaymentProvider";
import { getOrderById } from "./orderService";

function mapRowToPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    orderId: row.order_id,
    method: row.method as Payment["method"],
    provider: row.provider as Payment["provider"],
    status: row.status as Payment["status"],
    amountCents: row.amount_cents,
    providerTransactionRef: row.provider_transaction_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getPaymentById(id: number): Payment | null {
  const row = db.prepare("SELECT * FROM payments WHERE id = ?").get(id) as unknown as PaymentRow | undefined;
  return row ? mapRowToPayment(row) : null;
}

export function getPaymentsByOrder(orderId: number): Payment[] {
  const rows = db
    .prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC")
    .all(orderId) as unknown as PaymentRow[];
  return rows.map(mapRowToPayment);
}

function insertPaymentAttempt(
  orderId: number,
  amountCents: number,
  provider: IPaymentProvider
): Payment {
  const result = db
    .prepare(
      `INSERT INTO payments (order_id, method, provider, status, amount_cents)
       VALUES (?, 'mobile_money', ?, 'pending', ?)`
    )
    .run(orderId, provider.providerName, amountCents);

  const payment = getPaymentById(Number(result.lastInsertRowid));
  if (!payment) throw new Error("Failed to load payment immediately after creation");
  return payment;
}

export class OrderNotFoundError extends Error {}
export class PaymentRejectedError extends Error {}

// This is the function order routes will call. It doesn't know or care whether
// `provider` is the fake one, M-Pesa, or e-Mola — it just calls the interface.
// Notice: `async` here, because it calls `provider.initiatePayment`, which is
// itself async (see IPaymentProvider.ts). Any function that awaits something
// must itself be declared async — that's a TypeScript/JS rule, not a style choice.
export async function payForOrder(
  orderId: number,
  customerPhone: string,
  provider: IPaymentProvider
): Promise<Payment> {
  const order = getOrderById(orderId);
  if (!order) {
    throw new OrderNotFoundError(`Order ${orderId} not found`);
  }

  // Create the payment row as "pending" FIRST, before calling the provider.
  // This matters: if our server crashes right after the provider accepts the
  // request but before we save anything, we'd have a real pending payment
  // with NO record of it on our side — an unreconciled transaction.
  // Recording intent before the external call is the safer order of operations.
  const payment = insertPaymentAttempt(orderId, order.totalCents, provider);

  // This is where the actual await happens — execution pauses here until the
  // (fake, or eventually real) provider responds, without blocking the server
  // from handling other requests in the meantime.
  const result = await provider.initiatePayment({
    orderId,
    amountCents: order.totalCents,
    customerPhone,
  });

  if (result.status === "rejected") {
    db.prepare(`UPDATE payments SET status = 'failed', updated_at = datetime('now') WHERE id = ?`).run(
      payment.id
    );
    throw new PaymentRejectedError(result.message ?? "Payment was rejected by the provider");
  }

  db.prepare(
    `UPDATE payments SET provider_transaction_ref = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(result.providerTransactionRef, payment.id);

  const updated = getPaymentById(payment.id);
  if (!updated) throw new Error("Failed to load payment after provider response");
  return updated;
}

// Polls the provider for the latest status and updates our record to match.
// This is what you'd call periodically, or in response to the provider's webhook,
// to find out if the customer actually approved the payment on their phone.
export async function refreshPaymentStatus(
  paymentId: number,
  provider: IPaymentProvider
): Promise<Payment> {
  const payment = getPaymentById(paymentId);
  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }
  if (!payment.providerTransactionRef) {
    throw new Error(`Payment ${paymentId} has no provider transaction reference yet`);
  }

  const statusResult = await provider.checkStatus(payment.providerTransactionRef);

  db.prepare(`UPDATE payments SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
    statusResult.status,
    paymentId
  );

  const updated = getPaymentById(paymentId);
  if (!updated) throw new Error("Failed to load payment after status refresh");
  return updated;
}
