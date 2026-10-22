import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Testa a lógica compartilhada (supabase/functions/_shared), usada pelo app e pelas Edge Functions.
export default defineConfig(({ mode }) => ({
  test: {
    include: ["supabase/functions/_shared/**/*.test.ts"],
    env: {
      ...loadEnv(mode, process.cwd(), ""),
      // `vitest --mode integration` liga os testes que usam o Supabase local.
      SUPABASE_INTEGRATION: mode === "integration" ? "1" : "",
    },
  },
}));
