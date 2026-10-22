import type { AppointmentStatus } from "@shared/types.ts";
import type { Theme } from "@/lib/theme";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

/** Cor de cada status em tons sóbrios (ardósia, ocre, sálvia, terracota). */
export function statusColor(status: AppointmentStatus, theme: Theme): string {
  switch (status) {
    case "confirmed":
      return theme.statusConfirmed;
    case "pending":
      return theme.statusPending;
    case "completed":
      return theme.statusCompleted;
    case "no_show":
      return theme.statusNoShow;
    case "cancelled":
      return theme.label3;
  }
}

export const SOURCE_LABEL = { panel: "Painel", public: "Link de agendamento", whatsapp: "WhatsApp" } as const;
