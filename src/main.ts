import { build, initialize } from "esbuild-wasm";
import wasmUrl from "esbuild-wasm/esbuild.wasm?url";
import { resolve } from "path";
import runtimeWrapperCode from "./assets/runtimeWrapper.ts?raw";

let hasBeenInitialized = false;
let sandstoneCode: string | null = null;
let sandstoneBlobUrl: string | null = null;

/** Default path to the sandstone bundle (relative to document root) */
export const DEFAULT_SANDSTONE_PATH = "/playground/sandstone.esm.js";

/** Configuration for the playground */
export interface PlaygroundConfig {
  /** Path or URL to the sandstone.esm.js bundle */
  sandstonePath?: string;
}

let config: PlaygroundConfig = {};

/** Configure the playground before calling compilePack */
export function configure(options: PlaygroundConfig) {
  config = { ...config, ...options };
}

async function loadSandstone(): Promise<string> {
  if (sandstoneCode) return sandstoneCode;

  const path = config.sandstonePath || DEFAULT_SANDSTONE_PATH;
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load sandstone bundle from ${path}: ${response.status}`);
  }
  sandstoneCode = await response.text();
  // Create a blob URL for the sandstone bundle - this URL can be used in worker imports
  sandstoneBlobUrl = URL.createObjectURL(
    new Blob([sandstoneCode], { type: "application/javascript" })
  );
  return sandstoneCode;
}

export async function compilePack(fs: Record<string, string>):Promise<{success:true,files:Record<string,string>}|{success:false,error:string}> {
  if (!hasBeenInitialized) {
    await initialize({
      wasmURL: wasmUrl,
    });
    hasBeenInitialized = true;
  }

  // Ensure sandstone is loaded and blob URL is created
  await loadSandstone();

  const browserShims = `
globalThis.global ||= globalThis;
globalThis.process ||= { env: {} };
export {};
`;
  // Only include small shims - sandstone is loaded separately as external
  const modules: Record<string, string> = {
    "browser-shims": browserShims,
    "node-fetch": "export default fetch",
  };
  const fileExtensions = ["ts", "tsx", "js", "jsx", "json"];
  const result = await build({
    entryPoints: ["<entrypoint>.ts"],
    format: "esm",
    bundle: true,
    // Mark sandstone as external - it will be loaded separately without esbuild processing
    external: ["sandstone"],
    plugins: [
      {
        name: "fs",
        setup(build) {
          build.onResolve({ filter: /./ }, (event) => {
            // Mark sandstone as external - it will be loaded via blob URL
            if (event.path === "sandstone") {
              return { path: "sandstone", external: true };
            }
            if (event.path in modules) {
              return { path: event.path, namespace: "module-resolution" };
            }
            if (event.path === "<entrypoint>.ts")
              return { path: event.path, namespace: "fs-resolution" };
            let file = resolve(event.resolveDir, event.path);
            console.log({ event, file });
            return { path: file, namespace: "fs-resolution" };
          });
          build.onLoad(
            { filter: /.*/, namespace: "fs-resolution" },
            async (event) => {
              if (event.path === "<entrypoint>.ts")
                return { contents: runtimeWrapperCode, loader: "ts" };
              let content: null | string = fs[event.path] || null;
              if (content === null)
                for (let ext of fileExtensions) {
                  if (fs[event.path + "." + ext]) {
                    content = fs[event.path + "." + ext];
                    break;
                  }
                }
              if (content === null) {
                throw new Error(
                  `File not found: ${JSON.stringify(event.path)}`
                );
              }
              console.log({ content, path: event.path });
              return { contents: content, loader: "ts" };
            }
          );
          build.onLoad(
            { filter: /.*/, namespace: "module-resolution" },
            async (event) => {
              return { contents: modules[event.path] || "", loader: "ts" };
            }
          );
        },
      },
    ],
  });

  const [file] = result.outputFiles!;
  let code = file.text;

  // Replace the external sandstone import with the blob URL
  // esbuild outputs: from "sandstone" or from 'sandstone'
  code = code.replace(/from\s*["']sandstone["']/g, `from "${sandstoneBlobUrl}"`);

  const url = URL.createObjectURL(
    new Blob([code], { type: "application/javascript" })
  );

  const workerCode = `import(${JSON.stringify(url)}).then((m) => {
  postMessage({success:true,files:m.default});
}).catch((e) => {
  postMessage({success:false,error:e.message});
});`;
  return new Promise((resolve, reject) => {
    const workerUrl = URL.createObjectURL(
      new Blob([workerCode], { type: "application/javascript" })
    );
    const worker = new Worker(workerUrl);
    let cleanedUp = false;
    let killerId = setTimeout(() => {
      if (!cleanedUp) {
        cleanedUp = true;
        worker.terminate();
        console.log("Killed worker");
        reject("Worker timed out");
      }
    }, 1000);
    worker.onmessage = (event) => {
      const { data } = event;
      if (!cleanedUp) {
        clearTimeout(killerId);
        cleanedUp = true;
        URL.revokeObjectURL(url);
        URL.revokeObjectURL(workerUrl);
      }
      resolve(data);
      worker.terminate();
    };
  });
}
