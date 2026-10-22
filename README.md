# Gabriela Marqui Nail Designer — Agenda

App de gestão do estúdio da Gabi: agenda (dia, semana e mês), clientes, serviços e combos,
agendamento pelas próprias clientes (com login), alertas de manutenção, arte de horários livres
para o WhatsApp/Instagram e lembretes por WhatsApp. A IA (atendente e legendas) já está no código,
mas fica escondida por enquanto.

Um único código roda no **iPhone, Android e web**.

| Camada | Tecnologia |
|---|---|
| App (iOS, Android, web) | Expo SDK 57 · Expo Router · React Native 0.86 |
| Banco e login | Supabase (Postgres + Auth + Row Level Security) |
| Servidor | Supabase Edge Functions (Deno) + `pg_cron` |
| IA | Claude API (`@anthropic-ai/sdk`) |
| Publicação | EAS Hosting (web) · EAS Build/Submit (App Store e Play Store) |

## Rodando localmente

Pré-requisitos: Node 22+ e Docker.

```bash
npm install
npm run db:start                                   # Supabase local (portas 553xx) + Edge Functions
cp .env.example .env.local                         # já vem com a URL local; cole a PUBLISHABLE_KEY que o db:start imprimiu
cp supabase/functions/.env.example supabase/functions/.env   # segredos das funções (ANTHROPIC_API_KEY etc.)
npm run web                                        # abre no navegador
```

### No iPhone (Expo Go)

1. Instale o **Expo Go** na App Store.
2. O celular precisa enxergar o Supabase: troque `127.0.0.1` em `EXPO_PUBLIC_SUPABASE_URL` pelo IP do computador
   na rede (ex.: `http://192.168.0.10:55321`) ou use um projeto Supabase na nuvem.
3. `npm start` e leia o QR code com a câmera.

Todas as bibliotecas usadas estão incluídas no Expo Go, então não é preciso gerar um build para testar.

> O projeto usa o **SDK 57** porque é o que o Expo Go da App Store suporta. Quando o Expo Go for atualizado
> para o SDK 58, atualize com `npx expo install expo@^58 --fix`. Única mudança de código conhecida: o import das
> abas nativas passa de `expo-router/unstable-native-tabs` para `expo-router/native-tabs`.

## Estrutura

```
src/app/                  telas (Expo Router)
  (painel)/               abas da Gabi: inicio, agenda, clientes, ajustes
    _layout.tsx           abas nativas (iOS/Android)
    _layout.web.tsx       barra lateral / barra inferior (web)
    agenda/horarios.tsx   arte de horários livres (stories/post) para compartilhar
  agendar.tsx             link que a Gabi compartilha: agendamento passo a passo sem login
  cliente/                área da cliente: horários, manutenção, agendar, perfil
  login, cadastro, onboarding
src/components/           componentes no estilo iOS (listas agrupadas, linhas, seletores nativos)
src/lib/                  Supabase, sessão, tema, hooks de dados
supabase/
  migrations/             schema, RLS, restrição anti-conflito, cron dos lembretes
  functions/
    _shared/              regras de horário e reserva, IA, WhatsApp — usado pelo app, pelas funções e pelos testes
    public-booking/       info do estúdio, horários livres e reserva (com conta ou sem login)
    panel/                ações do painel que precisam do servidor (confirmação, IA, simulador)
    whatsapp-webhook/     mensagens recebidas → atendente virtual
    reminders/            lembretes (chamado de hora em hora pelo pg_cron)
```

### Regras do estúdio

- **Estúdio único:** a primeira conta criada configura o estúdio (é a Gabi).
- **Link `/agendar`:** agendamento passo a passo sem senha (serviço → horário → dados obrigatórios → **código por e-mail**).
  O horário só é reservado depois que a cliente digita o código de 6 números enviado ao e-mail (login sem senha do
  Supabase Auth): na primeira vez isso cria a conta dela com os dados informados; depois, só entra.
  Modelo do e-mail: `supabase/templates/codigo.html` (configurado em `supabase/config.toml`).
  Em produção, configure um SMTP próprio no Supabase (ex.: Resend): o envio padrão do Supabase é limitado e só serve para testes.
  SMS: dá para trocar/adicionar o envio por SMS (`signInWithOtp({ phone })`) ligando um provedor como Twilio no Supabase (pago por mensagem).
