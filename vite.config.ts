import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [nodePolyfills()],
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/main.ts",
      fileName: "main",
      formats: ["es"],
    },
  },
});
