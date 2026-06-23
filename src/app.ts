import express from "express";
import type { Request, Response, NextFunction } from "express";
import { vendorsRouter } from "./routes/vendors";
import { productsRouter } from "./routes/products";
import { ordersRouter } from "./routes/orders";
import { paymentsRouter } from "./routes/payments";
import { authRouter } from "./routes/auth";

import { authenticate } from "./middleware/auth";

export const app = express();

// Parses incoming JSON request bodies into req.body as a JS object.
// Without this, req.body would be undefined for any POST/PUT with a JSON payload.
app.use(express.json());

// Simple request logger — helps you see what's hitting the server while developing.
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check — useful to confirm the server is alive, e.g. for deployment platforms
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Public routes — no token required
app.use("/api/auth", authRouter);
app.use("/api/vendors", vendorsRouter);
app.use("/api/vendors/:vendorId/products", productsRouter);

// Protected routes — authenticate middleware runs first, then the route handler.
// If the token is missing or invalid, authenticate sends a 401 and the handler never runs.
app.use("/api/orders", authenticate, ordersRouter);
app.use("/api/payments", authenticate, paymentsRouter);

// 404 handler — runs if no route above matched
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

// Error handler — must have 4 params (err, req, res, next) for Express to recognize it as one.
// Any time a route handler throws or calls next(err), execution lands here.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
