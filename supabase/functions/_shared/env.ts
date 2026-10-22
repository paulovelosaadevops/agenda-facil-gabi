/** Lê variável de ambiente no Deno (Edge Functions) ou no Node (testes). */
export function getEnv(name: string): string | undefined {
  const g = globalThis as {
    Deno?: { env: { get(key: string): string | undefined } };
    process?: { env: Record<string, string | undefined> };
  };
  return g.Deno?.env.get(name) ?? g.process?.env[name];
}

export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}
