/**
 * Bun fullstack server for the harness — no bundler dependency; Bun bundles the HTML
 * entry (and its TSX graph) itself. `bun run dev` for hot reload, `bun run start` to
 * serve plainly.
 */

import index from "./index.html";

const server = Bun.serve({
  port: Number(process.env.PORT ?? 4173),
  routes: { "/": index },
});

console.log(`qti-harness: http://localhost:${server.port}`);
