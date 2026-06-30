import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../api/client";
import { formatMetical } from "../lib/format";

export function CartPage() {
  const { items, vendorId, setQuantity, removeItem, totalCents, clear } = useCart();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [address, setAddress] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function placeOrder() {
    if (!token) {
      navigate("/login");
      return;
    }
    if (!address.trim()) {
      setError("Please enter a delivery address");
      return;
    }
    if (vendorId === null || items.length === 0) return;

    setError(null);
    setPlacing(true);

    try {
      const order = await api.placeOrder(token, {
        vendorId,
        deliveryAddress: address,
        // The backend only wants productId + quantity — it computes prices itself.
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
      });

      clear(); // empty the cart
      navigate(`/orders/${order.id}`); // jump to tracking
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not place order");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf6ee]">
      <Header />

      <main className="mx-auto max-w-2xl px-4 py-6">
        <h2 className="mb-6 text-2xl font-bold text-[#0c2b2e]">Your cart</h2>

        {items.length === 0 ? (
          <div className="rounded-xl border border-[#0c2b2e]/8 bg-white p-8 text-center">
            <p className="text-[#0c2b2e]/55">Your cart is empty.</p>
            <button
              onClick={() => navigate("/")}
              className="mt-4 rounded-lg bg-[#0c2b2e] px-5 py-2.5 text-sm font-medium text-[#f0e6d2]"
            >
              Browse restaurants
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between rounded-xl border border-[#0c2b2e]/8 bg-white p-4"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#0c2b2e]">
                      {item.product.name}
                    </h3>
                    <p className="text-sm text-[#0c2b2e]/55">
                      {formatMetical(item.product.priceCents)} each
                    </p>
                  </div>

                  {/* Quantity stepper */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setQuantity(item.product.id, item.quantity - 1)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0c2b2e]/8 font-bold text-[#0c2b2e]"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-medium text-[#0c2b2e]">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          setQuantity(item.product.id, item.quantity + 1)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0c2b2e]/8 font-bold text-[#0c2b2e]"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.product.id)}
                      className="text-sm text-[#e8704a] hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-[#0c2b2e] px-5 py-4 text-[#f0e6d2]">
              <span className="font-medium">Total</span>
              <span className="text-lg font-bold">
                {formatMetical(totalCents)}
              </span>
            </div>

            {/* Delivery address */}
            <div className="mt-6">
              <label className="mb-1 block text-sm font-medium text-[#0c2b2e]">
                Delivery address
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Where should we deliver?"
                className="w-full rounded-lg border border-[#0c2b2e]/15 bg-white px-3 py-2.5 text-[#0c2b2e] outline-none focus:border-[#e8704a] focus:ring-2 focus:ring-[#e8704a]/20"
              />
            </div>

            {error && (
              <p className="mt-3 rounded-md bg-[#e8704a]/15 px-3 py-2 text-sm text-[#b8431f]">
                {error}
              </p>
            )}

            <button
              onClick={placeOrder}
              disabled={placing}
              className="mt-4 w-full rounded-lg bg-[#e8704a] py-3.5 font-semibold text-white transition hover:bg-[#d35f3a] disabled:opacity-60"
            >
              {placing ? "Placing order…" : "Place order"}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
