import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxy: any request the React app makes to /api/* gets forwarded to the
    // backend running on port 3000. This means in our frontend code we can just
    // call fetch("/api/vendors") without worrying about the full localhost:3000 URL,
    // and it avoids CORS issues during development.
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
