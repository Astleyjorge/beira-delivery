import { db } from "../db/connection";
import type {
  Rider,
  RiderRow,
  RiderAssignment,
  RiderAssignmentRow,
  CreateRiderProfileInput,
  UpdateRiderInput,
} from "../types/Rider";
import { getOrderById, transitionOrderStatus } from "./orderService";
import { ForbiddenError } from "../middleware/ForbiddenError";

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function mapRowToRider(row: RiderRow): Rider {
  return {
    id: row.id,
    userId: row.user_id,
    isApproved: row.is_approved === 1,
    isAvailable: row.is_available === 1,
    bikeId: row.bike_id,
    currentLatitude: row.current_latitude,
    currentLongitude: row.current_longitude,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToAssignment(row: RiderAssignmentRow): RiderAssignment {
  return {
    id: row.id,
    orderId: row.order_id,
    riderId: row.rider_id,
    status: row.status as RiderAssignment["status"],
    offeredAt: row.offered_at,
    respondedAt: row.responded_at,
  };
}

// ─── Custom errors ────────────────────────────────────────────────────────────

export class RiderProfileNotFoundError extends Error {}
export class RiderAlreadyRegisteredError extends Error {}
export class AssignmentNotFoundError extends Error {}
export class InvalidAssignmentError extends Error {}
export class RiderNotReadyError extends Error {}

// ─── Rider profile ────────────────────────────────────────────────────────────

export function getRiderByUserId(userId: number): Rider | null {
  const row = db
    .prepare("SELECT * FROM riders WHERE user_id = ?")
    .get(userId) as unknown as RiderRow | undefined;
  return row ? mapRowToRider(row) : null;
}

// In the fleet model, a rider is only truly assignable if they are:
// approved by admin AND marked available AND have a bike assigned.
export function getAvailableRiders(): Rider[] {
  const rows = db
    .prepare(
      `SELECT * FROM riders
       WHERE is_available = 1 AND is_approved = 1 AND bike_id IS NOT NULL`
    )
    .all() as unknown as RiderRow[];
  return rows.map(mapRowToRider);
}

// Admin approves a rider — only after approval can they go online and receive orders.
export function approveRider(userId: number): Rider {
  const rider = getRiderByUserId(userId);
  if (!rider) {
    throw new RiderProfileNotFoundError(`No rider profile found for user ${userId}`);
  }

  db.prepare(
    "UPDATE riders SET is_approved = 1, updated_at = datetime('now') WHERE user_id = ?"
  ).run(userId);

  const updated = getRiderByUserId(userId);
  if (!updated) throw new Error("Failed to load rider after approval");
  return updated;
}

// Admin assigns a bike to a rider (one-to-one).
// The UNIQUE constraint on riders.bike_id means the database itself rejects
// assigning a bike that's already taken — but we check first to give a clear error.
export class BikeAssignmentError extends Error {}

export function assignBikeToRider(userId: number, bikeId: number): Rider {
  const rider = getRiderByUserId(userId);
  if (!rider) {
    throw new RiderProfileNotFoundError(`No rider profile found for user ${userId}`);
  }

  // Confirm the bike exists and is active
  const bike = db
    .prepare("SELECT * FROM bikes WHERE id = ?")
    .get(bikeId) as unknown as { id: number; status: string } | undefined;

  if (!bike) {
    throw new BikeAssignmentError(`Bike ${bikeId} not found`);
  }
  if (bike.status !== "active") {
    throw new BikeAssignmentError(`Bike ${bikeId} is not active (status: ${bike.status})`);
  }

  // Check the bike isn't already assigned to a different rider
  const currentHolder = db
    .prepare("SELECT user_id FROM riders WHERE bike_id = ?")
    .get(bikeId) as unknown as { user_id: number } | undefined;

  if (currentHolder && currentHolder.user_id !== userId) {
    throw new BikeAssignmentError(
      `Bike ${bikeId} is already assigned to another rider`
    );
  }

  db.prepare(
    "UPDATE riders SET bike_id = ?, updated_at = datetime('now') WHERE user_id = ?"
  ).run(bikeId, userId);

  const updated = getRiderByUserId(userId);
  if (!updated) throw new Error("Failed to load rider after bike assignment");
  return updated;
}

// Called when a user with role='rider' registers their rider profile.
// Similar to how a vendor_owner creates a vendor after registering.
export function createRiderProfile(input: CreateRiderProfileInput): Rider {
  const existing = getRiderByUserId(input.userId);
  if (existing) {
    throw new RiderAlreadyRegisteredError(
      `Rider profile already exists for user ${input.userId}`
    );
  }

  const result = db
    .prepare("INSERT INTO riders (user_id) VALUES (?)")
    .run(input.userId);

  // Look up by user_id (not lastInsertRowid) since getRiderByUserId queries on user_id
  const rider = getRiderByUserId(input.userId);
  if (!rider) throw new Error("Failed to load rider immediately after creation");
  return rider;
}

// Rider updates their own availability and/or location.
// This is what a rider calls when they start or end their shift,
// or as their GPS position changes.
export function updateRiderProfile(userId: number, input: UpdateRiderInput): Rider {
  const rider = getRiderByUserId(userId);
  if (!rider) {
    throw new RiderProfileNotFoundError(
      `No rider profile found for user ${userId}. Register as a rider first.`
    );
  }

  // A rider can only mark themselves available if they're approved and have a bike.
  // This stops an unapproved or bike-less rider from appearing in the available pool.
  if (input.isAvailable === true) {
    if (!rider.isApproved) {
      throw new RiderNotReadyError("You must be approved by an admin before going online");
    }
    if (rider.bikeId === null) {
      throw new RiderNotReadyError("You must have a bike assigned before going online");
    }
  }

  const fields: string[] = [];
  const values: (number | string)[] = [];

  if (input.isAvailable !== undefined) {
    fields.push("is_available = ?");
    values.push(input.isAvailable ? 1 : 0);
  }
  if (input.currentLatitude !== undefined) {
    fields.push("current_latitude = ?");
    values.push(input.currentLatitude);
  }
  if (input.currentLongitude !== undefined) {
    fields.push("current_longitude = ?");
    values.push(input.currentLongitude);
  }

  if (fields.length === 0) return rider;

  fields.push("updated_at = datetime('now')");
  values.push(userId);

  db.prepare(`UPDATE riders SET ${fields.join(", ")} WHERE user_id = ?`).run(...values);

  const updated = getRiderByUserId(userId);
  if (!updated) throw new Error("Failed to load rider after update");
  return updated;
}

// ─── Assignment lifecycle ─────────────────────────────────────────────────────

export function getAssignmentById(id: number): RiderAssignment | null {
  const row = db
    .prepare("SELECT * FROM rider_assignments WHERE id = ?")
    .get(id) as unknown as RiderAssignmentRow | undefined;
  return row ? mapRowToAssignment(row) : null;
}

export function getAssignmentsByOrder(orderId: number): RiderAssignment[] {
  const rows = db
    .prepare("SELECT * FROM rider_assignments WHERE order_id = ? ORDER BY offered_at DESC")
    .all(orderId) as unknown as RiderAssignmentRow[];
  return rows.map(mapRowToAssignment);
}

// Assignments offered to a specific rider that are still pending a response.
export function getPendingAssignmentsForRider(riderId: number): RiderAssignment[] {
  const rows = db
    .prepare(
      "SELECT * FROM rider_assignments WHERE rider_id = ? AND status = 'offered' ORDER BY offered_at DESC"
    )
    .all(riderId) as unknown as RiderAssignmentRow[];
  return rows.map(mapRowToAssignment);
}

// Admin offers an order to a specific rider.
// Rules:
// - Order must be in 'ready_for_pickup' status
// - Rider must exist and be available
// - No other 'offered' assignment can be pending for this order
export function offerOrderToRider(orderId: number, riderId: number): RiderAssignment {
  const order = getOrderById(orderId);
  if (!order) {
    throw new InvalidAssignmentError(`Order ${orderId} not found`);
  }

  if (order.status !== "ready_for_pickup") {
    throw new InvalidAssignmentError(
      `Order must be in 'ready_for_pickup' status to assign a rider. Current status: "${order.status}"`
    );
  }

  // Check the rider exists, is approved, has a bike, and is available
  const rider = db
    .prepare("SELECT * FROM riders WHERE user_id = ?")
    .get(riderId) as unknown as RiderRow | undefined;

  if (!rider) {
    throw new InvalidAssignmentError(
      `No rider profile found for user ${riderId}`
    );
  }

  if (rider.is_approved === 0) {
    throw new InvalidAssignmentError(`Rider ${riderId} is not approved`);
  }

  if (rider.bike_id === null) {
    throw new InvalidAssignmentError(`Rider ${riderId} has no bike assigned`);
  }

  if (rider.is_available === 0) {
    throw new InvalidAssignmentError(
      `Rider ${riderId} is not currently available`
    );
  }

  // Check there's no pending offer already for this order
  const pendingOffer = db
    .prepare(
      "SELECT id FROM rider_assignments WHERE order_id = ? AND status = 'offered'"
    )
    .get(orderId) as unknown as { id: number } | undefined;

  if (pendingOffer) {
    throw new InvalidAssignmentError(
      `Order ${orderId} already has a pending offer. Wait for the rider to respond before offering to another.`
    );
  }

  const result = db
    .prepare(
      "INSERT INTO rider_assignments (order_id, rider_id) VALUES (?, ?)"
    )
    .run(orderId, riderId);

  const assignment = getAssignmentById(Number(result.lastInsertRowid));
  if (!assignment) throw new Error("Failed to load assignment after creation");
  return assignment;
}

// Rider accepts or rejects an assignment offered to them.
// On acceptance: order moves to 'rider_assigned', rider_id set on order.
// On rejection: assignment marked rejected, order stays at 'ready_for_pickup'
//               so admin can offer to another rider.
export function respondToAssignment(
  assignmentId: number,
  riderId: number,
  response: "accepted" | "rejected"
): RiderAssignment {
  const assignment = getAssignmentById(assignmentId);
  if (!assignment) {
    throw new AssignmentNotFoundError(`Assignment ${assignmentId} not found`);
  }

  // A rider can only respond to their own assignments
  if (assignment.riderId !== riderId) {
    throw new ForbiddenError("You can only respond to assignments offered to you");
  }

  if (assignment.status !== "offered") {
    throw new InvalidAssignmentError(
      `Assignment has already been ${assignment.status} — cannot respond again`
    );
  }

  db.prepare(
    `UPDATE rider_assignments
     SET status = ?, responded_at = datetime('now')
     WHERE id = ?`
  ).run(response, assignmentId);

  // On acceptance, update the order itself
  if (response === "accepted") {
    // Set rider_id on the order
    db.prepare(
      `UPDATE orders SET rider_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(riderId, assignment.orderId);

    // Transition order status through the state machine
    transitionOrderStatus(assignment.orderId, "rider_assigned");
  }

  const updated = getAssignmentById(assignmentId);
  if (!updated) throw new Error("Failed to load assignment after response");
  return updated;
}
