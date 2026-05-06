# Sandstone Playground

Browser-based interactive playground for sandstone. Powers the live code snippets in the documentation site.

## Build Commands

```bash
bun run build    # Build with Vite, then type-check with tsc
bun run dev      # Vite dev server (for local testing)
```

Output: `dist/main.js` (~15MB, includes esbuild-wasm)

## Architecture

The playground compiles user TypeScript code in the browser using esbuild-wasm, with sandstone loaded from unpkg at runtime.

### Key Files

| File | Purpose |
|------|---------|
| `src/main.ts` | Main entry - exports `compilePack()`, `configure()`, `DEFAULT_SANDSTONE_PATH` |
| `src/assets/runtimeWrapper.ts` | Wraps user code, sets up context, calls `sandstonePack.save()` |
| `src/assets/index.d.ts` | Type declaration for the virtual `./index.ts` module |

### Compilation Flow

1. `compilePack({ "/index.ts": userCode })` is called
2. esbuild-wasm initializes (downloads wasm binary on first call)
3. Sandstone bundle is fetched from `DEFAULT_SANDSTONE_PATH` and cached as blob URL
4. esbuild compiles user code with `external: ["sandstone"]`
5. Output has `from "sandstone"` replaced with the blob URL
6. Compiled code runs in a Web Worker via dynamic import
7. Worker executes runtimeWrapper which:
   - Sets up `SandstoneContext` (namespace, packUid, packOptions)
   - Calls `resetSandstonePack()` to match CLI behavior
   - Dynamically imports user code (so context is set first)
   - Calls `sandstonePack.save()` with a custom fileHandler
8. Generated files are returned to the main thread

## Configuration

The playground can be configured before calling `compilePack()`:

```ts
import { compilePack, configure } from "@sandstone-mc/playground";

configure({
  sandstonePath: "https://unpkg.com/sandstone@1.0.0-beta.5/dist/browser/sandstone.esm.js"
});

const result = await compilePack({ "/index.ts": code });
```

**Default sandstone path:** `https://unpkg.com/sandstone@beta/dist/browser/sandstone.esm.js`

## Integration with Documentation

The documentation site (`sandstone-documentation`) uses this playground:

1. Compiler loads playground dynamically from unpkg:
   ```ts
   const lib = await import(/* webpackIgnore: true */ "https://unpkg.com/@sandstone-mc/playground@latest/dist/main.js");
   const result = await lib.compilePack({ "/index.ts": userCode });
   ```

2. The `/* webpackIgnore: true */` comment prevents webpack from bundling the URL

3. Monaco intellisense types are loaded separately via the `get-sandstone-files` plugin

## Runtime Environment

The runtimeWrapper sets up a browser-compatible sandstone environment:

```ts
setSandstoneContext({
  workingDir: "/",
  namespace: "default",
  packUid: "plGrNd01",
  packOptions: {
    datapack: { packFormat: 98, description: [...] },
    resourcepack: { packFormat: 79, description: [...] },
  },
});
```

## Virtual Modules

The playground uses virtual modules resolved by esbuild plugins:

| Module | Resolution |
|--------|------------|
| `sandstone` | External - replaced with blob URL at build time |
| `browser-shims` | Inline shim setting up `globalThis.global` and `process.env` |
| `node-fetch` | Inline shim: `export default fetch` |
| `./index.ts` | User code from the `fs` parameter |