// The full set of states an order can be in — must match the CHECK constraint
// on orders.status in schema.sql exactly, or the database will reject a transition
// that our TypeScript thinks is valid.
export type OrderStatus =
  | "placed"
  | "confirmed"
  | "preparing"
  | "ready_for_pickup"
  | "rider_assigned"
  | "picked_up"
  | "delivered"
  | "cancelled";

// The state machine itself: a map from "current status" to "the set of statuses
// it's legally allowed to move to next". This is the single source of truth for
// what transitions are valid — both the route layer and service layer consult this
// instead of each having their own copy of the rules.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["rider_assigned", "cancelled"],
  rider_assigned: ["picked_up", "cancelled"],
  picked_up: ["delivered"], // once picked up, the only forward path is delivered — no cancelling mid-delivery
  delivered: [], // terminal state — no transitions out
  cancelled: [], // terminal state — no transitions out
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function getAllowedNextStatuses(from: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
