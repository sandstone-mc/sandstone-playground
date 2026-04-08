# Sandstone Playground

Browser-based interactive playground for sandstone. Powers the live code snippets in the documentation site.

## Build Commands

```bash
bun run build    # Build with Vite, then type-check with tsc
bun run dev      # Vite dev server (for local testing)
```

Output: `dist/main.js` (~15MB, includes esbuild-wasm)

## Architecture

The playground compiles user TypeScript code in the browser using esbuild-wasm, with sandstone loaded as an external module.

### Key Files

| File | Purpose |
|------|---------|
| `src/main.ts` | Main entry - exports `compilePack()`, `configure()`, `DEFAULT_SANDSTONE_PATH` |
| `src/assets/runtimeWrapper.ts` | Wraps user code, sets up context, calls `sandstonePack.save()` |
| `src/assets/index.d.ts` | Type declaration for the virtual `./index.ts` module |

### Compilation Flow

1. `compilePack({ "/index.ts": userCode })` is called
2. esbuild-wasm initializes (downloads wasm binary on first call)
3. Sandstone bundle is fetched from `/playground/sandstone.esm.js` and cached as blob URL
4. esbuild compiles user code with `external: ["sandstone"]`
5. Output has `from "sandstone"` replaced with the blob URL
6. Compiled code runs in a Web Worker via dynamic import
7. Worker executes runtimeWrapper which:
   - Sets up `SandstoneContext` (namespace, packUid, packOptions)
   - Calls `resetSandstonePack()` to match CLI behavior
   - Dynamically imports user code (so context is set first)
   - Calls `sandstonePack.save()` with a custom fileHandler
8. Generated files are returned to the main thread

### Why Sandstone is External

The sandstone bundle (`sandstone.esm.js`) must NOT be processed by any bundler:
- The `fix-esm-init-order` script in sandstone fixes class initialization order
- If esbuild re-processes it, classes get reordered and break in browsers
- V8/SpiderMonkey enforce temporal dead zone strictly (unlike JavaScriptCore/Bun)

## Configuration

The playground can be configured before calling `compilePack()`:

```ts
import { compilePack, configure } from "@sandstone-mc/playground";

configure({
  sandstonePath: "/custom/path/sandstone.esm.js"
});

const result = await compilePack({ "/index.ts": code });
```

Default sandstone path: `/playground/sandstone.esm.js`

## Integration with Documentation

The documentation site (`sandstone-documentation`) uses this playground:

1. Copy built files to `static/playground/`:
   - `sandstone-playground/dist/main.js` → `static/playground/main.js`
   - `sandstone/dist/browser/sandstone.esm.js` → `static/playground/sandstone.esm.js`

2. Documentation loads playground dynamically:
   ```ts
   const lib = await import(/* webpackIgnore: true */ "/playground/main.js");
   const result = await lib.compilePack({ "/index.ts": userCode });
   ```

3. The `/* webpackIgnore: true */` comment prevents Docusaurus from bundling it

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

## Updating After Sandstone Changes

When sandstone's source changes:

1. Rebuild sandstone: `cd ../sandstone && bun dev:build`
2. Copy browser bundle: `cp ../sandstone/dist/browser/sandstone.esm.js ../sandstone-documentation/static/playground/`

When playground's source changes:

1. Rebuild playground: `bun run build`
2. Copy to docs: `cp dist/main.js ../sandstone-documentation/static/playground/`

## Virtual Modules

The playground uses virtual modules resolved by esbuild plugins:

| Module | Resolution |
|--------|------------|
| `sandstone` | External - replaced with blob URL at build time |
| `browser-shims` | Inline shim setting up `globalThis.global` and `process.env` |
| `node-fetch` | Inline shim: `export default fetch` |
| `./index.ts` | User code from the `fs` parameter |
