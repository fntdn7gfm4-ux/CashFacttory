import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

await rm("dist", { recursive: true, force: true });
await mkdir("dist/client", { recursive: true });
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await cp("out", "dist/client", { recursive: true });
await cp("worker/index.js", "dist/server/index.js");
await cp(".openai/hosting.json", "dist/.openai/hosting.json");

const wrangler = {
  name: "cashfacttory",
  main: "index.js",
  compatibility_date: "2026-08-01",
  assets: { directory: "../client", binding: "ASSETS", not_found_handling: "single-page-application" },
};
await writeFile("dist/server/wrangler.json", `${JSON.stringify(wrangler, null, 2)}\n`);

// Fail the build if the worker lost its callable fetch export.
const worker = await readFile("dist/server/index.js", "utf8");
if (!worker.includes("export default") || !worker.includes("async fetch")) {
  throw new Error("Worker entrypoint inválido");
}
