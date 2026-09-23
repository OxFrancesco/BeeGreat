import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/polymarket-showcase/",
  plugins: [tailwindcss(), react()],
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 5198, strictPort: true },
  build: { outDir: fileURLToPath(new URL("../../site/public/polymarket-showcase", import.meta.url)), emptyOutDir: true },
});
