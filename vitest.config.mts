import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // "server-only" lança erro fora do bundle de servidor do Next; nos testes é um no-op.
      "server-only": path.resolve(import.meta.dirname, "src/test/empty.ts"),
    },
  },
  test: {
    env: {
      ...loadEnv(mode, process.cwd(), ""),
      // `vitest --mode integration` liga os testes que usam o Supabase local.
      SUPABASE_INTEGRATION: mode === "integration" ? "1" : "",
    },
  },
}));
