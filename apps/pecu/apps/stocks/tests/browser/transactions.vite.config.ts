import { mergeConfig } from "vite";
import { fileURLToPath } from "node:url";
import fixture from "./vite.config";
export default mergeConfig(fixture, {
  base: "/pecu-design/transaction-redesign/live/",
  build: {
    outDir: fileURLToPath(
      new URL(
        "../../../../../../reports/pecu-design/public/pecu-design/transaction-redesign/live",
        import.meta.url,
      ),
    ),
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL("./transactions.html", import.meta.url)),
    },
  },
});
