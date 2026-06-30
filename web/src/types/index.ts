// These mirror the shapes the backend returns. Keeping them here means
// the whole frontend gets autocomplete and type-checking on API data —
// the same safety we have on the backend, now end to end.

export type UserRole = "customer" | "rider" | "vendor_owner" | "admin";

export interface User {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Vendor {
  id: number;
  ownerId: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  isOpen: boolean;
  createdAt: string;
}

export interface Product {
  id: number;
  vendorId: number;
  name: string;
  description: string | null;
  priceCents: number;
  isAvailable: boolean;
  createdAt: string;
}

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "preparing"
  | "ready_for_pickup"
  | "rider_assigned"
  | "picked_up"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Order {
  id: number;
  customerId: number;
  vendorId: number;
  riderId: number | null;
  status: OrderStatus;
  deliveryAddress: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}
