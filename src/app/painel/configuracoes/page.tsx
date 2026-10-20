import { CalendarClock, CalendarOff, Clock, Sparkles, Store, Tag } from "lucide-react";
import type { Metadata } from "next";
import { logout } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/page-header";
import { ShareLink } from "@/components/share-link";
import { AppMark, List, Row, RowIcon } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { env } from "@/lib/env";
import { formatPhone } from "@/lib/format";

export const metadata: Metadata = { title: "Ajustes" };

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Resume os dias abertos: "Ter–Sáb", "Seg, Qua, Sex"... */
function summarizeDays(days: number[]): string {
  if (!days.length) return "Fechado";
  const sorted = [...new Set(days)].sort();
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (consecutive && sorted.length > 2) return `${WEEKDAY_SHORT[sorted[0]]}–${WEEKDAY_SHORT[sorted.at(-1)!]}`;
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(", ");
}

export default async function SettingsPage() {
  const { db, business, user } = await requireBusiness();
  const [{ data: hours }, { count: servicesCount }, { count: timeOffCount }] = await Promise.all([
    db.from("working_hours").select("weekday").eq("business_id", business.id),
    db.from("services").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("active", true),
    db
      .from("time_off")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .gte("ends_at", new Date().toISOString()),
  ]);
  const publicUrl = `${env.appUrl()}/agendar/${business.slug}`;
  const icon = "size-[18px]";

  return (
    <>
      <PageHeader title="Ajustes" />

      <List>
        <Row
          href="/painel/configuracoes/estudio"
          leading={<AppMark size={56} />}
          title={<span className="text-[20px] font-semibold">{business.name}</span>}
          subtitle={business.phone ? formatPhone(business.phone) : user.email}
          chevron
          className="py-3 after:left-[5.25rem]"
        />
      </List>

      <List>
        <Row
          href="/painel/configuracoes/estudio"
          leading={<RowIcon color="#8e8e93"><Store className={icon} /></RowIcon>}
          title="Dados do estúdio"
          chevron
        />
        <Row
          href="/painel/servicos"
          leading={<RowIcon color="#ff2d55"><Tag className={icon} /></RowIcon>}
          title="Serviços"
          detail={servicesCount ?? 0}
          chevron
        />
      </List>

      <List>
        <Row
          href="/painel/configuracoes/expediente"
          leading={<RowIcon color="#ff9500"><Clock className={icon} /></RowIcon>}
          title="Expediente"
          detail={summarizeDays((hours ?? []).map((h) => h.weekday))}
          chevron
        />
        <Row
          href="/painel/configuracoes/folgas"
          leading={<RowIcon color="#ff3b30"><CalendarOff className={icon} /></RowIcon>}
          title="Folgas e bloqueios"
          detail={timeOffCount || undefined}
          chevron
        />
        <Row
          href="/painel/configuracoes/agendamento"
          leading={<RowIcon color="#007aff"><CalendarClock className={icon} /></RowIcon>}
          title="Regras de agendamento"
          chevron
        />
      </List>

      <List>
        <Row
          href="/painel/configuracoes/assistente"
          leading={<RowIcon color="#af52de"><Sparkles className={icon} /></RowIcon>}
          title="Atendente virtual"
          detail={business.ai_enabled ? "Ativada" : "Desativada"}
          chevron
        />
      </List>

      <List header="Link de agendamento" footer="Suas clientes escolhem o serviço e o horário sozinhas por este link.">
        <div className="px-4 py-3">
          <p className="mb-3 truncate text-[15px] text-label-2">{publicUrl.replace(/^https?:\/\//, "")}</p>
          <ShareLink url={publicUrl} title={`Agende com ${business.name}`} />
        </div>
      </List>

      <List footer={user.email ? `Conectada como ${user.email}` : undefined}>
        <form action={logout}>
          <button className="flex min-h-11 w-full items-center justify-center text-[16px] text-red transition-colors hover:bg-fill-2 active:bg-fill md:text-[15px]">
            Sair
          </button>
        </form>
      </List>
    </>
  );
}
