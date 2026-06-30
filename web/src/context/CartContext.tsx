import { createContext, useContext, useState, type ReactNode } from "react";
import type { Product } from "../types";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  vendorId: number | null; // a cart can only hold items from ONE vendor at a time
  addItem: (product: Product) => void;
  removeItem: (productId: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  clear: () => void;
  totalCents: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [vendorId, setVendorId] = useState<number | null>(null);

  function addItem(product: Product) {
    // A delivery order can only come from one vendor. If the customer adds an
    // item from a different vendor, we start a fresh cart rather than mixing.
    if (vendorId !== null && vendorId !== product.vendorId) {
      setItems([{ product, quantity: 1 }]);
      setVendorId(product.vendorId);
      return;
    }

    setVendorId(product.vendorId);
    setItems((current) => {
      const existing = current.find((i) => i.product.id === product.id);
      if (existing) {
        // Already in cart — just bump the quantity
        return current.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  function removeItem(productId: number) {
    setItems((current) => {
      const next = current.filter((i) => i.product.id !== productId);
      if (next.length === 0) setVendorId(null);
      return next;
    });
  }

  function setQuantity(productId: number, quantity: number) {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((current) =>
      current.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );
  }

  function clear() {
    setItems([]);
    setVendorId(null);
  }

  // Derived values — computed from items on every render, so they're always
  // in sync. No need to store them in state separately.
  const totalCents = items.reduce(
    (sum, i) => sum + i.product.priceCents * i.quantity,
    0
  );
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        vendorId,
        addItem,
        removeItem,
        setQuantity,
        clear,
        totalCents,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside a CartProvider");
  }
  return ctx;
}
