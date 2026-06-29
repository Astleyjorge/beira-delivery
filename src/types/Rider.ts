export type AssignmentStatus = "offered" | "accepted" | "rejected";

export interface Rider {
  id: number;
  userId: number;
  isApproved: boolean;
  isAvailable: boolean;
  bikeId: number | null;
  currentLatitude: number | null;
  currentLongitude: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RiderRow {
  id: number;
  user_id: number;
  is_approved: number;
  is_available: number;
  bike_id: number | null;
  current_latitude: number | null;
  current_longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface RiderAssignment {
  id: number;
  orderId: number;
  riderId: number;
  status: AssignmentStatus;
  offeredAt: string;
  respondedAt: string | null;
}

export interface RiderAssignmentRow {
  id: number;
  order_id: number;
  rider_id: number;
  status: string;
  offered_at: string;
  responded_at: string | null;
}

// What gets created when a rider registers their profile
export interface CreateRiderProfileInput {
  userId: number;
}

// Rider updating their own availability and location
export interface UpdateRiderInput {
  isAvailable?: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
}
