import type {
  AuthResponse,
  Vendor,
  Product,
  Order,
} from "../types";

// A custom error so UI code can catch API failures and read the status code.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// The single function every API call goes through. It:
//  1. Attaches the JWT token (if we have one) to the Authorization header
//  2. Sets the JSON content type
//  3. Throws a typed ApiError on non-2xx responses so callers can handle failures
//
// Centralizing this means no screen has to remember to attach the token or
// parse errors — they just call the typed helpers below.
async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 No Content has no body to parse
  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    // The backend always returns { error: "..." } on failure
    throw new ApiError(response.status, data.error ?? "Request failed");
  }

  return data as T;
}

// ─── Typed API methods ──────────────────────────────────────────────────────
// Each function knows its own return type, so callers get full autocomplete.

export const api = {
  // Auth
  register(input: {
    name: string;
    phone: string;
    email?: string;
    password: string;
    role: string;
  }): Promise<AuthResponse> {
    return request("/api/auth/register", { method: "POST", body: input });
  },

  login(input: {
    phone?: string;
    email?: string;
    password: string;
  }): Promise<AuthResponse> {
    return request("/api/auth/login", { method: "POST", body: input });
  },

  // Vendors (public)
  getVendors(): Promise<Vendor[]> {
    return request("/api/vendors");
  },

  getVendor(id: number): Promise<Vendor> {
    return request(`/api/vendors/${id}`);
  },

  // Products (public)
  getProducts(vendorId: number): Promise<Product[]> {
    return request(`/api/vendors/${vendorId}/products`);
  },

  // Orders (auth required)
  placeOrder(
    token: string,
    input: {
      vendorId: number;
      deliveryAddress: string;
      items: { productId: number; quantity: number }[];
    }
  ): Promise<Order> {
    return request("/api/orders", { method: "POST", body: input, token });
  },

  getOrder(token: string, id: number): Promise<Order> {
    return request(`/api/orders/${id}`, { token });
  },

  getMyOrders(token: string, customerId: number): Promise<Order[]> {
    return request(`/api/orders?customerId=${customerId}`, { token });
  },
};
