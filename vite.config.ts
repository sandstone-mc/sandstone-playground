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
  // Ensure the vendored sandstone bundle is not pre-bundled or transformed
  optimizeDeps: {
    exclude: ["./src/assets/sandstone.esm.js"],
  },
  // Treat the bundle as a static asset (imported with ?raw)
  assetsInclude: ["**/*.esm.js"],
});
