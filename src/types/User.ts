import type { OrderStatus } from "../services/orderStateMachine";

export type UserRole = "customer" | "rider" | "vendor_owner" | "admin";

export interface User {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
}

// The shape of what we encode inside the JWT.
// Deliberately minimal — only what middleware needs to know per request,
// so the token stays small. Full user details come from the DB if needed.
export interface TokenPayload {
  userId: number;
  role: UserRole;
}

export interface RegisterInput {
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: UserRole;
}

export interface LoginInput {
  // At least one of phone or email is required — enforced in the service layer.
  phone?: string;
  email?: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface UserRow {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  password_hash: string;
  role: string;
  created_at: string;
}
