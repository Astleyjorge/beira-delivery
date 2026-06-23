import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  getProductsByVendor,
  getProductById,
  createProduct,
  updateProduct,
} from "../services/productService";
import { getVendorById } from "../services/vendorService";
import { authenticate } from "../middleware/auth";

export const productsRouter = Router({ mergeParams: true });

// Helper used by both POST and PATCH — confirms the authenticated user
// actually owns the vendor they're trying to modify products for.
function assertVendorOwnership(req: Request, res: Response, vendorId: number): boolean {
  const { userId, role } = req.user!;
  const vendor = getVendorById(vendorId);

  if (!vendor) {
    res.status(404).json({ error: `Vendor ${vendorId} not found` });
    return false;
  }

  // Admins can modify any vendor's products.
  // Vendor owners can only modify their own vendor's products.
  if (role === "admin") return true;

  if (role !== "vendor_owner") {
    res.status(403).json({ error: "Only vendor owners or admins can manage products" });
    return false;
  }

  if (vendor.ownerId !== userId) {
    res.status(403).json({ error: "You can only manage products for your own vendor" });
    return false;
  }

  return true;
}

// GET /api/vendors/:vendorId/products — public, customers need to browse menus
productsRouter.get("/", (req: Request, res: Response) => {
  const vendorId = Number(req.params.vendorId);
  if (Number.isNaN(vendorId)) {
    res.status(400).json({ error: "Vendor id must be a number" });
    return;
  }

  const vendor = getVendorById(vendorId);
  if (!vendor) {
    res.status(404).json({ error: `Vendor ${vendorId} not found` });
    return;
  }

  res.json(getProductsByVendor(vendorId));
});

// GET /api/vendors/:vendorId/products/:id — public
productsRouter.get("/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Product id must be a number" });
    return;
  }

  const product = getProductById(id);
  if (!product) {
    res.status(404).json({ error: `Product ${id} not found` });
    return;
  }

  res.json(product);
});

const createProductSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative("priceCents must be 0 or greater"),
});

// POST /api/vendors/:vendorId/products — add a product
// Requires authentication + must own this vendor (or be admin)
productsRouter.post("/", authenticate, (req: Request, res: Response) => {
  const vendorId = Number(req.params.vendorId);
  if (Number.isNaN(vendorId)) {
    res.status(400).json({ error: "Vendor id must be a number" });
    return;
  }

  // assertVendorOwnership handles the 403/404 response itself if it fails,
  // so we just return early if it returns false.
  if (!assertVendorOwnership(req, res, vendorId)) return;

  const parseResult = createProductSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid product data", details: parseResult.error.issues });
    return;
  }

  const product = createProduct({ vendorId, ...parseResult.data });
  res.status(201).json(product);
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  isAvailable: z.boolean().optional(),
});

// PATCH /api/vendors/:vendorId/products/:id — update a product
// Requires authentication + must own this vendor (or be admin)
productsRouter.patch("/:id", authenticate, (req: Request, res: Response) => {
  const vendorId = Number(req.params.vendorId);
  const id = Number(req.params.id);

  if (Number.isNaN(vendorId) || Number.isNaN(id)) {
    res.status(400).json({ error: "Vendor id and product id must be numbers" });
    return;
  }

  if (!assertVendorOwnership(req, res, vendorId)) return;

  const existing = getProductById(id);
  if (!existing) {
    res.status(404).json({ error: `Product ${id} not found` });
    return;
  }

  const parseResult = updateProductSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid product data", details: parseResult.error.issues });
    return;
  }

  res.json(updateProduct(id, parseResult.data));
});
