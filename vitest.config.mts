import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": path.resolve(import.meta.dirname, "src/test/server-only-stub.ts") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Sin latencia simulada en los tests de API.
    env: { API_LATENCY_MS: "0", ALLOW_FAULT_INJECTION: "true" },
  },
});
