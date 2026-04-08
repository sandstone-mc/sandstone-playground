/**
 * Extracts export names from the installed sandstone package and writes them to dist/exports.js.
 * This is used by the documentation site to auto-detect which sandstone identifiers to import.
 */
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";

// Find sandstone's main entry point
const sandstoneDir = dirname(require.resolve("sandstone/package.json"));
const indexDts = resolve(sandstoneDir, "dist/exports/index.d.ts");

console.log("[generate-exports] Reading exports from:", indexDts);

const content = readFileSync(indexDts, "utf-8");

// Extract export names from the .d.ts file
// Matches: export { name } and export { name as alias }
const exports: string[] = [];
const exportMatch = content.match(/export\s*\{([^}]+)\}/g);

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

// Deduplicate and sort
const uniqueExports = [...new Set(exports)].sort();

mkdirSync("./dist", { recursive: true });
writeFileSync(
  "./dist/exports.js",
  "export const exports = " + JSON.stringify(uniqueExports) + ";\n"
);

console.log(`[generate-exports] Generated dist/exports.js with ${uniqueExports.length} exports`);
