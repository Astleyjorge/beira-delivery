import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  getAllBikes,
  getBikeById,
  createBike,
  updateBike,
  BikeAlreadyExistsError,
  BikeNotFoundError,
} from "../services/bikeService";
import { requireRole } from "../middleware/auth";

export const bikesRouter = Router();

// All bike management is admin-only — these are company assets.

// GET /api/bikes — list the whole fleet
bikesRouter.get("/", requireRole("admin"), (_req: Request, res: Response) => {
  res.json(getAllBikes());
});

// GET /api/bikes/:id
bikesRouter.get("/:id", requireRole("admin"), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Bike id must be a number" });
    return;
  }

  const bike = getBikeById(id);
  if (!bike) {
    res.status(404).json({ error: `Bike ${id} not found` });
    return;
  }

  res.json(bike);
});

const createBikeSchema = z.object({
  plate: z.string().min(1, "plate is required"),
});

// POST /api/bikes — add a bike to the fleet
bikesRouter.post("/", requireRole("admin"), (req: Request, res: Response) => {
  const parseResult = createBikeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid bike data", details: parseResult.error.issues });
    return;
  }

  try {
    const bike = createBike(parseResult.data);
    res.status(201).json(bike);
  } catch (err) {
    if (err instanceof BikeAlreadyExistsError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

const updateBikeSchema = z.object({
  plate: z.string().min(1).optional(),
  status: z.enum(["active", "maintenance", "retired"]).optional(),
});

// PATCH /api/bikes/:id — update a bike (e.g. send to maintenance, retire it)
bikesRouter.patch("/:id", requireRole("admin"), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Bike id must be a number" });
    return;
  }

  const parseResult = updateBikeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid bike data", details: parseResult.error.issues });
    return;
  }

  try {
    const bike = updateBike(id, parseResult.data);
    res.json(bike);
  } catch (err) {
    if (err instanceof BikeNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});
