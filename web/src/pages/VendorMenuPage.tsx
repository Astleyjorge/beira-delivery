import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Vendor, Product } from "../types";
import { Header } from "../components/Header";
import { useCart } from "../context/CartContext";
import { formatMetical } from "../lib/format";

export function VendorMenuPage() {
  // useParams reads the :id from the URL (/vendors/5 → id = "5")
  const { id } = useParams<{ id: string }>();
  const vendorId = Number(id);

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { addItem, items } = useCart();

  useEffect(() => {
    // Fetch the vendor and its products in parallel — both requests fire at
    // once and we wait for both, rather than one after the other.
    Promise.all([api.getVendor(vendorId), api.getProducts(vendorId)])
      .then(([v, p]) => {
        setVendor(v);
        setProducts(p);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [vendorId]);

  // How many of a given product are already in the cart (for the little count badge)
  function quantityInCart(productId: number): number {
    return items.find((i) => i.product.id === productId)?.quantity ?? 0;
  }

  return (
    <div className="min-h-screen bg-[#faf6ee]">
      <Header />

      <main className="mx-auto max-w-2xl px-4 py-6">
        {loading && <p className="text-[#0c2b2e]/50">Loading menu…</p>}

        {error && (
          <p className="rounded-lg bg-[#e8704a]/15 px-4 py-3 text-[#b8431f]">
            {error}
          </p>
        )}

        {vendor && (
          <>
            <h2 className="text-2xl font-bold text-[#0c2b2e]">{vendor.name}</h2>
            <p className="mb-6 text-sm text-[#0c2b2e]/60">{vendor.address}</p>

            <div className="space-y-3">
              {products.map((product) => {
                const count = quantityInCart(product.id);
                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-xl border border-[#0c2b2e]/8 bg-white p-4"
                  >
                    <div className="flex-1 pr-4">
                      <h3 className="font-semibold text-[#0c2b2e]">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="mt-0.5 text-sm text-[#0c2b2e]/55">
                          {product.description}
                        </p>
                      )}
                      <p className="mt-1 font-medium text-[#0c2b2e]">
                        {formatMetical(product.priceCents)}
                      </p>
                    </div>

                    {product.isAvailable ? (
                      <button
                        onClick={() => addItem(product)}
                        className="flex items-center gap-1.5 rounded-lg bg-[#0c2b2e] px-4 py-2 text-sm font-medium text-[#f0e6d2] transition hover:bg-[#0c2b2e]/90"
                      >
                        Add
                        {count > 0 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e8704a] text-xs font-bold text-white">
                            {count}
                          </span>
                        )}
                      </button>
                    ) : (
                      <span className="text-sm text-[#0c2b2e]/40">
                        Unavailable
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
