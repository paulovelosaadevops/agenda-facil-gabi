# Agenda Fácil 💅

Plataforma de gestão para nail designers: agenda, clientes, serviços, link público de agendamento,
lembretes por WhatsApp e IA (atendente virtual no WhatsApp e gerador de legendas para o Instagram).

**Stack:** Next.js 16 (App Router, Cache Components) · Supabase (Postgres + Auth + RLS) · Tailwind 4 · Claude API (`@anthropic-ai/sdk`).

## Rodando localmente

Pré-requisitos: Node 22+ e Docker.

```bash
npm install
npm run db:start            # sobe o Supabase local e aplica supabase/migrations
cp .env.example .env.local  # preencha com as chaves que o comando acima imprimiu
npm run dev
```

Abra http://localhost:3000, crie uma conta e configure o estúdio. O onboarding já cria um expediente
(terça a sábado) e alguns serviços de exemplo.

Para a IA, coloque sua chave em `ANTHROPIC_API_KEY` (https://console.anthropic.com/).

## Funcionalidades

| Área | Rota | O que faz |
|---|---|---|
| Início | `/painel` | Agenda do dia, faturamento do mês, aniversariantes, link público |
| Agenda | `/painel/agenda` | Visão por dia, novo agendamento, concluir/faltou/cancelar |
| Clientes | `/painel/clientes` | Cadastro, busca, ficha com histórico e total gasto |
| Serviços | `/painel/servicos` | Preço, duração, descrição (usada pela IA), ativar/desativar |
| IA | `/painel/ia` | Legendas a partir da foto + simulador da atendente do WhatsApp |
| Ajustes | `/painel/configuracoes` | Dados do estúdio, regras de agendamento, expediente, folgas, instruções da IA |
| Público | `/agendar/{slug}` | A cliente escolhe serviço, dia e horário livre e agenda sozinha |

## Como funciona

- **Disponibilidade** (`src/lib/availability.ts`): função pura que cruza expediente, agendamentos,
  bloqueios, antecedência mínima e máxima no fuso do estúdio. Coberta por testes (`npm test`).
- **Reserva** (`src/lib/booking.ts`): uma única função usada pelo painel, pela página pública e pela IA.
  Uma *exclusion constraint* no Postgres impede horários sobrepostos mesmo com requisições simultâneas.
- **WhatsApp** (`src/lib/messaging/`): interface `MessagingProvider`. Hoje há só o provedor `console`
  (registra no log). Para ativar um provedor real, implemente `sendText` e `parseWebhook` num novo arquivo e
  registre em `index.ts`; depois aponte o webhook do provedor para
  `POST /api/whatsapp/{slug}?token=WHATSAPP_WEBHOOK_SECRET`.
- **IA no WhatsApp** (`src/lib/ai/assistant.ts`): Claude com ferramentas para listar serviços, consultar
  horários, agendar, listar e cancelar agendamentos da própria cliente (o telefone vem da conversa, nunca do modelo).
  Teste pelo simulador em `/painel/ia` sem precisar de provedor.
- **Lembretes** (`/api/cron/reminders`): roda de hora em hora (`vercel.json`) e envia lembrete
  `reminder_hours_before` horas antes. Exige `Authorization: Bearer CRON_SECRET`.

### Testar o webhook localmente

```bash
curl -X POST "http://localhost:3000/api/whatsapp/SEU-SLUG?token=SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"from":"5511999998888","name":"Ana","text":"Oi! Tem horário amanhã?"}'
```

A resposta da IA aparece no terminal do `npm run dev` (provedor `console`).

## Scripts

`npm run dev` · `npm run build` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run db:start` / `db:stop` / `db:reset`

## Deploy

1. Crie um projeto em supabase.com e rode `npx supabase link` + `npx supabase db push`.
2. Importe o repositório na Vercel e configure as variáveis do `.env.example`.
3. Em Supabase → Authentication → URL Configuration, cadastre a URL de produção.
