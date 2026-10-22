import { useLocalSearchParams, useRouter } from "expo-router";
import { BookingFlow } from "@/components/booking-flow";
import { ScreenHeader } from "@/components/screen-header";
import { Banner, Loading, Screen } from "@/components/ui";
import { useClient } from "@/lib/auth";
import { buildDays, useStudioInfo } from "@/lib/studio";
import { invalidate } from "@/lib/use-query";

/** Agendamento pela cliente: serviço → dia e horário → confirmar. */
export default function ClientBooking() {
  const router = useRouter();
  const { servico } = useLocalSearchParams<{ servico?: string }>();
  const client = useClient();
  const { data, loading, error } = useStudioInfo();

  return (
    <Screen keyboard>
      <ScreenHeader title="Agendar" />
      {error && <Banner>{error}</Banner>}
      {loading || !data ? (
        <Loading />
      ) : (
        <BookingFlow
          businessName={data.business.name}
          address={data.business.address}
          studioPhone={data.business.phone}
          services={data.services}
          days={buildDays(data.business.timezone, data.business.max_advance_days)}
          timeZone={data.business.timezone}
          initialServiceId={servico}
          allowFeet={client.feet}
          onDone={() => {
            invalidate();
            router.dismissTo("/cliente");
          }}
        />
      )}
    </Screen>
  );
}
