// iPhone/Android nativos (Expo Go): notificação no celular só pelo app instalado na web (PWA).
export type PushStatus = "unsupported" | "needs-install" | "denied" | "off" | "on";

export async function getPushStatus(): Promise<PushStatus> {
  return "unsupported";
}
export async function enablePush(_businessId: string): Promise<void> {
  throw new Error("Disponível no app instalado pela Tela de Início.");
}
export async function disablePush(): Promise<void> {}
