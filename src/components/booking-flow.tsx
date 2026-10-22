import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { formatDuration, formatInTz, formatMoney, normalizePhone, whatsappLink } from "@shared/format.ts";
import { SERVICE_CATEGORIES, type Service, type ServiceCategory } from "@shared/types.ts";
import { openCalendar } from "@/lib/ics";
import { authStorage } from "@/lib/storage";
import { callFunction, supabase } from "@/lib/supabase";
import { Serif, useTheme } from "@/lib/theme";
import { CreatePassword, useHasPassword } from "./create-password";
import { DayChips } from "./day-chips";
import { Icon } from "./icon";
import { SlotChips } from "./slot-chips";
import { Banner, Button, FormRow, HeaderButton, Input, Loading, Section, SwitchRow, tap, Text, TextAreaRow } from "./ui";

export type PublicService = Pick<Service, "id" | "name" | "description" | "duration_min" | "price_cents"> & {
  combo_service_ids?: string[];
  category?: ServiceCategory;
  feet?: boolean;
};
export interface PublicDay {
  key: string;
  weekday: string;
  day: string;
  month: string;
}

const PERIODS = [
  { label: "Manhã", test: (h: number) => h < 12 },
  { label: "Tarde", test: (h: number) => h >= 12 && h < 18 },
  { label: "Noite", test: (h: number) => h >= 18 },
];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Step = "service" | "time" | "details" | "code" | "done";
const STEPS: Step[] = ["service", "time", "details"];

