/**
 * ProjectFlow Agent Bridge Sidecar
 *
 * TypeScript sidecar process that orchestrates the Agent Runtime loop.
 * Communicates with FastAPI over HTTP/SSE — zero DB credentials.
 */

import { createServer } from "./server/app.js";
import { loadConfig } from "./server/config.js";

async function main() {
  const config = loadConfig();
  const app = createServer(config);

  const host = config.host ?? "127.0.0.1";
  const port = config.port ?? 4000;

  app.listen(port, host, () => {
    console.log(`[agent-bridge] listening on ${host}:${port}`);
    console.log(`[agent-bridge] fastapi target: ${config.fastapiBaseUrl}`);
    console.log(`[agent-bridge] model provider: ${config.defaultModelProvider}`);
  });
}

main().catch((err) => {
  console.error("[agent-bridge] fatal:", err);
  process.exit(1);
});
