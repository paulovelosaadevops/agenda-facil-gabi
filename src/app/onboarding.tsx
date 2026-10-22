import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Logo } from "@/components/logo";
import { Banner, Button, FormRow, Input, Section, Text } from "@/components/ui";
import { normalizePhone } from "@shared/format.ts";
import { useAuth } from "@/lib/auth";
import { Brand } from "@/lib/brand";
import { dbErrorMessage, supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export default function Onboarding() {
  const theme = useTheme();
  const { session, refresh } = useAuth();
  const [name, setName] = useState(Brand.fullName);
  const [slug, setSlug] = useState("gabriela-marqui");
  const [slugTouched, setSlugTouched] = useState(false);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(undefined);
    if (name.trim().length < 2) return setError("Informe o nome do estúdio.");
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) return setError("O link deve ter de 3 a 40 letras minúsculas, números ou hífen.");
    const normalizedPhone = phone ? normalizePhone(phone) : null;
    if (phone && !normalizedPhone) return setError("WhatsApp inválido. Use DDD + número.");

    setLoading(true);
    const { data: business, error: insertError } = await supabase
      .from("businesses")
      .insert({ owner_id: session!.user.id, name: name.trim(), slug, phone: normalizedPhone })
      .select("id")
      .single();
    if (insertError) {
      setLoading(false);
      return setError(insertError.code === "23505" ? "Esse link já está em uso. Escolha outro." : dbErrorMessage(insertError));
    }

    // Expediente inicial: terça a sábado, 9h–12h e 13h–19h. Ela ajusta em Ajustes › Expediente.
    const hours = [2, 3, 4, 5, 6].flatMap((weekday) => [
      { business_id: business.id, weekday, start_time: "09:00", end_time: "12:00" },
      { business_id: business.id, weekday, start_time: "13:00", end_time: "19:00" },
    ]);
    await supabase.from("working_hours").insert(hours);
    await refresh(); // o layout raiz leva para o painel
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
          <View style={{ alignItems: "center", marginBottom: 28 }}>
            <Logo width={220} />
            <Text variant="title1" style={{ marginTop: 24 }}>
              Seu estúdio
            </Text>
            <Text color="label2" style={{ marginTop: 4, textAlign: "center", maxWidth: 320 }}>
              Já deixamos um expediente de terça a sábado. Depois, cadastre seus serviços em Ajustes.
            </Text>
          </View>

          <Section footer="Identificador do estúdio. Suas clientes agendam pelo link /agendar.">
            <FormRow label="Nome">
              <Input
                value={name}
                placeholder="Studio Bella"
                autoComplete="organization"
                onChangeText={(v) => {
                  setName(v);
                  if (!slugTouched) setSlug(slugify(v));
                }}
              />
            </FormRow>
            <FormRow label="Link">
              <Input
                value={slug}
                placeholder="studio-bella"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(v) => {
                  setSlugTouched(true);
                  setSlug(slugify(v));
                }}
              />
            </FormRow>
          </Section>
          <Section footer="Opcional. Aparece para as clientes na página de agendamento.">
            <FormRow label="WhatsApp">
              <Input value={phone} onChangeText={setPhone} placeholder="(11) 99999-8888" keyboardType="phone-pad" />
            </FormRow>
          </Section>

          {error && <Banner>{error}</Banner>}
          <Button title="Continuar" onPress={submit} loading={loading} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
