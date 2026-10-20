import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppMark } from "@/components/ui";
import { toDateKey } from "@/lib/availability";
import { formatInTz } from "@/lib/format";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Business, Service } from "@/lib/types";
import { BookingFlow } from "./booking-flow";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

async function loadPublicBusiness(slug: string) {
  const db = createSupabaseAdmin();
  const { data: business } = await db
    .from("businesses")
    .select("id, name, slug, address, timezone, max_advance_days")
    .eq("slug", slug)
    .maybeSingle<Pick<Business, "id" | "name" | "slug" | "address" | "timezone" | "max_advance_days">>();
  if (!business) return null;
  const { data: services } = await db
    .from("services")
    .select("id, name, description, duration_min, price_cents")
    .eq("business_id", business.id)
    .eq("active", true)
    .order("name")
    .returns<Pick<Service, "id" | "name" | "description" | "duration_min" | "price_cents">[]>();
  return { business, services: services ?? [] };
}

export async function generateMetadata({ params }: PageProps<"/agendar/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicBusiness(slug);
  return { title: data ? `Agende com ${data.business.name}` : "Agendamento" };
}

async function Booking({ params }: { params: PageProps<"/agendar/[slug]">["params"] }) {
  const { slug } = await params;
  const data = await loadPublicBusiness(slug);
  if (!data) notFound();
  const { business, services } = data;

  const now = new Date();
  const days = Array.from({ length: Math.min(30, business.max_advance_days + 1) }, (_, i) => {
    const date = addDays(now, i);
    return {
      key: toDateKey(date, business.timezone),
      weekday: i === 0 ? "Hoje" : WEEKDAYS[new TZDate(date.getTime(), business.timezone).getDay()],
      day: formatInTz(date, "d", business.timezone),
      month: formatInTz(date, "MMMM 'de' yyyy", business.timezone),
    };
  });

  return (
    <>
      <header className="mb-8 flex items-center gap-3">
        <AppMark size={44} />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold">{business.name}</p>
          {business.address && (
            <p className="flex items-center gap-1 truncate text-[13px] text-label-2">
              <MapPin className="size-3.5 shrink-0" /> {business.address}
            </p>
          )}
        </div>
      </header>
      {services.length ? (
        <BookingFlow
          slug={business.slug}
          businessName={business.name}
          address={business.address}
          services={services}
          days={days}
          timeZone={business.timezone}
        />
      ) : (
        <p className="rounded-2xl bg-surface px-4 py-10 text-center text-[15px] text-label-2">Agendamento online indisponível no momento.</p>
      )}
    </>
  );
}

export default function PublicBookingPage({ params }: PageProps<"/agendar/[slug]">) {
  return (
    <main className="min-h-dvh px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+3rem)]">
      <div className="mx-auto max-w-md">
        <Suspense
          fallback={
            <div className="animate-pulse">
              <div className="mb-8 flex items-center gap-3">
                <div className="size-11 rounded-[10px] bg-fill" />
                <div className="h-5 w-40 rounded bg-fill" />
              </div>
              <div className="h-60 rounded-xl bg-surface" />
            </div>
          }
        >
          <Booking params={params} />
        </Suspense>
        <p className="mt-12 text-center text-[12px] text-label-3">Agenda Fácil</p>
      </div>
    </main>
  );
}
