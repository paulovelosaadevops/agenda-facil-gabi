import type { AppointmentStatus } from "@/lib/types";

/** Cor de cada status (barra lateral e bolinha), nos tons do sistema. */
export const STATUS_TONE: Record<AppointmentStatus, { bar: string; text: string }> = {
  confirmed: { bar: "bg-blue", text: "text-blue" },
  pending: { bar: "bg-orange", text: "text-orange" },
  completed: { bar: "bg-green-bright", text: "text-green" },
  cancelled: { bar: "bg-label-3", text: "text-label-2" },
  no_show: { bar: "bg-red", text: "text-red" },
};

export const SOURCE_LABEL = { panel: "Painel", public: "Link de agendamento", whatsapp: "WhatsApp" } as const;
