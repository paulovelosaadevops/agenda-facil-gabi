import { CalendarPlus, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { STATUS_TONE } from "@/components/status";
import { Avatar, List, Row } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { formatInTz, formatMoney, formatPhone } from "@/lib/format";
import { STATUS_LABEL, type AppointmentWithRefs, type Client } from "@/lib/types";
import { EditClientButton } from "../client-form";

export default async function ClientPage({ params }: PageProps<"/painel/clientes/[id]">) {
  const { id } = await params;
  const { db, business } = await requireBusiness();
  const tzName = business.timezone;

  const [{ data: client }, { data: appts }] = await Promise.all([
    db.from("clients").select("*").eq("business_id", business.id).eq("id", id).maybeSingle<Client>(),
    db
      .from("appointments")
      .select("*, clients(id, name, phone), services(id, name, duration_min)")
      .eq("business_id", business.id)
      .eq("client_id", id)
      .order("starts_at", { ascending: false })
      .limit(50)
      .returns<AppointmentWithRefs[]>(),
  ]);
  if (!client) notFound();

  const history = appts ?? [];
  const completed = history.filter((a) => a.status === "completed");
  const spent = completed.reduce((sum, a) => sum + a.price_cents, 0);
  const last = completed[0];
  const birthday = client.birthday ? `${client.birthday.slice(8, 10)}/${client.birthday.slice(5, 7)}` : null;

  return (
    <>
      <PageHeader
        title={client.name}
        largeTitle={false}
        back={{ href: "/painel/clientes", label: "Clientes" }}
        actions={<EditClientButton client={client} />}
      />

      <div className="flex flex-col items-center pt-2 pb-6 text-center">
        <Avatar name={client.name} size={88} />
        <h1 className="mt-3 text-[28px] leading-tight font-bold tracking-tight">{client.name}</h1>
        <p className="mt-0.5 text-[15px] text-label-2">{formatPhone(client.phone)}</p>
      </div>

      <div className="mb-7 grid grid-cols-3 gap-2">
        <QuickAction href={`https://wa.me/${client.phone}`} external icon={<MessageCircle className="size-5" />} label="mensagem" />
        <QuickAction href={`tel:+${client.phone}`} external icon={<Phone className="size-5" />} label="ligar" />
        <QuickAction href={`/painel/agenda?cliente=${client.id}`} icon={<CalendarPlus className="size-5" />} label="agendar" />
      </div>

      <List>
        <Row title="Atendimentos" detail={completed.length} />
        <Row title="Total gasto" detail={formatMoney(spent)} />
        <Row title="Último atendimento" detail={last ? formatInTz(last.starts_at, "dd/MM/yyyy", tzName) : "—"} />
        <Row title="Cliente desde" detail={formatInTz(client.created_at, "MMM 'de' yyyy", tzName)} />
      </List>

      {(client.email || birthday || client.notes) && (
        <List>
          {client.email && <Row title="E-mail" detail={client.email} />}
          {birthday && <Row title="Aniversário" detail={birthday} />}
          {client.notes && (
            <div className="px-4 py-3">
              <p className="text-[13px] text-label-2">Observações</p>
              <p className="mt-1 text-[15px] whitespace-pre-line">{client.notes}</p>
            </div>
          )}
        </List>
      )}

      <List header="Histórico">
        {history.length ? (
          history.map((a) => (
            <Row
              key={a.id}
              title={a.services?.name ?? "Serviço"}
              subtitle={
                <>
                  {formatInTz(a.starts_at, "dd/MM/yyyy · HH:mm", tzName)} ·{" "}
                  <span className={STATUS_TONE[a.status].text}>{STATUS_LABEL[a.status]}</span>
                </>
              }
              detail={formatMoney(a.price_cents)}
            />
          ))
        ) : (
          <Row title="Nenhum atendimento ainda" tone="muted" />
        )}
      </List>
    </>
  );
}

function QuickAction({ href, icon, label, external }: { href: string; icon: ReactNode; label: string; external?: boolean }) {
  const className =
    "flex flex-col items-center gap-1 rounded-xl bg-surface py-2.5 text-[12px] font-medium text-accent transition active:scale-[0.97] hover:bg-fill-2";
  return external ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={className}>
      {icon}
      {label}
    </a>
  ) : (
    <Link href={href} className={className}>
      {icon}
      {label}
    </Link>
  );
}
