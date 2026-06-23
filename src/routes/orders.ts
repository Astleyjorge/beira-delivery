import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  getOrderById,
  getOrdersByCustomer,
  createOrder,
  transitionOrderStatus,
  OrderValidationError,
  ProductNotFoundError,
  InvalidTransitionError,
} from "../services/orderService";
import type { OrderStatus } from "../services/orderStateMachine";
import { ForbiddenError } from "../middleware/ForbiddenError";

export const ordersRouter = Router();

// GET /api/orders/:id — fetch one order with its items
// Allowed: the customer who placed it, the assigned rider, admin
ordersRouter.get("/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Order id must be a number" });
    return;
  }

  const order = getOrderById(id);
  if (!order) {
    res.status(404).json({ error: `Order ${id} not found` });
    return;
  }

  const { userId, role } = req.user!;
  const isCustomer = role === "customer" && order.customerId === userId;
  const isAssignedRider = role === "rider" && order.riderId === userId;
  const isAdmin = role === "admin";

  // Vendor owners also have a legitimate reason to see orders placed with them
  // (e.g. to see what they need to prepare). We'll add vendor ownership checks
  // once we add vendor lookup to orders — for now admins cover operational needs.
  if (!isCustomer && !isAssignedRider && !isAdmin) {
    res.status(403).json({ error: "You are not allowed to view this order" });
    return;
  }

  res.json(order);
});

// GET /api/orders?customerId=5 — a customer's order history
// Customers can only see their own. Riders and admins can see anyone's.
ordersRouter.get("/", (req: Request, res: Response) => {
  const customerId = Number(req.query.customerId);
  if (Number.isNaN(customerId)) {
    res.status(400).json({ error: "customerId query parameter is required and must be a number" });
    return;
  }

  const { userId, role } = req.user!;

  if (role === "customer" && userId !== customerId) {
    res.status(403).json({ error: "You can only view your own order history" });
    return;
  }

  res.json(getOrdersByCustomer(customerId));
});

const createOrderSchema = z.object({
  vendorId: z.number().int().positive(),
  deliveryAddress: z.string().min(1, "deliveryAddress is required"),
  deliveryLatitude: z.number().min(-90).max(90).optional(),
  deliveryLongitude: z.number().min(-180).max(180).optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, "Order must contain at least one item"),
});
// Note: customerId is GONE from the schema — we take it from the token, never the body.

// POST /api/orders — place a new order
// Only customers can place orders.
ordersRouter.post("/", (req: Request, res: Response) => {
  const { userId, role } = req.user!;

  if (role !== "customer") {
    res.status(403).json({ error: "Only customers can place orders" });
    return;
  }

  const parseResult = createOrderSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid order data", details: parseResult.error.issues });
    return;
  }

  try {
    // customerId comes from the verified token — not from the body.
    // This is the key fix: a customer can only ever place orders as themselves.
    const order = createOrder({ customerId: userId, ...parseResult.data });
    res.status(201).json(order);
  } catch (err) {
    if (err instanceof ProductNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof OrderValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

const VALID_STATUSES: OrderStatus[] = [
  "placed", "confirmed", "preparing", "ready_for_pickup",
  "rider_assigned", "picked_up", "delivered", "cancelled",
];

const transitionSchema = z.object({
  status: z.enum(VALID_STATUSES as [OrderStatus, ...OrderStatus[]]),
});

// Which roles are allowed to make which transitions.
// This is the single source of truth for "who can push an order to this status."
// Think of it as a second layer on top of the state machine:
// the state machine says "is this transition physically possible from current status",
// this map says "is this user ALLOWED to make it".
const TRANSITION_PERMISSIONS: Record<OrderStatus, string[]> = {
  placed:            [],                          // initial state, set on creation
  confirmed:         ["vendor_owner", "admin"],   // vendor confirms the order
  preparing:         ["vendor_owner", "admin"],   // vendor starts preparing
  ready_for_pickup:  ["vendor_owner", "admin"],   // vendor marks it ready
  rider_assigned:    ["admin"],                   // platform assigns a rider
  picked_up:         ["rider", "admin"],          // rider confirms pickup
  delivered:         ["rider", "admin"],          // rider confirms delivery
  cancelled:         ["customer", "vendor_owner", "admin"], // any party can cancel
};

// PATCH /api/orders/:id/status — move an order to its next status
ordersRouter.patch("/:id/status", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Order id must be a number" });
    return;
  }

  const parseResult = transitionSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid status value", details: parseResult.error.issues });
    return;
  }

  const { role } = req.user!;
  const targetStatus = parseResult.data.status;
  const allowedRoles = TRANSITION_PERMISSIONS[targetStatus];

  if (!allowedRoles.includes(role)) {
    res.status(403).json({
      error: `Your role (${role}) is not allowed to set status to "${targetStatus}"`,
    });
    return;
  }

  try {
    const order = transitionOrderStatus(id, targetStatus);
    res.json(order);
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      res.status(409).json({ error: err.message });
      return;
    }
    if (err instanceof Error && err.message.includes("not found")) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});
