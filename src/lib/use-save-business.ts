import { useRouter } from "expo-router";
import { useState } from "react";
import type { Business } from "@shared/types.ts";
import { useAuth, useBusiness } from "./auth";
import { dbErrorMessage, supabase } from "./supabase";
import { invalidate } from "./use-query";

/** Salva campos do estúdio, atualiza o contexto do app e volta para Ajustes. */
export function useSaveBusiness() {
  const router = useRouter();
  const business = useBusiness();
  const { refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const save = async (patch: Partial<Business>) => {
    setSaving(true);
    setError(undefined);
    const { error: e } = await supabase.from("businesses").update(patch).eq("id", business.id);
    if (e) {
      setSaving(false);
      return setError(dbErrorMessage(e));
    }
    await refresh();
    invalidate();
    router.back();
  };

  return { save, saving, error, setError };
}
