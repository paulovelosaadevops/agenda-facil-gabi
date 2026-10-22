export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
export type AppointmentSource = "panel" | "public" | "whatsapp";

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  slot_interval_min: number;
  min_advance_hours: number;
  max_advance_days: number;
  reminder_hours_before: number;
  /** Intervalo obrigatório depois de cada atendimento, em minutos (padrão 30). */
  buffer_min: number;
  /** Horário-limite para um atendimento terminar ("HH:MM:SS"); o expediente vale como horários de início. */
  latest_end_time: string | null;
  /** Horários divulgados na arte, por dia da semana (0 = domingo): {"2": ["09:00", "14:00"]}. */
  poster_times: Record<string, string[]>;
  ai_enabled: boolean;
  ai_instructions: string;
  created_at: string;
}

/** Categoria do serviço (separa a lista no painel e no agendamento). */
export type ServiceCategory = "primeira" | "manutencao" | "outros";
export const SERVICE_CATEGORIES: { key: ServiceCategory; label: string }[] = [
  { key: "primeira", label: "Primeira aplicação" },
  { key: "manutencao", label: "Manutenção" },
  { key: "outros", label: "Outros serviços" },
];

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string;
  duration_min: number;
  price_cents: number;
  /** Visível para as clientes (link de agendamento). */
  active: boolean;
  /** Excluído, mas mantido porque tem histórico de atendimentos. */
  archived: boolean;
  /** Retorno para manutenção em N dias (null = sem manutenção). */
  maintenance_days: number | null;
  /** Quantos dias antes do retorno avisar cliente e profissional. */
  maintenance_notice_days: number;
  /** Serviço indicado para o retorno (null = o próprio serviço). */
  maintenance_service_id: string | null;
  /** Combo: serviços incluídos (preço e duração são os do próprio combo). */
  combo_service_ids: string[];
  category: ServiceCategory;
  /** Serviço de pés: só para clientes liberadas (Client.feet). */
  feet: boolean;
}

export interface WorkingHours {
  id: string;
  business_id: string;
  weekday: number;
  start_time: string; // "HH:MM:SS"
  end_time: string;
}

export interface TimeOff {
  id: string;
  business_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
}

export interface Client {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  /** O telefone é WhatsApp? */
  whatsapp: boolean;
  instagram: string;
  email: string | null;
  /** Conta de login da cliente (null = cadastrada pela profissional, ainda sem conta). */
  user_id: string | null;
  birthday: string | null;
  notes: string;
  created_at: string;
  /** A Gabi atende os pés desta cliente (libera os serviços de pés). */
  feet: boolean;
}

export interface Appointment {
  id: string;
  business_id: string;
  client_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  /** Fim + intervalo entre atendimentos (calculado pelo banco). */
  blocked_until: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  price_cents: number;
  notes: string;
  reminder_sent_at: string | null;
}

export type AppointmentWithRefs = Appointment & {
  clients: Pick<Client, "id" | "name" | "phone"> | null;
  services: Pick<Service, "id" | "name" | "duration_min"> | null;
};

/** Linha da view maintenance_alerts. */
export interface MaintenanceAlert {
  business_id: string;
  client_id: string;
  appointment_id: string;
  service_id: string;
  return_service_id: string;
  done_at: string;
  due_at: string;
  notify_at: string;
  client_name: string;
  client_phone: string;
  client_whatsapp: boolean;
  client_user_id: string | null;
  service_name: string;
  return_service_name: string;
  client_email: string | null;
}

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};
