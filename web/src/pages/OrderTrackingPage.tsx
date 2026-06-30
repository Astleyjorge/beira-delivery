import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import type { Order, OrderStatus } from "../types";
import { formatMetical, formatStatus } from "../lib/format";

// The happy-path sequence we show as a progress tracker.
// (cancelled is handled separately since it's not part of normal flow.)
const TRACKED_STEPS: OrderStatus[] = [
  "placed",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "rider_assigned",
  "picked_up",
  "delivered",
];

export function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const { token } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    function loadOrder() {
      api
        .getOrder(token!, orderId)
        .then(setOrder)
        .catch((err) => setError(err.message));
    }

    loadOrder();

    // Poll every 4 seconds so the customer sees status updates without
    // refreshing. This is a simple approach — real apps often use websockets,
    // but polling is perfectly fine to start and much simpler to reason about.
    const interval = setInterval(loadOrder, 4000);

    // Cleanup: stop polling when the user leaves this page. Without this,
    // the interval would keep running forever — a memory leak.
    return () => clearInterval(interval);
  }, [orderId, token]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#faf6ee]">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-6">
          <p className="rounded-lg bg-[#e8704a]/15 px-4 py-3 text-[#b8431f]">
            {error}
          </p>
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#faf6ee]">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-[#0c2b2e]/50">Loading order…</p>
        </main>
      </div>
    );
  }

  const isCancelled = order.status === "cancelled";
  const currentStepIndex = TRACKED_STEPS.indexOf(order.status);

  return (
    <div className="min-h-screen bg-[#faf6ee]">
      <Header />

      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#0c2b2e]">
            Order #{order.id}
          </h2>
          <span className="text-lg font-bold text-[#0c2b2e]">
            {formatMetical(order.totalCents)}
          </span>
        </div>
        <p className="mb-6 text-sm text-[#0c2b2e]/60">
          Delivering to {order.deliveryAddress}
        </p>

        {isCancelled ? (
          <div className="rounded-xl bg-[#e8704a]/15 px-5 py-4 font-medium text-[#b8431f]">
            This order was cancelled.
          </div>
        ) : (
          // Progress tracker — each step lit up if we've reached it.
          <div className="rounded-xl border border-[#0c2b2e]/8 bg-white p-5">
            <ol className="space-y-4">
              {TRACKED_STEPS.map((step, index) => {
                const reached = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                return (
                  <li key={step} className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        reached
                          ? "bg-[#e8704a] text-white"
                          : "bg-[#0c2b2e]/8 text-[#0c2b2e]/40"
                      }`}
                    >
                      {reached ? "✓" : index + 1}
                    </span>
                    <span
                      className={`text-sm ${
                        isCurrent
                          ? "font-semibold text-[#0c2b2e]"
                          : reached
                            ? "text-[#0c2b2e]/70"
                            : "text-[#0c2b2e]/40"
                      }`}
                    >
                      {formatStatus(step)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Order items */}
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#0c2b2e]/50">
            Items
          </h3>
          <div className="rounded-xl border border-[#0c2b2e]/8 bg-white divide-y divide-[#0c2b2e]/8">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-[#0c2b2e]">
                  {item.quantity}× {item.productName}
                </span>
                <span className="text-[#0c2b2e]/70">
                  {formatMetical(item.unitPriceCents * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
