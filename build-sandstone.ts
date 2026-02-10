import { readdirSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const shims = readdirSync("./web-shim");

// Map node: prefixed imports to our shims
const shimMap: Record<string, string> = {
  "node:module": resolve(__dirname, "./web-shim/node-module/index.mjs"),
  "node:path": resolve(__dirname, "./web-shim/node-path/index.mjs"),
  util: resolve(__dirname, "./web-shim/util/index.mjs"),
};

// Add directory-based shims
for (const shim of shims) {
  if (!shim.startsWith("node-")) {
    shimMap[shim] = resolve(__dirname, `./web-shim/${shim}/index.mjs`);
  }
}

const env = {
  PROJECT_FOLDERS: JSON.stringify({
    absProjectFolder: "/",
    projectFolder: "/src",
    rootFolder: "/",
    sandstoneConfigFolder: "/",
  }),
  CLI_OPTIONS: JSON.stringify({}),
  WORKING_DIR: "/",
  PACK_OPTIONS: JSON.stringify({
    datapack: {
      description: ["A ", { text: "Sandstone", color: "gold" }, " datapack."],
      packFormat: 98,
    },
    resourcepack: {
      description: [
        "A ",
        { text: "Sandstone", color: "gold" },
        " resource pack.",
      ],
      packFormat: 79,
    },
  }),
};

const banner = `(()=>{globalThis.global||=globalThis;globalThis.process||={};globalThis.process.env=${JSON.stringify(env)}})();`;

export const sandstoneBuild = Bun.build({
  entrypoints: ["sandstone"],
  outdir: "./src/assets",
  naming: "sandstone.esm.js",
  target: "browser",
  format: "esm",
  minify: {
    whitespace: true,
    syntax: true,
    identifiers: false, // Preserve class/function names for visitor pattern
  },
  plugins: [
    {
      name: "shim",
      setup(build) {
        // Handle all shimmed modules
        build.onResolve({ filter: /.*/ }, (args) => {
          const shimPath = shimMap[args.path];
          if (shimPath) {
            return { path: shimPath };
          }
          return undefined;
        });
      },
    },
  ],
  external: [
    "node-fetch",
    "crypto",
    "zlib",
    "adm-zip",
    "prismarine-nbt",
  ],
}).then(async (result) => {
  // Prepend banner to output
  const outputPath = "./src/assets/sandstone.esm.js";
  const content = await Bun.file(outputPath).text();
  await Bun.write(outputPath, banner + content);

  return result;
}).then((result) => {
  if (!result.success) {
    console.error("Build failed:", result.logs);
    throw new Error("Sandstone build failed");
  }

  // Extract exports from the built file
  const outputFile = result.outputs[0];

  // Parse exports from the built ESM
  // Bun doesn't provide metafile like esbuild, so we parse the output
  const code = Bun.file(outputFile.path).text();

  return code;
}).then(async (code) => {
  // Extract export names from the ESM output
  const exportMatch = (await code).match(/export\s*\{([^}]+)\}/g);
  const exports: string[] = [];

  if (exportMatch) {
    for (const match of exportMatch) {
      const inner = match.replace(/export\s*\{/, "").replace(/\}/, "");
      const names = inner.split(",").map((s) => {
        const parts = s.trim().split(/\s+as\s+/);
        return parts[parts.length - 1].trim();
      }).filter(Boolean);
      exports.push(...names);
    }
  }

  mkdirSync("./dist", { recursive: true });
  writeFileSync(
    "./dist/exports.js",
    "export const exports = " + JSON.stringify([...new Set(exports)]) + ";"
  );

  console.log(`[build-sandstone] Built with ${exports.length} exports`);
});
