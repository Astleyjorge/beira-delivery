import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  payForOrder,
  refreshPaymentStatus,
  getPaymentsByOrder,
  OrderNotFoundError,
  PaymentRejectedError,
} from "../services/paymentService";
import { getOrderById } from "../services/orderService";
import { FakePaymentProvider } from "../services/payments/FakePaymentProvider";
import { MpesaPaymentProvider } from "../services/payments/MpesaPaymentProvider";
import type { IPaymentProvider } from "../services/payments/IPaymentProvider";

export const paymentsRouter = Router();

// ─── Switch providers here ────────────────────────────────────────────────
// To use the real M-Pesa API (once you have the Public Key from the portal):
//   const provider: IPaymentProvider = MpesaPaymentProvider.fromEnv();
// To keep using the fake provider for local development:
//   const provider: IPaymentProvider = new FakePaymentProvider();
const provider: IPaymentProvider = new FakePaymentProvider();

const initiatePaymentSchema = z.object({
  orderId: z.number().int().positive(),
  customerPhone: z.string().min(9, "customerPhone looks too short"),
});

// POST /api/payments — initiate payment for an order
// Only the customer who owns the order can pay for it.
paymentsRouter.post("/", async (req: Request, res: Response) => {
  const parseResult = initiatePaymentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid payment request", details: parseResult.error.issues });
    return;
  }

  const { orderId, customerPhone } = parseResult.data;
  const { userId, role } = req.user!;

  // Load the order first so we can check ownership.
  const order = getOrderById(orderId);
  if (!order) {
    res.status(404).json({ error: `Order ${orderId} not found` });
    return;
  }

  // Only the customer who placed this specific order can pay for it.
  // Admins can also trigger payments (e.g. for support/reconciliation purposes).
  if (role === "customer" && order.customerId !== userId) {
    res.status(403).json({ error: "You can only pay for your own orders" });
    return;
  }

  if (role !== "customer" && role !== "admin") {
    res.status(403).json({ error: "Only customers or admins can initiate payments" });
    return;
  }

  try {
    const payment = await payForOrder(orderId, customerPhone, provider);
    res.status(201).json(payment);
  } catch (err) {
    if (err instanceof OrderNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof PaymentRejectedError) {
      res.status(402).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/payments?orderId=5 — list payment attempts for an order
// Only the order's customer or an admin can see payment records.
paymentsRouter.get("/", (req: Request, res: Response) => {
  const orderId = Number(req.query.orderId);
  if (Number.isNaN(orderId)) {
    res.status(400).json({ error: "orderId query parameter is required and must be a number" });
    return;
  }

  const { userId, role } = req.user!;

  const order = getOrderById(orderId);
  if (!order) {
    res.status(404).json({ error: `Order ${orderId} not found` });
    return;
  }

  if (role === "customer" && order.customerId !== userId) {
    res.status(403).json({ error: "You can only view payments for your own orders" });
    return;
  }

  if (role !== "customer" && role !== "admin") {
    res.status(403).json({ error: "Only customers or admins can view payment records" });
    return;
  }

  res.json(getPaymentsByOrder(orderId));
});

// POST /api/payments/:id/refresh — poll provider for updated status
// Same ownership rule: only the order's customer or admin.
paymentsRouter.post("/:id/refresh", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Payment id must be a number" });
    return;
  }

  const { userId, role } = req.user!;

  // We need to find which order this payment belongs to, then check ownership.
  const { getPaymentById } = await import("../services/paymentService");
  const payment = getPaymentById(id);
  if (!payment) {
    res.status(404).json({ error: `Payment ${id} not found` });
    return;
  }

  const order = getOrderById(payment.orderId);
  if (!order) {
    res.status(404).json({ error: "Associated order not found" });
    return;
  }

  if (role === "customer" && order.customerId !== userId) {
    res.status(403).json({ error: "You can only refresh payments for your own orders" });
    return;
  }

  if (role !== "customer" && role !== "admin") {
    res.status(403).json({ error: "Only customers or admins can refresh payment status" });
    return;
  }

  try {
    const updated = await refreshPaymentStatus(id, provider);
    res.json(updated);
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Payment not found" });
  }
});
