import "browser-shims";
import { sandstonePack, resetSandstonePack, setSandstoneContext } from "sandstone";

// Initialize context for browser environment (matches CLI behavior)
setSandstoneContext({
  workingDir: "/",
  namespace: "default",
  packUid: "plGrNd01",
  packOptions: {
    datapack: {
      packFormat: 98,
      description: ["A ", { text: "Sandstone", color: "gold" }, " datapack."],
    },
    resourcepack: {
      packFormat: 79,
      description: ["A ", { text: "Sandstone", color: "gold" }, " resource pack."],
    },
  },
});

// Reset pack state (matches CLI behavior) - this sets _smithed to undefined
resetSandstonePack();

// Dynamic import so context is set first (static imports are hoisted)
await import("./index.ts");

const files: Record<string, string | Buffer> = {};

await sandstonePack.save({
  // Additional parameters
  dry: false,
  verbose: false,

  fileHandler: async (
    relativePath: string,
    content: string | Buffer | Promise<Buffer>
  ) => {
    files[relativePath] = await content;
  },
});

export default files;
