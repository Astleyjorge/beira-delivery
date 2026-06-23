import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/connection";
import type {
  User,
  UserRow,
  RegisterInput,
  LoginInput,
  AuthResponse,
  TokenPayload,
  UserRole,
} from "../types/User";

// How many times bcrypt internally re-hashes the password.
// Higher = slower = harder to brute-force. 12 is the current industry standard:
// slow enough (roughly 300ms) to make guessing millions of passwords infeasible,
// fast enough that a real user logging in doesn't notice.
const BCRYPT_ROUNDS = 12;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}

function mapRowToUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    role: row.role as UserRole,
    createdAt: row.created_at,
  };
}

// Custom error types — same pattern as orderService, so the route layer
// can map each to the right HTTP status without catching a generic Error.
export class UserAlreadyExistsError extends Error {}
export class InvalidCredentialsError extends Error {}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  // Check phone uniqueness first — the DB would also enforce this via UNIQUE constraint,
  // but catching it here lets us give a clear "phone already registered" message
  // instead of a raw SQLite constraint error.
  const existingPhone = db
    .prepare("SELECT id FROM users WHERE phone = ?")
    .get(input.phone) as { id: number } | undefined;

  if (existingPhone) {
    throw new UserAlreadyExistsError(`Phone number ${input.phone} is already registered`);
  }

  if (input.email) {
    const existingEmail = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(input.email) as { id: number } | undefined;

    if (existingEmail) {
      throw new UserAlreadyExistsError(`Email ${input.email} is already registered`);
    }
  }

  // bcrypt.hash is async because bcrypt is deliberately CPU-intensive.
  // Running it synchronously would block the server from handling any other
  // requests for ~300ms — a real problem under load.
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const result = db
    .prepare(
      `INSERT INTO users (name, phone, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(input.name, input.phone, input.email ?? null, passwordHash, input.role);

  const newUser = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as UserRow;

  const user = mapRowToUser(newUser);
  const token = signToken({ userId: user.id, role: user.role });

  return { token, user };
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  if (!input.phone && !input.email) {
    throw new InvalidCredentialsError("Either phone or email is required");
  }

  // Look up user by whichever identifier was provided.
  const row = (
    input.phone
      ? db.prepare("SELECT * FROM users WHERE phone = ?").get(input.phone)
      : db.prepare("SELECT * FROM users WHERE email = ?").get(input.email!)
  ) as UserRow | undefined;

  // IMPORTANT: even when the user doesn't exist, we still call bcrypt.compare
  // against a dummy hash, then throw at the end. This is called a "timing-safe"
  // check. Without it, an attacker could tell whether a phone number is registered
  // by measuring how long the server takes to respond — a registered phone hits
  // the bcrypt compare (slow), an unregistered one would return instantly (fast).
  // Uniform timing removes that information leak.
  const dummyHash = "$2a$12$dummyhashtopreventtimingattacksXXXXXXXXXXXXXXXXXXXXXXX";
  const hashToCheck = row ? row.password_hash : dummyHash;
  const passwordMatches = await bcrypt.compare(input.password, hashToCheck);

  if (!row || !passwordMatches) {
    // Deliberately vague — don't tell the caller whether the phone/email
    // exists or whether the password was wrong. Either leaks information.
    throw new InvalidCredentialsError("Invalid credentials");
  }

  const user = mapRowToUser(row);
  const token = signToken({ userId: user.id, role: user.role });

  return { token, user };
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: "7d", // token expires after 7 days — user must log in again
  });
}

export function verifyToken(token: string): TokenPayload {
  // jwt.verify throws if the token is expired, tampered with, or signed
  // with a different secret. We let that propagate — the middleware catches it.
  const decoded = jwt.verify(token, getJwtSecret());
  return decoded as TokenPayload;
}
