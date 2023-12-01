import { sandstonePack } from "sandstone";
import "./index.ts";

const files: Record<string, string | Buffer> = {};

await sandstonePack.save({
  // Additional parameters
  dry: false,
  verbose: true,

  fileHandler: async (
    relativePath: string,
    content: string | Buffer | Promise<Buffer>
  ) => {
    files[relativePath] = await content;
  },
});

export default files;
