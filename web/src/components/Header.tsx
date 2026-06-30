import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export function Header() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 border-b border-[#0c2b2e]/8 bg-[#0c2b2e]">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-xl font-bold tracking-tight text-[#f0e6d2]">
          beira<span className="text-[#e8704a]">.</span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Cart link with a badge showing item count */}
          <Link
            to="/cart"
            className="relative rounded-lg px-3 py-1.5 text-sm font-medium text-[#f0e6d2] transition hover:bg-white/10"
          >
            Cart
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#e8704a] text-xs font-bold text-white">
                {itemCount}
              </span>
            )}
          </Link>

          <Link
            to="/orders"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#f0e6d2] transition hover:bg-white/10"
          >
            Orders
          </Link>

          {user && (
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#8fb0ac] transition hover:bg-white/10"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
