import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/authService";
import type { TokenPayload, UserRole } from "../types/User";

// Extend Express's Request type to include our `user` field.
// Without this, TypeScript would error when we write `req.user = ...`
// because the standard Request type doesn't know about that field.
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

// Verifies the JWT and attaches the decoded payload to req.user.
// Routes that use this middleware can then read req.user.userId and req.user.role
// without re-verifying the token themselves.
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Standard JWT convention: token arrives in the Authorization header as "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization header missing or malformed" });
    return;
  }

  const token = authHeader.slice(7); // strip the "Bearer " prefix

  try {
    const payload = verifyToken(token);
    req.user = payload; // attach to request so downstream handlers can use it
    next(); // all good — pass control to the actual route handler
  } catch {
    // jwt.verify throws for expired, tampered, or wrong-secret tokens.
    // We don't tell the caller which specific failure it was — all of them
    // mean "your token is not valid, log in again."
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// A second, composable middleware for role-based authorization.
// Usage: router.delete("/:id", authenticate, requireRole("admin"), handler)
// It must come AFTER authenticate, because it reads req.user which authenticate sets.
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Shouldn't happen if authenticate runs first, but guard anyway.
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      // 403 Forbidden: unlike 401 (not authenticated), 403 means
      // "we know who you are, but you're not allowed to do this."
      res.status(403).json({
        error: `This action requires one of these roles: ${roles.join(", ")}`,
      });
      return;
    }

    next();
  };
}
