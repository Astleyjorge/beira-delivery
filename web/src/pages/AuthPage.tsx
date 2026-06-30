import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stop the browser's default full-page form submit
    setError(null);
    setLoading(true);

    try {
      const auth =
        mode === "login"
          ? await api.login({ phone, password })
          : await api.register({ name, phone, password, role: "customer" });

      login(auth); // store token + user in context
      navigate("/"); // go to the vendor list
    } catch (err) {
      // Our ApiError carries the backend's message — show it to the user.
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c2b2e] px-4">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-[#f0e6d2]">
            beira<span className="text-[#e8704a]">.</span>
          </h1>
          <p className="mt-1 text-sm text-[#8fb0ac]">Delivery, from your city</p>
        </div>

        <div className="rounded-2xl bg-[#f0e6d2] p-6 shadow-xl">
          {/* Mode toggle */}
          <div className="mb-6 flex rounded-lg bg-[#0c2b2e]/10 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                mode === "login"
                  ? "bg-[#0c2b2e] text-[#f0e6d2]"
                  : "text-[#0c2b2e]/60"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                mode === "register"
                  ? "bg-[#0c2b2e] text-[#f0e6d2]"
                  : "text-[#0c2b2e]/60"
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <Field
                label="Name"
                value={name}
                onChange={setName}
                placeholder="Your name"
              />
            )}
            <Field
              label="Phone"
              value={phone}
              onChange={setPhone}
              placeholder="+258 84 123 4567"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />

            {error && (
              <p className="rounded-md bg-[#e8704a]/15 px-3 py-2 text-sm text-[#b8431f]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#e8704a] py-3 font-semibold text-white transition hover:bg-[#d35f3a] disabled:opacity-60"
            >
              {loading
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// A small reusable input field. Extracting repeated UI into a component
// keeps the form readable and consistent — this is the core idea of React:
// build small pieces, compose them.
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[#0c2b2e]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#0c2b2e]/15 bg-white px-3 py-2.5 text-[#0c2b2e] outline-none focus:border-[#e8704a] focus:ring-2 focus:ring-[#e8704a]/20"
      />
    </label>
  );
}
