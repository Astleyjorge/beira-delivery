import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { getAllVendors, getVendorById, createVendor } from "../services/vendorService";
import { authenticate } from "../middleware/auth";

export const vendorsRouter = Router();

// GET /api/vendors — public, anyone can browse vendors/restaurants
vendorsRouter.get("/", (_req: Request, res: Response) => {
  res.json(getAllVendors());
});

// GET /api/vendors/:id — public
vendorsRouter.get("/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Vendor id must be a number" });
    return;
  }

  const vendor = getVendorById(id);
  if (!vendor) {
    res.status(404).json({ error: `Vendor ${id} not found` });
    return;
  }

  res.json(vendor);
});

const createVendorSchema = z.object({
  name: z.string().min(1, "name is required"),
  address: z.string().min(1, "address is required"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  phone: z.string().optional(),
});
// Note: ownerId is GONE from the schema — taken from the token, same pattern as customerId in orders.

// POST /api/vendors — create a vendor
// Only vendor_owner or admin roles allowed. ownerId is always the requester's own id.
vendorsRouter.post("/", authenticate, (req: Request, res: Response) => {
  const { userId, role } = req.user!;

  if (role !== "vendor_owner" && role !== "admin") {
    res.status(403).json({ error: "Only vendor owners or admins can create vendors" });
    return;
  }

  const parseResult = createVendorSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid vendor data", details: parseResult.error.issues });
    return;
  }

  // ownerId is always the authenticated user's id — they can't register a
  // vendor on behalf of someone else.
  const vendor = createVendor({ ownerId: userId, ...parseResult.data });
  res.status(201).json(vendor);
});
