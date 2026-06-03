import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const nextEnvPath = resolve(here, "..", "next-env.d.ts");
const source = readFileSync(nextEnvPath, "utf8");
const normalized = source.replace(
  'import "./.next/dev/types/routes.d.ts";',
  'import "./.next/types/routes.d.ts";',
);

if (normalized !== source) {
  writeFileSync(nextEnvPath, normalized);
}
