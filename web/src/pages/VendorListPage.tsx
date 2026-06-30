import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Vendor } from "../types";
import { Header } from "../components/Header";

export function VendorListPage() {
  // Three pieces of state for a data-loading screen — a very common pattern:
  // the data itself, whether we're still loading, and any error.
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch vendors once when the page loads.
  useEffect(() => {
    api
      .getVendors()
      .then(setVendors)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#faf6ee]">
      <Header />

      <main className="mx-auto max-w-2xl px-4 py-6">
        <h2 className="mb-1 text-2xl font-bold text-[#0c2b2e]">
          Order in Beira
        </h2>
        <p className="mb-6 text-sm text-[#0c2b2e]/60">
          Restaurants and shops near you
        </p>

        {loading && <p className="text-[#0c2b2e]/50">Loading restaurants…</p>}

        {error && (
          <p className="rounded-lg bg-[#e8704a]/15 px-4 py-3 text-[#b8431f]">
            {error}
          </p>
        )}

        {!loading && !error && vendors.length === 0 && (
          <p className="text-[#0c2b2e]/50">
            No restaurants are open yet. Check back soon.
          </p>
        )}

        <div className="space-y-3">
          {vendors.map((vendor) => (
            <Link
              key={vendor.id}
              to={`/vendors/${vendor.id}`}
              className="block rounded-xl border border-[#0c2b2e]/8 bg-white p-4 shadow-sm transition hover:border-[#e8704a]/40 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[#0c2b2e]">{vendor.name}</h3>
                  <p className="mt-0.5 text-sm text-[#0c2b2e]/55">
                    {vendor.address}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    vendor.isOpen
                      ? "bg-[#0c2b2e]/8 text-[#0c2b2e]"
                      : "bg-[#0c2b2e]/5 text-[#0c2b2e]/40"
                  }`}
                >
                  {vendor.isOpen ? "Open" : "Closed"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
