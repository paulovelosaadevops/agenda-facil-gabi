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
  ai_enabled: boolean;
  ai_instructions: string;
  created_at: string;
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string;
  duration_min: number;
  price_cents: number;
  active: boolean;
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
  email: string | null;
  birthday: string | null;
  notes: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  business_id: string;
  client_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
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

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};
