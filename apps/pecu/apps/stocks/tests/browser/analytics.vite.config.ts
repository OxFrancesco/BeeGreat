import { mergeConfig } from "vite";
import { fileURLToPath } from "node:url";
import fixture from "./vite.config";
export default mergeConfig(fixture, {
  base: "/pecu-nansen-charts/demo/",
  build: {
    outDir: fileURLToPath(new URL("../../../../../../reports/pecu-nansen-charts/public/pecu-nansen-charts/demo", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL("./analytics.html", import.meta.url)) },
  },
});
