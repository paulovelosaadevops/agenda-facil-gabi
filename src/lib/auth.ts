import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Business } from "@/lib/types";

/** Usuária logada + seu negócio. Redireciona para login/onboarding quando faltar. */
export const requireBusiness = cache(async () => {
  const db = await createSupabaseServer();
  const { data: userData } = await db.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: business, error } = await db
    .from("businesses")
    .select("*")
    .eq("owner_id", userData.user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle<Business>();
  if (error) throw error;
  if (!business) redirect("/onboarding");

  return { db, user: userData.user, business };
});