- **Sem duplicidade:** cada cliente tem login e senha; o telefone é único. Se a Gabi já tinha cadastrado a cliente,
  a conta nova assume essa ficha. A cliente pode ter **um agendamento por dia** — para mais serviços, a Gabi cria **combos**.
- **Intervalo entre atendimentos** (padrão 30 min, em Ajustes › Agendamento): um serviço das 9h às 11h bloqueia a
  agenda até 11h30. Uma **restrição de exclusão** no Postgres garante isso mesmo com reservas simultâneas.
- **Bloqueios:** a Gabi escolhe o dia e toca nos horários (ou dia inteiro / vários dias). Horários seguidos viram um bloqueio só.
- **Horários livres:** a Gabi marca os horários que quer divulgar em cada dia; a arte e o texto do WhatsApp usam só esses.
  As escolhas ficam salvas por dia da semana (`businesses.poster_times`) e já vêm marcadas na semana seguinte, quando livres.
- **Notificações da Gabi:** cada agendamento pelo link gera uma notificação (trigger no banco) que aparece no **sino** da
  Início em tempo real (Supabase Realtime) e, se ela ativou em Ajustes › Notificações no celular, como **Web Push** no app
  instalado (`public/sw.js`; chaves `VAPID_*` nos segredos e `EXPO_PUBLIC_VAPID_PUBLIC_KEY` no app). Também recebe e-mail.
- **Adicionar ao calendário:** a função `calendar` devolve o horário em `.ics` (aviso 2h antes) por link assinado
  (HMAC com `CRON_SECRET`). Aparece na tela final do agendamento, nos e-mails (com o `.ics` anexado) e no detalhe do
  agendamento no painel. No Supabase local, defina `PUBLIC_SUPABASE_URL` nas variáveis das funções.
- **Campos obrigatórios** da cliente: nome, telefone, WhatsApp (sim/não), Instagram e e-mail.
- **Manutenção:** no serviço, a Gabi define "retorno em N dias" e com quantos dias de antecedência avisar.
  A view `maintenance_alerts` alimenta o card na Início da Gabi e na área da cliente; o job de lembretes envia o
  WhatsApp para a cliente (uma vez por atendimento).
- **WhatsApp:** hoje o provedor `console` só registra no log. Para ativar um real, implemente `MessagingProvider`
  em `supabase/functions/_shared/messaging/` e aponte o webhook para
  `POST /functions/v1/whatsapp-webhook?slug=SEU-SLUG&token=WHATSAPP_WEBHOOK_SECRET`.

## Verificações

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint (config do Expo)
npm test            # regras de horário e formatação
npm run test:integration   # + RLS, conflitos e reservas — só em um banco VAZIO (recusa rodar se já existir estúdio)
npx expo-doctor     # dependências e configuração
```

## Publicando

Produção: app em **https://agenda-facil-gabi.expo.app** (EAS Hosting, projeto `@paulovelosaaa/agenda-facil`) e
Supabase **Agenda Fácil** (`fvglaxfkefuyfejwteip`). As chaves públicas ficam em `.env.production` (não versionado).

```bash
# Site (EAS Hosting). Carrega as variáveis de produção antes (o .env.local aponta para o Supabase local).
set -a; . ./.env.production; set +a
npx expo export -p web --clear && npx eas-cli deploy --prod

# Banco: esta rede bloqueia a porta 5432, então as migrações vão pela API (HTTPS):
npx supabase db query --linked -f supabase/migrations/<nova>.sql
npx supabase db query --linked "insert into supabase_migrations.schema_migrations(version, name) values ('<versão>', '<nome>')"
# (em outra rede: npx supabase db push --linked)

# Funções e segredos
npx supabase functions deploy --project-ref fvglaxfkefuyfejwteip --use-api
npx supabase secrets set --project-ref fvglaxfkefuyfejwteip BREVO_API_KEY=... EMAIL_FROM=...

# Login (endereço do app, modelos de e-mail): bloco [remotes.production] do supabase/config.toml
npx supabase config push --project-ref fvglaxfkefuyfejwteip
```

Segredos das funções em produção: `APP_URL`, `CRON_SECRET` (o mesmo guardado no Vault como `cron_secret`),
`MESSAGING_PROVIDER`, `WHATSAPP_WEBHOOK_SECRET`, `EMAIL_FROM_NAME` e, com o Brevo, `BREVO_API_KEY` e `EMAIL_FROM`.
O Vault também guarda `project_url`, usado pelo pg_cron para chamar os lembretes de hora em hora.
