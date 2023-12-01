import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { sandstoneBuild } from "./build-sandstone";
export default sandstoneBuild.then(() =>
  defineConfig({
    plugins: [nodePolyfills()],
    build: {
      lib: {
        entry: "src/main.ts",
        fileName: "main",
        formats: ["es"],
      },
    },
  })
);