// Sem login: guarda os dados no aparelho para a cliente não digitar de novo na próxima vez.
const PROFILE_KEY = "agenda-facil:dados-cliente";
type GuestProfile = { name: string; phone: string; whatsapp: boolean; instagram: string; email: string };
const EMPTY_PROFILE: GuestProfile = { name: "", phone: "", whatsapp: true, instagram: "", email: "" };
function loadProfile(): GuestProfile {
  try {
    const raw = authStorage?.getItem(PROFILE_KEY);
    return raw ? { ...EMPTY_PROFILE, ...JSON.parse(raw) } : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}
function saveProfile(p: GuestProfile) {
  try {
    authStorage?.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    // Sem armazenamento (aba anônima): só não lembra os dados.
  }
}

/** Barra de etapas: Serviço · Horário · Seus dados. */
function Progress({ step, labels }: { step: Step; labels: string[] }) {
  const theme = useTheme();
  const current = step === "code" ? 2 : STEPS.indexOf(step);
  return (
    <View style={styles.progress}>
      {labels.map((label, i) => (
        <View key={label} style={{ flex: 1, gap: 6 }}>
          <View style={[styles.progressBar, { backgroundColor: i <= current ? theme.accent : theme.fill }]} />
          <Text variant="caption" style={{ color: i === current ? theme.label : theme.label3, fontWeight: i === current ? "600" : "400" }}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Agendamento em etapas: serviço → dia e horário → dados/confirmação → pronto.
 * Com `guest` (link público, sem conta): a cliente informa os dados obrigatórios e confirma com o código
 * enviado ao e-mail. O código só garante a autenticidade: a sessão dura até reservar o horário e é encerrada em seguida.
 */
export function BookingFlow({
  businessName,
  address,
  studioPhone,
  services,
  days,
  timeZone,
  initialServiceId,
  guest,
  onDone,
  onVerifyStart,
  allowFeet = false,
}: {
  businessName: string;
  address: string | null;
  /** WhatsApp do estúdio, para o botão "Falar com a Gabi" no final. */
  studioPhone?: string | null;
  services: PublicService[];
  days: PublicDay[];
  timeZone: string;
  /** Já começa com este serviço escolhido (ex.: "agendar manutenção"). */
  initialServiceId?: string;
  /** Agendamento sem login (link público). A seta de voltar fica no conteúdo, pois a página não tem cabeçalho. */
  guest?: boolean;
  /** Botão final ("Ver meus horários"). */
  onDone?: () => void;
  /** Avisado logo antes de confirmar o código: a página não deve trocar de tela quando a sessão começar. */
  onVerifyStart?: () => void;
  /** Cliente liberada para serviços de pés (logada). No link público os serviços de pés ficam ocultos. */
  allowFeet?: boolean;
}) {
  const theme = useTheme();
  const hasPassword = useHasPassword();
  const initialService = services.find((s) => s.id === initialServiceId);
  const [step, setStep] = useState<Step>(initialService ? "time" : "service");
  const [service, setService] = useState<PublicService | undefined>(initialService);
  const [day, setDay] = useState(days[0]?.key);
  const [slots, setSlots] = useState<string[]>();
  const [slot, setSlot] = useState<string>();
  const [notes, setNotes] = useState("");
  const [profile, setProfile] = useState<GuestProfile>(loadProfile);
  const [calendarUrl, setCalendarUrl] = useState<string>();
  const [code, setCode] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // Link público: primeiro o e-mail. Quem já é cliente só confirma (código ou senha); quem é nova preenche os dados.
  const [known, setKnown] = useState<"unknown" | "client" | "new">("unknown");
  const [knownHasPassword, setKnownHasPassword] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const setField = (key: keyof GuestProfile) => (v: string | boolean) => setProfile((p) => ({ ...p, [key]: v }));
  const email = profile.email.trim().toLowerCase();

  const changeEmail = () => {
    setError(undefined);
    setKnown("unknown");
    setUsePassword(false);
    setPassword("");
  };

  const loadSlots = async (serviceId: string, date: string) => {
    setDay(date);
    setSlots(undefined);
    setError(undefined);
    try {
      const res = await callFunction<{ slots: string[] }>("public-booking", { action: "slots", serviceId, date });
      setSlots(res.slots);
    } catch (err) {
      setSlots([]);
      setError(err instanceof Error ? err.message : "Erro ao buscar horários.");
    }
  };

  useEffect(() => {
    if (!initialService || !days[0]) return;
    let active = true;
    callFunction<{ slots: string[] }>("public-booking", { action: "slots", serviceId: initialService.id, date: days[0].key })
      .then((res) => active && setSlots(res.slots))
      .catch(() => active && setSlots([]));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na abertura
  }, []);

  // Contagem para "Reenviar código".
  useEffect(() => {
    if (step !== "code") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step]);
  const waitSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const back = () => {
    setError(undefined);
    if (step === "details" && known !== "unknown") return changeEmail();
    setStep(step === "code" ? "details" : step === "details" ? "time" : "service");
  };

  /** Confere se o e-mail já é de uma cliente e decide o que pedir em seguida. */
  const lookupEmail = async () => {
    setError(undefined);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Informe um e-mail válido.");
    setBusy(true);
    try {
      const res = await callFunction<{ exists: boolean; hasPassword: boolean }>("public-booking", { action: "lookup", email });
      saveProfile({ ...profile, email });
      setKnown(res.exists ? "client" : "new");
      setKnownHasPassword(res.hasPassword);
      setUsePassword(res.hasPassword);
    } catch {
      setError("Não foi possível continuar. Confira sua internet e tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const validateProfile = (): string | undefined => {
    if (profile.name.trim().split(/\s+/).length < 2) return "Informe nome e sobrenome.";
    if (!normalizePhone(profile.phone)) return "Telefone inválido. Use DDD + número.";
    if (profile.instagram.trim().replace(/^@/, "").length < 2) return "Informe seu Instagram.";
    if (!/^\S+@\S+\.\S+$/.test(profile.email.trim())) return "Informe um e-mail válido.";
  };

  const book = async () => {
    if (!service || !slot) return;
    // Cliente nova manda os dados: se a conta já existia sem ficha, a ficha é criada na hora.
    const newProfile =
      guest && known === "new"
        ? { name: profile.name.trim(), phone: profile.phone, whatsapp: profile.whatsapp, instagram: profile.instagram.trim().replace(/^@?/, "@") }
        : undefined;
    const res = await callFunction<{ calendarUrl?: string }>("public-booking", {
      action: "book",
      serviceId: service.id,
      startsAt: slot,
      notes,
      profile: newProfile,
    });
    setCalendarUrl(res.calendarUrl);
    setStep("done");
  };

  const handleBookingError = (err: unknown) => {
    const message = err instanceof Error ? err.message : "Não foi possível agendar.";
    // Horário ocupado nesse meio tempo: volta para escolher outro (o aviso continua na tela).
    if (service && day && /não está mais disponível|fora do expediente|antecedência/i.test(message)) {
      void loadSlots(service.id, day);
      setStep("time");
    }
    setError(message);
  };

  /** Cliente logada: reserva direto. */
  const confirmLogged = async () => {
    setError(undefined);
    setBusy(true);
    try {
      await book();
    } catch (err) {
      handleBookingError(err);
    } finally {
      setBusy(false);
    }
  };

  /** Link público: envia o código para o e-mail (cria a conta com os dados na primeira vez). */
  const sendCode = async () => {
    setError(undefined);
    const invalid = known === "new" ? validateProfile() : undefined;
    if (invalid) return setError(invalid);
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithOtp({
      email,
      options:
        known === "new"
          ? {
              shouldCreateUser: true,
              data: {
                role: "client",
                name: profile.name.trim(),
                phone: normalizePhone(profile.phone),
                whatsapp: profile.whatsapp,
                instagram: profile.instagram.trim().replace(/^@?/, "@"),
              },
            }
          : { shouldCreateUser: false },
    });
    setBusy(false);
    if (e) {
      if (/database error/i.test(e.message)) return setError("Este telefone já está ligado a outra conta. Use o e-mail dessa conta ou fale com a Gabi.");
      if (/rate|seconds|security purposes/i.test(e.message)) return setError("Aguarde alguns segundos para pedir outro código.");
      return setError("Não foi possível enviar o código. Confira o e-mail e tente de novo.");
    }
    saveProfile(profile);
    setCode("");
    setResendAt(Date.now() + 60_000);
    setNow(Date.now());
    setStep("code");
  };

  /** Confere o código e reserva. */
  const confirmCode = async () => {
    setError(undefined);
    if (!/^\d{6}$/.test(code.trim())) return setError("Digite os 6 números do código.");
    setBusy(true);
    onVerifyStart?.();
    const { error: e } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    if (e) {
      setBusy(false);
      return setError("Código inválido ou expirado. Confira o e-mail ou peça outro código.");
    }
    try {
      await book();
    } catch (err) {
      handleBookingError(err);
    } finally {
      setBusy(false);
    }
  };

  /** Cliente com senha: entra e reserva, sem esperar código. */
  const confirmPassword = async () => {
    setError(undefined);
    if (!password) return setError("Digite sua senha.");
    setBusy(true);
    onVerifyStart?.();
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    if (e) {
      setBusy(false);
      return setError("Senha incorreta. Tente de novo ou receba um código por e-mail.");
    }
    try {
      await book();
    } catch (err) {
      handleBookingError(err);
    } finally {
      setBusy(false);
    }
  };

  if (step === "done" && service && slot) {
    return (
      <View style={{ alignItems: "center", paddingTop: 16 }}>
        <View style={[styles.check, { borderColor: theme.champagne }]}>
          <Icon name="check" size={34} color={theme.accent} weight="light" />
        </View>
        <Text variant="title1" style={{ marginTop: 20 }}>
          Tudo certo!
        </Text>
        <Text color="label2">Seu horário está reservado.</Text>
        <View style={[styles.summary, { backgroundColor: theme.surface, marginTop: 24 }]}>
          <Text variant="overline" color="accent">
            {businessName.toUpperCase()}
          </Text>
          <Text variant="title3" style={{ marginTop: 8 }}>
            {service.name}
          </Text>
          <Text style={{ marginTop: 2 }}>{capitalize(formatInTz(slot, "EEEE, d 'de' MMMM", timeZone))}</Text>
          <Text color="label2">
            {formatInTz(slot, "HH:mm", timeZone)} · {formatDuration(service.duration_min)}
          </Text>
          {address && (
            <View style={styles.addressRow}>
              <Icon name="mapPin" size={14} color={theme.label2} />
              <Text variant="subhead" color="label2" style={{ flex: 1 }}>
                {address}
              </Text>
            </View>
          )}
        </View>
        {/* Link público: a cliente cria a senha do painel para voltar quando quiser. */}
        {guest && !hasPassword && (
          <CreatePassword message="Acompanhe seus próximos horários e manutenções no seu painel. Crie uma senha para entrar com o seu e-mail sempre que quiser." />
        )}
        {calendarUrl && (
          <Button
            title="Adicionar ao calendário"
            icon="calendarPlus"
            style={{ alignSelf: "stretch", marginTop: 12 }}
            onPress={() => openCalendar(calendarUrl)}
          />
        )}
        {studioPhone && (
          <Button
            title="Falar com a Gabi no WhatsApp"
            icon="message"
            variant="tinted"
            style={{ alignSelf: "stretch", marginTop: 10 }}
            onPress={() =>
              Linking.openURL(
                whatsappLink(
                  studioPhone,
                  `Olá, Gabi! ${profile.name.trim() ? `Aqui é a ${profile.name.trim().split(" ")[0]}. ` : ""}` +
                    `Acabei de agendar ${service.name} para ${formatInTz(slot, "EEEE, dd/MM 'às' HH:mm", timeZone)}.`,
                ),
              )
            }
          />
        )}
        {onDone && <Button title="Ver meu painel" icon="person" variant="tinted" onPress={onDone} style={{ alignSelf: "stretch", marginTop: 10 }} />}
        <Text variant="footnote" color="label2" style={{ marginTop: 16, textAlign: "center" }}>
          Enviamos a confirmação para o seu e-mail e você recebe um lembrete antes do horário.{" "}
          Para remarcar ou cancelar, fale com a Gabi.
        </Text>
      </View>
    );
  }

  // Serviços separados por categoria (Primeira aplicação, Manutenção, Outros).
  // Serviços de pés: só para clientes que a Gabi liberou (no link público ficam ocultos).
  const offered = services.filter((s) => allowFeet || !s.feet);
  const groups = SERVICE_CATEGORIES.map((c) => ({ ...c, services: offered.filter((s) => (s.category ?? "outros") === c.key) })).filter(
    (g) => g.services.length,
  );

  const slotGroups = PERIODS.map((p) => ({
    label: p.label,
    slots: (slots ?? []).filter((s) => p.test(Number(formatInTz(s, "H", timeZone)))),
  })).filter((g) => g.slots.length);

  return (
    <View>
      {/* Com cabeçalho (cliente logada), a seta do cabeçalho volta uma etapa: um "voltar" só. */}
      {!guest && step !== "service" && (
        <Stack.Screen
          options={{
            headerLeft: () => (
              <View style={{ paddingLeft: Platform.OS === "web" ? 16 : 0 }}>
                <HeaderButton icon="chevronLeft" accessibilityLabel="Voltar" onPress={back} />
              </View>
            ),
          }}
        />
      )}

      <View style={styles.topRow}>
        {guest && (
          <Pressable
            onPress={back}
            disabled={step === "service"}
            accessibilityLabel="Voltar"
            hitSlop={8}
            style={[styles.backButton, { backgroundColor: theme.surface, opacity: step === "service" ? 0 : 1 }]}
          >
            <Icon name="chevronLeft" size={18} color={theme.accent} weight="semibold" />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Progress step={step} labels={["Serviço", "Horário", guest ? "Seus dados" : "Confirmar"]} />
        </View>
      </View>

      {step === "service" && (
        <>
          <Text variant="title1">Escolha o serviço</Text>
          <Text color="label2" style={{ marginBottom: 18 }}>
            Toque no serviço para ver os horários livres.
          </Text>
          {groups.map((group) => (
            <View key={group.key} style={{ gap: 10, marginBottom: 18 }}>
              {groups.length > 1 && (
                <Text variant="overline" color="label2" style={{ marginLeft: 4, marginBottom: -2 }}>
                  {group.label.toUpperCase()}
                </Text>
              )}
              {group.services.map((s) => (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  onPress={() => {
                    tap();
                    setService(s);
                    setStep("time");
                    void loadSlots(s.id, day ?? days[0].key);
                  }}
                  style={({ pressed }) => [styles.serviceCard, { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Text variant="headline">{s.name}</Text>
                      {(s.combo_service_ids?.length ?? 0) > 0 && (
                        <View style={[styles.badge, { backgroundColor: theme.fill }]}>
                          <Text variant="caption" color="accent" style={{ fontWeight: "600" }}>
                            COMBO
                          </Text>
                        </View>
                      )}
                    </View>
                    {!!s.description && (
                      <Text variant="subhead" color="label2" numberOfLines={2}>
                        {s.description}
                      </Text>
                    )}
                    <View style={styles.meta}>
                      <Icon name="clock" size={13} color={theme.label3} />
                      <Text variant="footnote" color="label2">
                        {formatDuration(s.duration_min)}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.price, { color: theme.label }]}>{formatMoney(s.price_cents)}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </>
      )}

      {step === "time" && service && (
        <>
          <Text variant="title1">Escolha o horário</Text>
          <Pressable onPress={back} style={[styles.chosen, { backgroundColor: theme.surface }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "500" }}>{service.name}</Text>
              <Text variant="footnote" color="label2">
                {formatDuration(service.duration_min)} · {formatMoney(service.price_cents)}
              </Text>
            </View>
            <Text variant="subhead" color="accent">
              Trocar
            </Text>
          </Pressable>
          <Text variant="title3" style={{ marginBottom: 8 }}>
            {capitalize(days.find((d) => d.key === day)?.month ?? "")}
          </Text>
          <DayChips days={days} selected={day} onSelect={(key) => void loadSlots(service.id, key)} />
          {error && <Banner>{error}</Banner>}
          {!slots ? (
            <Loading />
          ) : slotGroups.length ? (
            slotGroups.map((g) => (
              <View key={g.label} style={{ marginBottom: 18 }}>
                <Text variant="overline" color="label2" style={{ marginBottom: 8 }}>
                  {g.label.toUpperCase()}
                </Text>
                <SlotChips
                  slots={g.slots.map((s) => formatInTz(s, "HH:mm", timeZone))}
                  onSelect={(label) => {
                    setSlot(g.slots.find((s) => formatInTz(s, "HH:mm", timeZone) === label));
                    setError(undefined);
                    setStep("details");
                  }}
                />
              </View>
            ))
          ) : (
            <View style={[styles.noSlots, { backgroundColor: theme.surface }]}>
              <Icon name="calendar" size={26} color={theme.label3} />
              <Text color="label2" style={{ textAlign: "center", marginTop: 8 }}>
                Sem horários livres neste dia.{"\n"}Escolha outro dia acima.
              </Text>
            </View>
          )}
        </>
      )}

      {step === "details" && service && slot && (
        <>
          <Text variant="title1" style={{ marginBottom: 16 }}>
            {guest ? "Seus dados" : "Confirmar"}
          </Text>
          <View style={[styles.summary, { backgroundColor: theme.accentStrong, marginBottom: 24 }]}>
            <Text variant="overline" style={{ color: theme.champagne }}>
              SEU HORÁRIO
            </Text>
            <Text style={[styles.summaryTime, { color: theme.onAccent }]}>{formatInTz(slot, "HH:mm", timeZone)}</Text>
            <Text style={{ color: theme.onAccent }}>{capitalize(formatInTz(slot, "EEEE, d 'de' MMMM", timeZone))}</Text>
            <Text variant="subhead" style={{ color: theme.onAccent, opacity: 0.7 }}>
              {service.name} · {formatDuration(service.duration_min)} · {formatMoney(service.price_cents)}
            </Text>
          </View>

          {guest && (
            <Section
              header="Seu e-mail"
              footer={
                known === "unknown"
                  ? "Se você já agendou antes, não precisa preencher seus dados de novo."
                  : known === "client"
                    ? "Que bom te ver de novo! Seus dados já estão com a Gabi."
                    : "Primeira vez por aqui: preencha seus dados abaixo."
              }
            >
              {known === "unknown" ? (
                <FormRow label="E-mail">
                  <Input
                    value={profile.email}
                    onChangeText={setField("email")}
                    placeholder="voce@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoFocus={!profile.email}
                    onSubmitEditing={lookupEmail}
                    returnKeyType="next"
                  />
                </FormRow>
              ) : (
                <FormRow label="E-mail">
                  <Text color="label2" numberOfLines={1} style={{ flex: 1 }}>
                    {email}
                  </Text>
                  <Pressable hitSlop={8} onPress={changeEmail} accessibilityRole="button">
                    <Text color="accent" style={{ fontWeight: "500" }}>
                      Trocar
                    </Text>
                  </Pressable>
                </FormRow>
              )}
              {known === "client" && usePassword && (
                <FormRow label="Senha">
                  <Input
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Sua senha"
                    secureTextEntry
                    autoComplete="current-password"
                    textContentType="password"
                    autoFocus
                    onSubmitEditing={confirmPassword}
                  />
                </FormRow>
              )}
            </Section>
          )}
          {guest && known === "new" && (
            <Section header="Seus dados" footer="Usamos seu telefone para confirmar o horário e enviar o lembrete.">
              <FormRow label="Nome">
                <Input value={profile.name} onChangeText={setField("name")} placeholder="Nome e sobrenome" textContentType="name" autoComplete="name" />
              </FormRow>
              <FormRow label="Telefone">
                <Input value={profile.phone} onChangeText={setField("phone")} placeholder="(11) 99999-8888" keyboardType="phone-pad" autoComplete="tel" />
              </FormRow>
              <SwitchRow label="Este número é WhatsApp" value={profile.whatsapp} onValueChange={setField("whatsapp")} />
              <FormRow label="Instagram">
                <Input value={profile.instagram} onChangeText={setField("instagram")} placeholder="@seuperfil" autoCapitalize="none" autoCorrect={false} />
              </FormRow>
            </Section>
          )}
          {(!guest || known !== "unknown") && (
            <Section header="Observações">
              <TextAreaRow value={notes} onChangeText={setNotes} placeholder="Ideia de cor, referência, alguma alergia... (opcional)" />
            </Section>
          )}
          {error && <Banner>{error}</Banner>}
          {guest && known === "unknown" ? (
            <Button title="Continuar" onPress={lookupEmail} loading={busy} disabled={!email} />
          ) : guest && known === "client" && usePassword ? (
            <>
              <Button title="Entrar e agendar" onPress={confirmPassword} loading={busy} disabled={!password} />
              <Pressable hitSlop={8} onPress={() => setUsePassword(false)} style={{ alignSelf: "center", marginTop: 14 }}>
                <Text variant="subhead" color="accent">
                  Esqueci a senha · receber código por e-mail
                </Text>
              </Pressable>
            </>
          ) : guest ? (
            <>
              <Button title="Enviar código por e-mail" icon="message" onPress={sendCode} loading={busy} />
              {known === "client" && knownHasPassword && (
                <Pressable hitSlop={8} onPress={() => setUsePassword(true)} style={{ alignSelf: "center", marginTop: 14 }}>
                  <Text variant="subhead" color="accent">
                    Entrar com senha
                  </Text>
                </Pressable>
              )}
              <Text variant="footnote" color="label2" style={{ textAlign: "center", marginTop: 10 }}>
                Para sua segurança, o horário só é reservado depois que você confirmar o código.
              </Text>
            </>
          ) : (
            <Button title="Confirmar agendamento" onPress={confirmLogged} loading={busy} />
          )}
        </>
      )}

      {step === "code" && service && slot && (
        <>
          <Text variant="title1">Confirme seu e-mail</Text>
          <Text color="label2" style={{ marginTop: 4, marginBottom: 24 }}>
            Enviamos um código de 6 números para <Text style={{ fontWeight: "600" }}>{profile.email.trim().toLowerCase()}</Text>.
          </Text>
          <View style={[styles.codeBox, { backgroundColor: theme.surface }]}>
            <Input
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              style={[styles.codeInput, { color: theme.label }]}
            />
          </View>
          {error && <Banner>{error}</Banner>}
          <Button title="Confirmar agendamento" onPress={confirmCode} loading={busy} disabled={code.length < 6} />
          <View style={styles.codeLinks}>
            <Pressable
              hitSlop={8}
              onPress={() => {
                changeEmail();
                setStep("details");
              }}
            >
              <Text variant="subhead" color="accent">
                Trocar e-mail
              </Text>
            </Pressable>
            <Pressable hitSlop={8} disabled={waitSeconds > 0 || busy} onPress={sendCode}>
              <Text variant="subhead" color={waitSeconds > 0 ? "label3" : "accent"}>
                {waitSeconds > 0 ? `Reenviar em ${waitSeconds}s` : "Reenviar código"}
              </Text>
            </Pressable>
          </View>
          <Text variant="footnote" color="label2" style={{ textAlign: "center", marginTop: 16 }}>
            Não chegou? Veja a caixa de spam ou promoções.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 24 },
  backButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: -6 },
  progress: { flexDirection: "row", gap: 8 },
  progressBar: { height: 3, borderRadius: 2 },
  serviceCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 16, borderCurve: "continuous" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  price: { fontFamily: Serif.semibold, fontSize: 20, fontVariant: ["lining-nums"] },
  chosen: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14, marginTop: 12, marginBottom: 22, borderCurve: "continuous" },
  noSlots: { borderRadius: 16, paddingVertical: 32, paddingHorizontal: 16, alignItems: "center" },
  check: { width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  summary: { alignSelf: "stretch", borderRadius: 18, padding: 20, borderCurve: "continuous" },
  summaryTime: { fontFamily: Serif.medium, fontSize: 44, lineHeight: 50, marginTop: 4, fontVariant: ["lining-nums"] },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  codeBox: { borderRadius: 16, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 16, borderCurve: "continuous" },
  codeInput: { fontSize: 32, letterSpacing: 12, textAlign: "center", fontWeight: "600", paddingVertical: 10, fontVariant: ["tabular-nums"] },
  codeLinks: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingHorizontal: 4 },
});
