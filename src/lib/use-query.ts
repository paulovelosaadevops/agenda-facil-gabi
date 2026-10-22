import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

/* Invalidação global simples: depois de salvar algo, `invalidate()` faz as telas abertas recarregarem. */
let version = 0;
const listeners = new Set<() => void>();
export function invalidate() {
  version++;
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const getVersion = () => version;

/**
 * Carrega dados com estado de carregamento/erro. Recarrega quando `deps` mudam,
 * após `invalidate()` e ao voltar para a tela.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const dataVersion = useSyncExternalStore(subscribe, getVersion, getVersion);

  // Sempre a versão mais recente da função, sem refazer os efeitos a cada render.
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });
  const request = useRef(0);
  const focusedOnce = useRef(false);

  // Só altera estado depois do await (nunca de forma síncrona dentro dos efeitos).
  const run = useCallback(async () => {
    const id = ++request.current;
    try {
      const result = await fnRef.current();
      if (id === request.current) {
        setData(result);
        setError(undefined);
      }
    } catch (err) {
      if (id === request.current) setError(err instanceof Error ? err.message : "Erro ao carregar.");
    } finally {
      if (id === request.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps definidas por quem chama
  }, [run, dataVersion, ...deps]);

  useFocusEffect(
    useCallback(() => {
      // A primeira vez já foi coberta pelo carregamento inicial.
      if (focusedOnce.current) void run();
      focusedOnce.current = true;
    }, [run]),
  );

  // Puxar para atualizar: mostra o indicador até terminar.
  const refresh = useCallback(() => {
    setRefreshing(true);
    return run();
  }, [run]);

  return { data, error, loading, refreshing, refresh };
}
