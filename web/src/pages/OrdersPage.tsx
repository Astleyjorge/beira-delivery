import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Header } from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import type { Order } from "../types";
import { formatMetical, formatStatus } from "../lib/format";

export function OrdersPage() {
  const { user, token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !user) return;
    api
      .getMyOrders(token, user.id)
      .then(setOrders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, user]);

  return (
    <div className="min-h-screen bg-[#faf6ee]">
      <Header />

      <main className="mx-auto max-w-2xl px-4 py-6">
        <h2 className="mb-6 text-2xl font-bold text-[#0c2b2e]">Your orders</h2>

        {loading && <p className="text-[#0c2b2e]/50">Loading…</p>}
        {error && (
          <p className="rounded-lg bg-[#e8704a]/15 px-4 py-3 text-[#b8431f]">
            {error}
          </p>
        )}

        {!loading && orders.length === 0 && (
          <div className="rounded-xl border border-[#0c2b2e]/8 bg-white p-8 text-center">
            <p className="text-[#0c2b2e]/55">You have no orders yet.</p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-lg bg-[#0c2b2e] px-5 py-2.5 text-sm font-medium text-[#f0e6d2]"
            >
              Browse restaurants
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="block rounded-xl border border-[#0c2b2e]/8 bg-white p-4 transition hover:border-[#e8704a]/40"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[#0c2b2e]">
                    Order #{order.id}
                  </h3>
                  <p className="mt-0.5 text-sm text-[#0c2b2e]/55">
                    {formatStatus(order.status)}
                  </p>
                </div>
                <span className="font-medium text-[#0c2b2e]">
                  {formatMetical(order.totalCents)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
