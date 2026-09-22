import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: fileURLToPath(new URL("../../public", import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)), "@clerk/tanstack-react-start": fileURLToPath(new URL("./cards-clerk.tsx", import.meta.url)) } },
  plugins: [tailwindcss(), react()],
  server: { host: "127.0.0.1", port: 5198, strictPort: true },
});
