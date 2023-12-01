import { build, initialize } from "esbuild-wasm";
import wasmUrl from "esbuild-wasm/esbuild.wasm?url";
import sandstoneCode from "./assets/sandstone.esm.js?raw";
import { resolve } from "path";
import runtimeWrapperCode from "./assets/runtimeWrapper.ts?raw";
let hasBeenInitialized = false;
export async function compilePack(fs: Record<string, string>):Promise<{success:true,files:Record<string,string>}|{success:false,error:string}> {
  if (!hasBeenInitialized) {
    await initialize({
      wasmURL: wasmUrl,
    });
    hasBeenInitialized = true;
  }
  const modules: Record<string, string> = {
    sandstone: sandstoneCode,
    "node-fetch": "export default fetch",
  };
  const fileExtensions = ["ts", "tsx", "js", "jsx", "json"];
  const result = await build({
    entryPoints: ["<entrypoint>.ts"],
    format: "esm",
    bundle: true,
    plugins: [
      {
        name: "fs",
        setup(build) {
          build.onResolve({ filter: /./ }, (event) => {
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
  const code = file.text;
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
