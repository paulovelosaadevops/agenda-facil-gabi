# Mudança no login (Nail e clientes)

> **Status:** em andamento. Plano aprovado e decisões D1–D6 tomadas em 05/11/2026.
> Retome pela seção [Progresso](#progresso). Cada etapa só começa depois de aprovada.

## Problema

- **Nail** (admin, dona do sistema — a Gabi): a tela de acesso mostra "Criar conta", o que não faz sentido. Ninguém deve conseguir se cadastrar como Nail. A conta dela é criada só por seed/script ou direto no Supabase.
- **Cliente**: não deve haver autocadastro. A conta da cliente nasce de dois jeitos:
  - **(a)** automaticamente no primeiro agendamento (nome + telefone; se o telefone já existir, vincula à cliente existente, sem duplicar);
  - **(b)** quando a Nail cadastra a cliente pelo painel.
- O login da cliente deve ser **sem senha**. O método (link mágico por e-mail, código por WhatsApp/SMS ou outro) ainda não foi decidido.

### Regras

- Bloquear o cadastro **no backend** (Supabase Auth/RLS), não só esconder o botão.
- O perfil (Nail ou Cliente) é definido **no servidor**, nunca pelo front.
- Contas existentes continuam funcionando.
- **Fora do escopo:** agenda, serviços e preços. Só o que envolve autenticação.

---

## Mapa do sistema atual

### Provedor de autenticação
- **Supabase Auth** (`@supabase/supabase-js`), sessão guardada no aparelho ([src/lib/supabase.ts](../src/lib/supabase.ts), [src/lib/storage.ts](../src/lib/storage.ts)).
- Métodos em uso: **e-mail + senha** (Nail e clientes que criaram senha) e **código de 6 dígitos por e-mail** (OTP, `signInWithOtp` + `verifyOtp`). O e-mail do código sai pelo SMTP configurado no Supabase (Brevo), com o modelo [supabase/templates/codigo.html](../supabase/templates/codigo.html).
- Configuração local em [supabase/config.toml](../supabase/config.toml): `enable_signup = true`, `[auth.email] enable_signup = true`, `enable_confirmations = false`, SMS desligado, nenhum login social. **Em produção a configuração do Auth é aplicada separadamente** (`supabase config push` ou painel do Supabase); precisa ser conferida antes da Etapa 3.

### Como Nail e Cliente são diferenciadas
- O papel é **derivado do banco** em [src/lib/auth.tsx](../src/lib/auth.tsx) (`loadProfile`):
  - **Nail (`owner`)**: existe uma linha em `businesses` com `owner_id = usuário`.
  - **Cliente (`client`)**: existe uma linha em `clients` com `user_id = usuário`.
  - **`none`**: nenhuma das duas (ex.: conta criada sem ficha).
- No servidor, as Edge Functions usam `requireOwner` / `requireClient` em [supabase/functions/_shared/http.ts](../supabase/functions/_shared/http.ts), com a mesma lógica (dono do estúdio / ficha com `user_id`).
- **Ponto fraco:** a ficha da cliente nasce do **`raw_user_meta_data` enviado pelo front** no cadastro (`role: "client"`, nome, telefone...). Ou seja, quem decide que a conta vira "cliente" é o front, via metadados.

### Telas e rotas
| Rota | Arquivo | O que faz hoje |
|---|---|---|
| `/` | [src/app/index.tsx](../src/app/index.tsx) | Redireciona: sem sessão → `/login`; Nail → `/inicio`; cliente → `/cliente`; sem estúdio → `/onboarding` |
| `/login` | [src/app/login.tsx](../src/app/login.tsx) + [src/components/auth-form.tsx](../src/components/auth-form.tsx) | E-mail + senha. **Tem o link "Ainda não tem conta? Criar conta"** → `/cadastro` |
| `/cadastro` | [src/app/cadastro.tsx](../src/app/cadastro.tsx) | Com estúdio: **autocadastro de cliente** com e-mail + senha ([client-signup.tsx](../src/components/client-signup.tsx), `supabase.auth.signUp`). Sem estúdio: **cadastro da Nail** (`AuthForm mode="signup"`) |
| `/onboarding` | [src/app/onboarding.tsx](../src/app/onboarding.tsx) | Primeira instalação: quem criou a conta **cria o estúdio e vira Nail** |
| `/entrar` | [src/app/entrar.tsx](../src/app/entrar.tsx) | Login da cliente: e-mail + senha, ou "primeiro acesso / esqueci a senha" com código por e-mail (`shouldCreateUser: false`) |
| `/agendar` | [src/app/agendar.tsx](../src/app/agendar.tsx) + [src/components/booking-flow.tsx](../src/components/booking-flow.tsx) | Link público de agendamento (ver abaixo) |
| `/cliente/perfil` | [src/components/create-password.tsx](../src/components/create-password.tsx) | A cliente pode **criar senha** (marca `has_password` no metadado) |
| Guardas | [src/app/_layout.tsx](../src/app/_layout.tsx) | `Stack.Protected`: `login`/`cadastro` só sem sessão; `onboarding` só com conta sem perfil e sem estúdio; `(painel)` só Nail; `cliente` só cliente |

### Fluxo de agendamento (link público `/agendar`)
1. Serviço → dia e horário (sem login).
2. "Seus dados": pede **primeiro o e-mail**; o servidor responde se já é cliente (`public-booking`, ação `lookup`).
   - **Já é cliente:** só confirma com **código por e-mail** ou **senha** (se tiver).
   - **Primeira vez:** pede **nome, telefone, WhatsApp (sim/não), Instagram** e envia o código com `signInWithOtp({ shouldCreateUser: true, data: {role: "client", ...} })`. **Isso cria a conta no Supabase Auth** e o gatilho do banco cria a ficha.
3. Com o código confirmado, a reserva é feita pela função `public-booking` (ação `book`), que exige cliente logada (`requireClient`). Se a conta existe sem ficha, a ficha é recriada com os dados enviados.
- Cliente já logada no aparelho: `/agendar` leva direto para `/cliente/agendar` (sem código).

### A Nail já cadastra clientes? Sim
- Tela [src/app/(painel)/clientes/form.tsx](../src/app/(painel)/clientes/form.tsx): insere em `clients` direto pelo Supabase (RLS "owner manages clients").
- No "Novo agendamento" do painel, "+ Nova cliente" cria a ficha pela função `panel` (`upsertClientProfile`, por telefone, sem duplicar).
- Essas fichas **não têm conta de login** (`user_id` nulo). A conta só passa a existir quando a cliente faz o primeiro código pelo link: o gatilho **liga a conta nova à ficha que tem o mesmo telefone**.
- O assistente do WhatsApp ([ai/assistant.ts](../supabase/functions/_shared/ai/assistant.ts)) também cria fichas por telefone (`findOrCreateClient`), mas está **inativo** (sem provedor de WhatsApp).

### Banco: RLS, policies e gatilhos ligados à autenticação
Migrations em [supabase/migrations/](../supabase/migrations/).
| Objeto | Onde | Efeito |
|---|---|---|
| `business_exists()` | `20261022000000_regras_gabi.sql` | RPC pública (anon) usada para saber se é a primeira instalação |
| Policy **"first user creates the business"** (insert em `businesses`) | idem | **Qualquer usuário logado cria o estúdio se ainda não existir** → vira Nail. Hoje o estúdio existe, então está fechado na prática, mas a porta existe |
| "owner reads/updates business" | idem | Nail lê e altera o próprio estúdio |
| `owns_business()` + "owner manages …" | `20261020000000_init.sql` | Nail gerencia serviços, expediente, bloqueios, clientes, agendamentos; lê mensagens |
| "client reads own profile" / **"client updates own profile"** | `regras_gabi` | Cliente lê e **altera a própria ficha** (qualquer coluna, exceto `feet`, protegida pelo gatilho `protect_client_feet`) |
| "client reads own appointments" | `regras_gabi` | Cliente lê só os próprios agendamentos |
| "authenticated reads services" | `regras_gabi` | Qualquer logado lê serviços não arquivados |
| Gatilho **`on_auth_user_created_client`** → `handle_new_client()` | `regras_gabi` | A cada usuário novo no Auth **com `role = client` no metadado do front**: cria a ficha ou liga à ficha de mesmo telefone sem conta; telefone já ligado a outra conta → recusa o cadastro |
| `push_subscriptions`, `notifications` | `20261025000000_notificacoes_app.sql` | Só a Nail (`owns_business`) |

### O que existe no banco de produção hoje (05/11/2026)
- **1 conta**: a da Nail (e-mail + senha). **Nenhuma conta de cliente.**
- **2 clientes**, ambas **sem conta de login** e com e-mail (cadastradas pelo painel).
- 2 agendamentos.
- (A produção foi zerada em 25/10/2026; backup em `backups/`, fora do git.)

### Por onde alguém consegue criar conta hoje
1. Botão "Criar conta" → `/cadastro` → `signUp` com e-mail + senha (vira cliente).
2. Link `/agendar` → `signInWithOtp` com `shouldCreateUser: true` (vira cliente).
3. **Direto na API do Supabase Auth**, com a chave pública (que está no site): `signUp` ou OTP com criação. Com `role: client` vira cliente; sem isso fica uma conta "sem perfil". **Esconder botões não fecha esta porta**: só desligando o cadastro no Auth.
4. Se um dia não existir estúdio: a primeira conta vira Nail pelo `/onboarding`.

---

## Opções de login da cliente (sem senha)

Contexto da stack: Supabase Auth, e-mails pelo Brevo (SMTP já configurado), site como PWA (instalável no celular) e app Expo. **Não há provedor de WhatsApp nem de SMS configurado**, e hoje a decisão do projeto é não ter WhatsApp automático.

| Opção | Prós | Contras | Esforço / custo |
|---|---|---|---|
| **1. Código de 6 dígitos por e-mail** (OTP) | **Já funciona** no app e no site; não sai do app (digita o código); o iPhone sugere o código do e-mail; custo zero (Brevo grátis até 300 e-mails/dia); nenhum provedor novo | Exige e-mail de toda cliente; e-mail pode cair no spam ou demorar; trocar de app para ler o e-mail | Baixo / R$ 0 |
| **2. Link mágico por e-mail** | Um toque, sem digitar código | **Problemático no PWA e no app**: o link abre no navegador padrão, não no app instalado, e a sessão fica no lugar errado; leitores de e-mail corporativo podem "clicar" no link e queimá-lo; no app nativo exige deep link (`agendafacil://`) e redirect configurados no Supabase | Médio / R$ 0 |
| **3. Código por SMS** | Usa o telefone, que toda cliente tem e que já é a chave da ficha (casa com "nome + telefone"); não precisa de e-mail | Provedor novo (Twilio, Vonage ou MessageBird) ligado ao Supabase; **custo por SMS** (~R$ 0,20–0,50 no Brasil); SMS às vezes atrasa ou é filtrado pela operadora; troca de número exige suporte | Médio / custo por envio |
| **4. Código por WhatsApp** | **Melhor experiência no Brasil** (todas usam WhatsApp); usa o telefone; alta entrega | Supabase só faz via **Twilio WhatsApp**: exige conta Meta Business verificada, número aprovado e modelo de mensagem de autenticação aprovado; custo por mensagem (~US$ 0,03–0,05); é a primeira peça de "WhatsApp automático", que hoje o projeto decidiu não ter | Alto / custo por envio |
| **5. Híbrido**: e-mail agora, telefone depois | Entrega já, sem custo; o desenho (conta criada no servidor, telefone como chave) deixa trocar o canal depois sem refazer nada | Por enquanto continua exigindo e-mail | Baixo agora |

**Recomendação:** **opção 1 (código por e-mail)** agora, desenhada como a **5** (identidade da cliente decidida no servidor e telefone como chave). Assim dá para ligar SMS ou WhatsApp no futuro só trocando o canal do código. O link mágico (2) não é recomendado por causa do PWA e do app instalado.

> Observação: o requisito diz que a conta nasce com "nome + telefone". Com código por e-mail, o **e-mail continua obrigatório** no primeiro agendamento (é por onde o código chega). Com SMS/WhatsApp, o e-mail passaria a ser opcional. Ver [Decisões](#decisões).

---

## Plano em etapas

A ordem evita deixar o agendamento fora do ar: primeiro o servidor passa a criar as contas, depois o front deixa de criar, e **só então** o cadastro é fechado no Auth.

### Etapa 1 — Contas de cliente criadas pelo servidor
- Nova ação na função `public-booking` (ex.: `request-code`): recebe e-mail (e nome + telefone quando for a primeira vez), e **no servidor**:
  - acha a ficha pelo e-mail ou pelo telefone (sem duplicar);
  - se a cliente ainda não tem conta, **cria a conta com a API de admin** (`auth.admin.createUser`, e-mail já confirmado) e grava o papel em **`app_metadata`** (`role: "client"`), que **só o servidor pode alterar** (o `user_metadata` atual é editável pelo próprio usuário);
  - liga a conta à ficha (`clients.user_id`) e dispara o código (`shouldCreateUser: false`).
- Mesma lógica para o caminho (b): ao entrar pela primeira vez, a cliente cadastrada pela Nail recebe a conta ligada à ficha existente. *(Ver decisão D3: criar a conta já no cadastro pelo painel ou só no primeiro acesso.)*
- Testes locais (como os de 26/10): primeira vez, cliente que volta, ficha criada pela Nail, telefone já usado por outra conta.

### Etapa 2 — Front sem autocadastro e cliente sem senha
- Remover "Criar conta" do `/login` e a rota `/cadastro` (com [client-signup.tsx](../src/components/client-signup.tsx) e o modo `signup` do [auth-form.tsx](../src/components/auth-form.tsx)).
- `/login` vira **só da Nail** (e-mail + senha).
- Cliente: `/entrar` e `/agendar` só com **código** (sem senha); remover "criar senha" e "entrar com senha" ([create-password.tsx](../src/components/create-password.tsx), trechos do [booking-flow.tsx](../src/components/booking-flow.tsx) e do [cliente/perfil.tsx](../src/app/cliente/perfil.tsx)).
- O link `/agendar` passa a usar a ação da Etapa 1 em vez de `signInWithOtp` com criação de conta.
- Remover `/onboarding` do fluxo normal (o estúdio é criado pelo script da Etapa 4).
- **Boas-vindas no primeiro acesso (D7):** tela curta explicando como funciona o agendamento (escolher serviço e horário, código por e-mail, confirmação na véspera pelo WhatsApp, lembrete por e-mail, como remarcar). Aparece uma vez e fica acessível depois no painel da cliente.

### Etapa 3 — Fechar o cadastro no backend
- **Supabase Auth: desligar cadastro** (`enable_signup = false` e `[auth.email] enable_signup = false`) no local e **em produção**. A API de admin, usada pelo servidor, continua podendo criar contas.
- Migration:
  - remover a policy **"first user creates the business"** (ninguém vira Nail pelo app);
  - trocar o gatilho `handle_new_client` (que confia no metadado do front) pela lógica da Etapa 1, ou restringi-lo a `app_metadata`;
  - limitar o que a cliente pode alterar na própria ficha (ex.: não trocar `phone`/`email`/`user_id`/`business_id`), se aprovado (D5);
  - revisar `business_exists()` (deixa de ser necessária para o app).
- Verificação: `signUp` e `signInWithOtp` com criação, feitos direto na API com a chave pública, **devem falhar**; inserir em `businesses` como usuário comum **deve falhar**.

### Etapa 4 — Conta da Nail por script e contas existentes
- Script versionado (ex.: `scripts/criar-nail.ts`, com a chave de serviço, rodado manualmente) para criar a conta da Nail e o estúdio quando preciso (novo ambiente, recuperação).
- Marcar a conta atual da Nail com `app_metadata.role = "owner"`.
- Contas existentes: hoje só a da Nail; ela continua com e-mail + senha. Clientes que existirem até a publicação continuam entrando por código. Senhas de clientes deixam de ser usadas (não há nenhuma hoje).

### Etapa 5 — Testes e publicação
- Typecheck, lint, testes automatizados e de integração (com casos novos: cadastro bloqueado, papel definido pelo servidor, telefone sem duplicar).
- Publicar na ordem: migration → funções → configuração do Auth → site, conferindo o link de agendamento em produção a cada passo.

---

## Critérios de aceite

1. A tela de login **não tem** "Criar conta"; a rota `/cadastro` não existe.
2. **Ninguém consegue criar conta pela API pública** do Supabase (`signUp` e OTP com criação retornam erro), mesmo usando a chave pública direto.
3. **Ninguém vira Nail pelo app**: inserir em `businesses` como usuário comum falha; a conta da Nail só nasce por script ou pelo painel do Supabase.
4. **Primeiro agendamento** pelo link com nome + telefone (+ e-mail, se a decisão for código por e-mail) cria a conta da cliente; se o telefone já existir, **liga à ficha existente sem duplicar**.
5. **Cliente cadastrada pela Nail** consegue entrar pela primeira vez e cai na própria ficha (com o histórico).
6. A **cliente entra sem senha** (código), tanto em `/entrar` quanto no `/agendar`.
7. O **papel (Nail/Cliente) é decidido no servidor** (`app_metadata` e/ou tabelas), nunca por dado enviado pelo front.
8. A **conta atual da Nail continua entrando** com e-mail + senha; clientes existentes continuam entrando.
9. Agenda, serviços e preços **sem alteração de comportamento**.
10. Testes automatizados (unitários e de integração) passando, com casos novos cobrindo os itens 2–5.

---

## Decisões

| # | Decisão | Status |
|---|---|---|
| D1 | Método de login da cliente | ~~código de 6 dígitos por e-mail~~ **Substituída pela D8 (05/11).** |
| D8 | Login da cliente (substitui D1) | **Decidido (05/11):** cliente **tem senha**, definida no **primeiro agendamento** (depois de confirmar o código por e-mail e antes de acessar o painel). Login com e-mail + senha. O código por e-mail fica só para o **primeiro agendamento** e para **primeiro acesso / esqueci a senha**. No `/agendar`: "Já é minha cliente? Entre no seu painel" no topo; quem já tem senha e segue pelo fluxo de primeira vez entra com a senha ali mesmo, **sem perder serviço e horário**, e conclui o agendamento. Ao final, painel com boas-vindas e passo a passo do painel. *(O requisito original "login sem senha" foi revisto pelo usuário.)* |
| D2 | Dados obrigatórios no primeiro agendamento | **Decidido (05/11):** todos obrigatórios — nome, telefone, WhatsApp (sim/não), Instagram e e-mail |
| D3 | Cliente cadastrada pela Nail: quando nasce a conta de login | **Decidido (05/11):** no **primeiro acesso** (não no cadastro pelo painel) |
| D4 | Login da Nail | **Decidido (05/11):** continua com e-mail + senha |
| D5 | Cliente pode alterar telefone/e-mail da própria ficha? | **Decidido (05/11):** **não** — só a Nail altera telefone e e-mail |
| D6 | `/onboarding` atual (criação do estúdio) e `business_exists()` | **Decidido (05/11):** remover do app; o estúdio é criado só por script |
| D7 | Novo onboarding: tela de boas-vindas no **primeiro acesso**, explicando como funciona o agendamento | **Pedido em 05/11.** Entendido como tela da **cliente** (entra na Etapa 2). Confirmar se é só para a cliente ou também para a Nail |

---

## Progresso

- [x] **Etapa 0** — Mapeamento e plano (05/11/2026). Nenhum código alterado. Plano aprovado; decisões D1–D6 tomadas; D7 (boas-vindas) incluída na Etapa 2.
- [x] **Etapa 1** — Contas de cliente criadas pelo servidor (05/11/2026). **Só local, não publicada.** Aguardando aprovação.
  - Migration [20261105000000_login_servidor.sql](../supabase/migrations/20261105000000_login_servidor.sql): `auth_user_id_by_email()`, executável só pela chave de serviço.
  - [supabase/functions/_shared/client-account.ts](../supabase/functions/_shared/client-account.ts): `ensureClientAccount()` — acha a ficha pelo e-mail ou telefone (sem duplicar), cria a conta pela API de admin (`email_confirm`, `app_metadata.role = "client"`), liga `clients.user_id`; recusa e-mail da Nail, telefone ligado a outra conta e telefone com outro e-mail (D5); sem ficha e sem dados devolve `needsProfile`.
  - Função `public-booking`, ação nova **`request-code`** `{ email, profile? }`: garante a conta e envia o código com `shouldCreateUser: false`. Responde `{ needsProfile: true }` ou `{ sent: true }`; 429 no limite de envio. `publicClient()` novo em `_shared/http.ts`.
  - O front **ainda não usa** `request-code` (Etapa 2). A ação `lookup` e o fluxo atual seguem iguais.
  - Testes: 7 casos novos de integração em `booking.integration.test.ts` (42/42 passando com `npm run test:integration`, banco local resetado) + teste ponta a ponta local de `request-code` com o código lido do Mailpit (6/6).
  - Para publicar (quando aprovado): `npx supabase db push` (migration) e `npx supabase functions deploy public-booking`. É aditivo: não muda nada para quem usa o app hoje.
- [x] **Etapa 2** — Front sem autocadastro e cliente sem senha (05/11/2026). D7 feita como boas-vindas **da cliente**.
  - Removidos: `src/app/cadastro.tsx`, `src/app/onboarding.tsx`, `src/components/client-signup.tsx`, `src/components/create-password.tsx`; `studioExists`/`business_exists` saíram do app ([auth.tsx](../src/lib/auth.tsx), [_layout.tsx](../src/app/_layout.tsx), [index.tsx](../src/app/index.tsx)).
  - `/login` ([auth-form.tsx](../src/components/auth-form.tsx)): só a Nail, e-mail + senha; sem "Criar conta"; link "É cliente? Acessar meu painel" → `/entrar`.
  - `/entrar`: só código. Usa `request-code` sem dados; sem cadastro → aviso para fazer o primeiro agendamento. Cliente cadastrada pela Nail ganha a conta no primeiro acesso (D3).
  - Link `/agendar` ([booking-flow.tsx](../src/components/booking-flow.tsx)): "Continuar" chama `request-code`; quem já tem cadastro vai direto para o código; quem é nova preenche os dados (D2) e recebe o código. Sem senha; observações sempre visíveis.
  - Painel da cliente: cartão de **boas-vindas** no primeiro acesso ("Entendi" grava `user_metadata.welcome_seen`) e item **"Como funciona o agendamento"** ([como-funciona.tsx](../src/app/cliente/como-funciona.tsx), [how-it-works.tsx](../src/components/how-it-works.tsx)).
  - "Meus dados": telefone e e-mail só leitura (D5 no front; o bloqueio no banco é da Etapa 3); sem senha.
  - A ação `lookup` do `public-booking` não é mais usada pelo app (sai na Etapa 3).
  - Typecheck, lint e testes passando.
- **Publicação Etapas 1+2 (05/11/2026), parcial:**
  - ✅ Migration `20261105000000_login_servidor.sql` em produção (função executável só pelo `service_role`, conferido).
  - ✅ Função `public-booking` em produção; `request-code` com e-mail desconhecido responde `needsProfile` sem criar conta (conferido).
  - ✅ Site publicado em 05/11/2026 (bundle `entry-fc053bad`), depois de logar o EAS CLI no usuário **`paulovelosaaa`** (e-mail Yahoo), dono do projeto. Contas `paulovelosa` (iCloud) e `paulovelosa.globant` **não** têm acesso.
  - ⏳ Aguardando os testes do usuário (roteiro de cliente e Nail entregue na conversa) antes da Etapa 3.
  - O cadastro **ainda está aberto no backend** (Supabase Auth `enable_signup`, gatilho `handle_new_client`, ação `lookup`): fechar é a Etapa 3.
- [x] **Etapa 2b** — Senha da cliente (D8), 05/11/2026.
  - Migration [20261105010000_senha_cliente.sql](../supabase/migrations/20261105010000_senha_cliente.sql): `auth_user_by_email()` → `(id, has_password)`, só `service_role`. **"Tem senha" vem da marca `user_metadata.has_password`**, gravada pelo app junto com a senha: o `encrypted_password` não serve (o Auth grava senha aleatória em contas criadas pela API de admin).
  - `ensureClientAccount` devolve `hasPassword`; `request-code` responde `{ hasPassword: true }` sem enviar código quando a conta tem senha, salvo `forgot: true`.
  - [set-password.tsx](../src/components/set-password.tsx): `SetPassword` (senha + repetir, mín. 8, `updateUser({ password, data: { has_password: true } })`) e `useHasPassword()`.
  - `/agendar`: cartão "Já é minha cliente?" no topo → `/entrar` (leva o `servico`); fluxo: e-mail → (nova: dados → código → **reserva** → passo **"Crie sua senha"** → pronto) / (com senha: senha ali mesmo + "Esqueci a senha", sem perder serviço e horário) / (cadastro sem senha: código → reserva → cria senha).
  - `/entrar`: e-mail + senha; "Primeiro acesso ou esqueci a senha" → código (`forgot`) → "Crie sua senha" → painel (ou `/cliente/agendar?servico=`).
  - Painel: [cliente/_layout.tsx](../src/app/cliente/_layout.tsx) exige criar a senha antes de abrir, se ainda não tiver. "Meus dados" ganhou "Trocar senha".
  - Boas-vindas e "Como funciona" ([how-it-works.tsx](../src/components/how-it-works.tsx)) com duas partes: **o agendamento** e **o seu painel** (passo a passo).
  - Testes: integração 42/42 (caso novo de `hasPassword`); ponta a ponta local 6/6 (primeira vez com código, cria senha, volta pedindo senha sem código, login com senha, esqueci a senha).
  - ✅ **Publicada em 05/11/2026**: migration (só `service_role`, conferido) → `public-booking` (e-mail desconhecido → `needsProfile`, conferido) → site (bundle `entry-f1c04ab6`).
  - Ajustes publicados em 05/11/2026 (site `entry-b8efd0ba` + funções `public-booking`, `panel`, `whatsapp-webhook`): boas-vindas e "Como funciona" viraram **popup passo a passo** (`HowItWorksModal`; a tela `cliente/como-funciona` saiu); e, fora do escopo de login, a regra de pés passou a valer para **combos que incluem pés** (`requiresFeet`).
  - Conta, ficha e agendamento de teste do `paulo.velosa@yahoo.com.br` apagados a pedido (backup em `backups/2026-11-05-paulo-yahoo/`), para refazer o teste como cliente nova pelo celular.
  - Publicado em 05/11/2026 (site `entry-aa5cb4f4`): "Já é minha cliente?" virou **popup ao abrir o `/agendar`** ([returning-client-modal.tsx](../src/components/returning-client-modal.tsx)), e os popups ganharam **fundo desfocado** ([modal-backdrop.tsx](../src/components/modal-backdrop.tsx), `expo-blur`; no Android nativo só escurece). Aprovado pelo usuário.
  - ⏳ Aguardando os testes do usuário no site oficial. Depois: **Etapa 3**.
- [ ] Etapa 3 — Fechar o cadastro no backend
- [ ] Etapa 4 — Conta da Nail por script e contas existentes
- [ ] Etapa 5 — Testes e publicação
