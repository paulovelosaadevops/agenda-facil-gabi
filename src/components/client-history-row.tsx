import { formatInTz } from "@shared/format.ts";
import type { AppointmentWithRefs } from "@shared/types.ts";
import { useTheme } from "@/lib/theme";
import type { IconName } from "./icon";
import { STATUS_LABEL, statusColor } from "./status";
import { Row, RowIcon, Text } from "./ui";

const STATUS_ICON: Record<AppointmentWithRefs["status"], IconName> = {
  pending: "clock",
  confirmed: "check",
  completed: "check",
  cancelled: "cancel",
  no_show: "noShow",
};

/** Atendimento passado da cliente: serviço, data e status colorido. */
export function ClientHistoryRow({ appointment, timeZone }: { appointment: AppointmentWithRefs; timeZone: string }) {
  const theme = useTheme();
  return (
    <Row
      leading={<RowIcon name={STATUS_ICON[appointment.status]} />}
      title={appointment.services?.name ?? "Serviço"}
      subtitle={
        <Text variant="subhead" color="label2">
          {formatInTz(appointment.starts_at, "dd/MM/yyyy", timeZone)} ·{" "}
          <Text variant="subhead" style={{ color: statusColor(appointment.status, theme) }}>
            {STATUS_LABEL[appointment.status]}
          </Text>
        </Text>
      }
    />
  );
}
