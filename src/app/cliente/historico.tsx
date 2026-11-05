import { ClientHistoryRow } from "@/components/client-history-row";
import { ScreenHeader } from "@/components/screen-header";
import { Banner, EmptyState, Loading, Screen, Section } from "@/components/ui";
import type { AppointmentWithRefs } from "@shared/types.ts";
import { useClient } from "@/lib/auth";
import { useStudioInfo } from "@/lib/studio";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";

/** Todos os atendimentos passados da cliente, do mais recente ao mais antigo. */
export default function ClientHistory() {
  const client = useClient();
  const { data: studio } = useStudioInfo();
  const tz = studio?.business.timezone ?? "America/Sao_Paulo";
  const { data, loading, error, refreshing, refresh } = useQuery(async () => {
    const now = new Date().toISOString();
    const { data: list, error: e } = await supabase
      .from("appointments")
      .select("*, clients(id, name, phone), services(id, name, duration_min)")
      .eq("client_id", client.id)
      .or(`starts_at.lt.${now},status.in.(cancelled,no_show)`)
      .order("starts_at", { ascending: false })
      .limit(200)
      .returns<AppointmentWithRefs[]>();
    if (e) throw e;
    return list;
  });

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Histórico" />
      {error && <Banner>{error}</Banner>}
      {loading && !data ? (
        <Loading />
      ) : data?.length ? (
        <Section>
          {data.map((a) => (
            <ClientHistoryRow key={a.id} appointment={a} timeZone={tz} />
          ))}
        </Section>
      ) : (
        <EmptyState icon="clock" title="Nenhum atendimento ainda" message="Seus atendimentos aparecem aqui." />
      )}
    </Screen>
  );
}
