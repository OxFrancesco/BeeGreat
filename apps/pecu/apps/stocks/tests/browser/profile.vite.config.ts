import { mergeConfig } from "vite";
import { fileURLToPath } from "node:url";
import fixture from "./vite.config";
export default mergeConfig(fixture, {
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL("./profile.html", import.meta.url)),
    },
  },
});
