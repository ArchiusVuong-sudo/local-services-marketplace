import type { NextConfig } from "next";

const config: NextConfig = {
  // PGlite (Postgres in WASM) and the agent SDK must load as plain Node modules on the server.
  serverExternalPackages: ["@electric-sql/pglite", "@anthropic-ai/claude-agent-sdk"],
  poweredByHeader: false,
};

export default config;
