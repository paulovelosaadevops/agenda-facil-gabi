// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions rodam no Deno (globais e imports próprios).
    ignores: ["dist/*", "supabase/functions/*/index.ts"],
  },
]);
