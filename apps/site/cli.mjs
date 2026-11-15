import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { unlink } from "node:fs/promises";
const root = fileURLToPath(new URL("../../", import.meta.url));
const cli = fileURLToPath(
  new URL("../../node_modules/astro/astro.js", import.meta.url),
);
// Astro 5 can retain an empty content store when base/site changes between
// deployments. Rebuild this generated metadata, while keeping image caches.
if (process.argv[2] === "build")
  await unlink(
    new URL("../../node_modules/.astro/data-store.json", import.meta.url),
  ).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
