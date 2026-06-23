import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  register,
  login,
  UserAlreadyExistsError,
  InvalidCredentialsError,
} from "../services/authService";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(1, "name is required"),
  phone: z.string().min(9, "phone number looks too short"),
  email: z.string().email("must be a valid email").optional(),
  password: z.string().min(8, "password must be at least 8 characters"),
  role: z.enum(["customer", "rider", "vendor_owner"]),
  // Note: "admin" is not in the allowed registration roles.
  // Admin accounts are created manually by the platform operator, not via public signup.
});

// POST /api/auth/register
authRouter.post("/register", async (req: Request, res: Response) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid registration data", details: parseResult.error.issues });
    return;
  }

  try {
    const authResponse = await register(parseResult.data);
    // 201 Created, and the user gets their token immediately —
    // no separate login step needed right after signing up.
    res.status(201).json(authResponse);
  } catch (err) {
    if (err instanceof UserAlreadyExistsError) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login accepts phone OR email — at least one required
const loginSchema = z
  .object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    password: z.string().min(1, "password is required"),
  })
  .refine((data) => data.phone || data.email, {
    message: "Either phone or email is required",
    path: ["phone"],
  });

// POST /api/auth/login
authRouter.post("/login", async (req: Request, res: Response) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid login data", details: parseResult.error.issues });
    return;
  }

  try {
    const authResponse = await login(parseResult.data);
    res.json(authResponse);
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      // Always 401, never 404 — don't confirm or deny whether the account exists.
      res.status(401).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
