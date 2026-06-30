import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { AuthPage } from "./pages/AuthPage";
import { VendorListPage } from "./pages/VendorListPage";
import { VendorMenuPage } from "./pages/VendorMenuPage";
import { CartPage } from "./pages/CartPage";
import { OrderTrackingPage } from "./pages/OrderTrackingPage";
import { OrdersPage } from "./pages/OrdersPage";
import type { ReactNode } from "react";

// A wrapper that only lets logged-in users through. If there's no token,
// it bounces them to the login page. This is how we protect customer-only
// screens on the frontend (the backend enforces it too — never trust the
// frontend alone for security, but this gives a good user experience).
function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    // Providers wrap everything so auth and cart state are available app-wide.
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/" element={<VendorListPage />} />
            <Route path="/vendors/:id" element={<VendorMenuPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route
              path="/orders"
              element={
                <RequireAuth>
                  <OrdersPage />
                </RequireAuth>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <RequireAuth>
                  <OrderTrackingPage />
                </RequireAuth>
              }
            />
            {/* Any unknown URL redirects home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
