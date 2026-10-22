import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/screen-header";
import { EmptyState, HeaderButton, Loading, Row, Screen, Section } from "@/components/ui";
import { formatDuration, formatMoney } from "@shared/format.ts";
import { SERVICE_CATEGORIES, type Service } from "@shared/types.ts";
import { useBusiness } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";

export default function ServicesScreen() {
  const router = useRouter();
  const business = useBusiness();
  const { data, loading } = useQuery(async () => {
    const { data: rows } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", business.id)
      .eq("archived", false)
      .order("name")
      .returns<Service[]>();
    return rows ?? [];
  });

  const row = (s: Service) => (
    <Row
      key={s.id}
      href={{ pathname: "/ajustes/servico", params: { id: s.id } }}
      title={s.combo_service_ids.length ? `${s.name} · combo` : s.name}
      subtitle={[formatDuration(s.duration_min), s.feet ? "pés" : null, s.maintenance_days ? `retorno em ${s.maintenance_days} dias` : null]
        .filter(Boolean)
        .join(" · ")}
      detail={formatMoney(s.price_cents)}
      tone={s.active ? "default" : "muted"}
      chevron
    />
  );
  const visible = (data ?? []).filter((s) => s.active);
  const inactive = (data ?? []).filter((s) => !s.active);

  return (
    <Screen>
      <ScreenHeader title="Serviços" right={<HeaderButton icon="plus" accessibilityLabel="Novo serviço" onPress={() => router.push("/ajustes/servico")} />} />
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <EmptyState icon="tag" title="Nenhum serviço" message="Toque em + para cadastrar o primeiro." />
      ) : (
        <>
          {SERVICE_CATEGORIES.map(({ key, label }) => {
            const list = visible.filter((s) => s.category === key);
            return list.length ? (
              <Section key={key} header={label}>
                {list.map(row)}
              </Section>
            ) : null;
          })}
          {inactive.length > 0 && (
            <Section header="Ocultos" footer="Não aparecem para as clientes, mas você ainda pode agendá-los.">
              {inactive.map(row)}
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}
