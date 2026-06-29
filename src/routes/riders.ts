import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  getRiderByUserId,
  getAvailableRiders,
  createRiderProfile,
  updateRiderProfile,
  getPendingAssignmentsForRider,
  getAssignmentsByOrder,
  offerOrderToRider,
  respondToAssignment,
  approveRider,
  assignBikeToRider,
  RiderProfileNotFoundError,
  RiderAlreadyRegisteredError,
  AssignmentNotFoundError,
  InvalidAssignmentError,
  RiderNotReadyError,
  BikeAssignmentError,
} from "../services/riderService";
import { requireRole } from "../middleware/auth";
import { ForbiddenError } from "../middleware/ForbiddenError";

export const ridersRouter = Router();

// POST /api/riders/profile — rider registers their profile
// A user with role='rider' must do this after registering before they can receive assignments.
// Same pattern as a vendor_owner creating a vendor after registering.
ridersRouter.post("/profile", requireRole("rider"), (req: Request, res: Response) => {
  const { userId } = req.user!;

  try {
    const rider = createRiderProfile({ userId });
    res.status(201).json(rider);
  } catch (err) {
    if (err instanceof RiderAlreadyRegisteredError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// GET /api/riders/profile — rider views their own profile
ridersRouter.get("/profile", requireRole("rider"), (req: Request, res: Response) => {
  const { userId } = req.user!;
  const rider = getRiderByUserId(userId);

  if (!rider) {
    res.status(404).json({
      error: "Rider profile not found. Create one first with POST /api/riders/profile",
    });
    return;
  }

  res.json(rider);
});

const updateRiderSchema = z.object({
  isAvailable: z.boolean().optional(),
  currentLatitude: z.number().min(-90).max(90).optional(),
  currentLongitude: z.number().min(-180).max(180).optional(),
});

// PATCH /api/riders/profile — rider updates availability and/or location
// This is what the rider app calls when they go online/offline or their GPS moves.
ridersRouter.patch("/profile", requireRole("rider"), (req: Request, res: Response) => {
  const { userId } = req.user!;

  const parseResult = updateRiderSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid rider data", details: parseResult.error.issues });
    return;
  }

  try {
    const rider = updateRiderProfile(userId, parseResult.data);
    res.json(rider);
  } catch (err) {
    if (err instanceof RiderProfileNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof RiderNotReadyError) {
      res.status(403).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// GET /api/riders/available — admin sees which riders are online
ridersRouter.get("/available", requireRole("admin"), (_req: Request, res: Response) => {
  res.json(getAvailableRiders());
});

// PATCH /api/riders/:userId/approve — admin approves a rider to start working
ridersRouter.patch(
  "/:userId/approve",
  requireRole("admin"),
  (req: Request, res: Response) => {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) {
      res.status(400).json({ error: "User id must be a number" });
      return;
    }

    try {
      const rider = approveRider(userId);
      res.json(rider);
    } catch (err) {
      if (err instanceof RiderProfileNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      throw err;
    }
  }
);

const assignBikeSchema = z.object({
  bikeId: z.number().int().positive(),
});

// PATCH /api/riders/:userId/bike — admin assigns a bike to a rider
ridersRouter.patch(
  "/:userId/bike",
  requireRole("admin"),
  (req: Request, res: Response) => {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) {
      res.status(400).json({ error: "User id must be a number" });
      return;
    }

    const parseResult = assignBikeSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "Invalid data", details: parseResult.error.issues });
      return;
    }

    try {
      const rider = assignBikeToRider(userId, parseResult.data.bikeId);
      res.json(rider);
    } catch (err) {
      if (err instanceof RiderProfileNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      if (err instanceof BikeAssignmentError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  }
);

// GET /api/riders/assignments — rider sees their pending assignments
ridersRouter.get("/assignments", requireRole("rider"), (req: Request, res: Response) => {
  const { userId } = req.user!;
  res.json(getPendingAssignmentsForRider(userId));
});

const offerAssignmentSchema = z.object({
  orderId: z.number().int().positive(),
  riderId: z.number().int().positive(),
});

// POST /api/riders/assignments — admin offers an order to a rider
ridersRouter.post(
  "/assignments",
  requireRole("admin"),
  (req: Request, res: Response) => {
    const parseResult = offerAssignmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "Invalid assignment data", details: parseResult.error.issues });
      return;
    }

    try {
      const assignment = offerOrderToRider(
        parseResult.data.orderId,
        parseResult.data.riderId
      );
      res.status(201).json(assignment);
    } catch (err) {
      if (err instanceof InvalidAssignmentError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  }
);

// GET /api/riders/assignments/order/:orderId — see all assignment attempts for an order
// Useful for admin to see history (offered to rider A who rejected, then rider B who accepted)
ridersRouter.get(
  "/assignments/order/:orderId",
  requireRole("admin"),
  (req: Request, res: Response) => {
    const orderId = Number(req.params.orderId);
    if (Number.isNaN(orderId)) {
      res.status(400).json({ error: "Order id must be a number" });
      return;
    }
    res.json(getAssignmentsByOrder(orderId));
  }
);

const respondSchema = z.object({
  response: z.enum(["accepted", "rejected"]),
});

// PATCH /api/riders/assignments/:id — rider accepts or rejects an assignment
ridersRouter.patch(
  "/assignments/:id",
  requireRole("rider"),
  (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Assignment id must be a number" });
      return;
    }

    const parseResult = respondSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "Invalid response", details: parseResult.error.issues });
      return;
    }

    const { userId } = req.user!;

    try {
      const assignment = respondToAssignment(id, userId, parseResult.data.response);
      res.json(assignment);
    } catch (err) {
      if (err instanceof AssignmentNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      if (err instanceof InvalidAssignmentError) {
        res.status(409).json({ error: err.message });
        return;
      }
      if (err instanceof ForbiddenError) {
        res.status(403).json({ error: err.message });
        return;
      }
      throw err;
    }
  }
);
