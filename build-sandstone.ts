import { mkdirSync, readdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { build } from "esbuild";
const shims = readdirSync("./web-shim");
// TODO: Env
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
      packFormat: 19,
    },
    resourcepack: {
      description: [
        "A ",
        { text: "Sandstone", color: "gold" },
        " resource pack.",
      ],
      packFormat: 18,
    },
  }),
};
export const sandstoneBuild = build({
  entryPoints: ["sandstone"],
  bundle: true,
  outfile: "./src/assets/sandstone.esm.js",
  platform: "browser",
  plugins: [
    {
      name: "shim",
      setup(plugin) {
        plugin.onResolve({ filter: new RegExp(shims.join("|")) }, (args) => ({
          path: resolve(__dirname, `./web-shim/${args.path}/index.mjs`),
        }));
      },
    },
  ],
  banner: {
    js:
      "(()=>{globalThis.process||={};globalThis.process.env = " +
      JSON.stringify(env) +
      "})();",
  },
  external: [
    "node-fetch",
    "fs-extra",
    "path",
    "crypto",
    "fs",
    "zlib",
    "adm-zip",
    "prismarine-nbt",
  ],
  metafile: true,
  format: "esm",
  minify: true,
}).then((data) => {
  const exports = Object.values(data.metafile.outputs)[0].exports;
  mkdirSync('./dist', { recursive: true })
  writeFileSync(
    "./dist/exports.js",
    "export const exports = " + JSON.stringify(exports) + ";"
  );
});
