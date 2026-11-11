# CONTEXTO — ReelPilot (de protótipo do FacelessReels a produto real)

## Estado atual
- Next.js 14 (app router) em **modo servidor** (`output: "standalone"`, `trailingSlash`) + Tailwind 3 + `@tailwindcss/typography`. O plano do produto real está no `PASSOS.md`, um arquivo **local, fora do git** (listado no `.gitignore`). Quem clonar o repositório não o recebe, por isso as decisões e o progresso de cada passo também ficam registrados aqui. Os **passos 0 a 4 estão concluídos**: fundação, banco, autenticação, API do painel e armazenamento de arquivos.
- **Arquivos:**
  - bucket S3 privado (SeaweedFS), acessado só pelo app;
  - a música de fundo é enviada ou importada por link na etapa 3 do assistente, conferida pelos bytes e tocada por links assinados `/api/media/...`;
  - excluir vídeo, série ou conta apaga os arquivos.
- **Painel 100% na API** (sem `localStorage`):
  - séries, vídeos, créditos, plano, preferências e contas sociais vêm do banco, por `src/lib/api-client.ts` (SWR);
  - as regras ficam em `src/server/series.ts`, `videos.ts` e `me.ts`;
  - os vídeos gerados ficam **"In queue"** até o worker existir (Passo 5).
- **Login real** (Auth.js `next-auth@5.0.0-beta.32`, versão fixada por ser beta):
  - e-mail/senha com argon2id e Google, este último ativo só com `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`;
  - sessão JWT de 2 h, conferida no banco a cada minuto;
  - limites de tentativas no Redis;
  - o middleware protege `/dashboard/**` e a API privada.
- **Banco:** PostgreSQL com Drizzle ORM 0.45.4.
  - O schema fica em `src/server/db/schema.ts` e tem 12 tabelas: `users`, `accounts`, `sessions`, `verification_tokens`, `series`, `music_tracks`, `series_music_tracks`, `videos`, `video_steps`, `credit_ledger`, `subscriptions` e `social_connections`.
  - As migrações SQL ficam em `drizzle/`. O serviço `migrate` aplica as migrações antes do `web` e encerra.
  - `.\scripts\dc.ps1 seed` cria a conta de demonstração `creator@example.com` (2 séries, 3 vídeos, saldo de 58 créditos e 1 canal do YouTube).
- **Roda 100% em Docker** (`docker-compose.yml`). Na máquina só é preciso ter Docker. Serviços:
  - `web` (dev com recarga automática, http://localhost:3100);
  - `postgres` 16.6, `redis` 7.4.1;
  - `s3` (SeaweedFS 4.51, API S3) + `s3-init` (cria o bucket `reelpilot-media`);
  - `mailpit` (http://localhost:8125);
  - `e2e` (Playwright 1.64.1, só com `--profile test`).
- Atalhos em `scripts/dc.ps1`: `up`, `down`, `logs`, `ps`, `test`, `e2e`, `lint`, `typecheck`, `check`, `npm <args>`, `shell`, `prod-build`, `prod-up`, `reset`. Pacotes são instalados **dentro do container** (`.\scripts\dc.ps1 npm install x`).
- Produção: `docker-compose.prod.yml` troca o `web` pela imagem `runner-web` (277 MB, usuário 1001, sem bind mount). Caddy, worker e backups entram nos próximos passos.
- `GET /api/health/` confere o banco, o Redis e o S3 (200 ou 503). É o healthcheck do container `web`.
- As variáveis de ambiente são validadas com zod (`src/lib/env.ts`) na inicialização (`src/instrumentation.ts`). Se faltar alguma, o servidor não sobe e lista os problemas. Segredos só no `.env` (fora do git); o modelo está no `.env.example`.
- Páginas públicas: `/`, `/login`, `/contact`, `/privacy`, `/tos`, `/refund`, `/cancellation-policy`, `/affiliate-tos`.
- Painel: `/dashboard` (redireciona no servidor para séries), `/dashboard/series`, `/dashboard/series/[id]/`, `/dashboard/series/[id]/edit/` (edição de todos os campos), `/dashboard/create` (assistente de 6 etapas), `/dashboard/videos`, `/dashboard/settings`, `/dashboard/billing`.
- O painel **ainda** usa os dados simulados no navegador (`src/lib/store.ts`, localStorage). A troca pela API real é o Passo 3.
- Repositório git em `app/` (branch `main`), ainda **sem commits**: o primeiro commit é da pessoa. Os registros da ferramenta de captura (`capture/`, `checks/`, `agent-session.jsonl`...) ficam na pasta-mãe, fora do repositório.
- Tema: primária `hsl(265 89% 50%)` (#6d0ef1), texto #09090b, cinza #736a81, borda #e5e3e8, `--radius: 0.75rem`, Inter (corpo) e DM Sans (títulos), container 1400px.

## Histórico de implementações
1. Estudo: a captura oficial da página inicial veio sem CSS (falha de cache); recapturada com estilos em `checks/home-styled`. Estrutura e classes Tailwind lidas do HTML renderizado.
2. Página inicial: hero, faixa infinita de nichos, carrossel "We actually get views" (troca a cada 5s, setas e pontos), contadores que sobem, comparação, depoimentos (2 faixas no desktop, 1 vertical no celular), "How It Works" (miniatura do painel em HTML), "See It In Action" (abre janela), FAQ em acordeão de item único.
3. Cabeçalho fixo com borda ao rolar e menu do celular; rodapé com as mesmas colunas e links.
4. Login/cadastro: diálogo sobre o painel borrado; alterna "Create account"/"Sign in", valida e-mail, senha ≥ 8 e confirmação; "Continue with Google" entra com conta de demonstração; respeita `callbackUrl`.
5. Painel (pedido extra da pessoa): menu lateral com créditos e "Upgrade", menu do usuário (sair), lista de séries (retomar/pausar/excluir), assistente (formatos e nicho → idioma e voz com prévia falada → música por URL ou upload MP3/WAV ≤ 10MB → estilo de arte → estilo de legenda → agendamento), detalhes da série (gerar vídeo), vídeos (prévia com legenda animada e narração do navegador, publicar, baixar quadro PNG, excluir), ajustes (perfil, conectar/desconectar TikTok/Instagram/YouTube, preferências, excluir conta) e planos (upgrade simulado, cancelamento).
6. Retomada (2026-11-10, noite): páginas legais com a moldura medida no original; textos de privacidade e termos reescritos com a mesma estrutura do original, em palavras próprias.
7. Rodadas 1 a 6 de checagem visual (2026-11-10): "Last updated" da privacidade, fonte do corpo registrada como "Inter", menu lateral "deslogado" no painel borrado do login, topo e margens do painel borrado, cores #ffffffcc (cartões do contato) e #09090b0d (item ativo do menu borrado). Login e contato ficaram iguais ao original, exceto pelo nome da marca.
8. Mudança de objetivo (2026-11-11): a pessoa decidiu transformar o protótipo em **produto real**. Criado o `PASSOS.md` com 20 passos em 4 fases: A (fundação e backend, passos 0–5), B (geração dos vídeos, 6–10), C (agendador, publicação, Stripe e e-mails, 11–16) e D (marca, segurança e deploy, 17–19).
9. Pedido de 2026-11-11: o projeto roda **100% em Docker**, no desenvolvimento e na produção.
10. Pedido de 2026-11-11: **IA local** no lugar de ElevenLabs e Replicate. Kokoro (voz, na CPU) e ComfyUI + FLUX.1-schnell (imagens, na RTX 3060), ambos em containers no `profile` `ai`. Detalhes nos passos 7 e 8 do `PASSOS.md`.
11. **Passo 0 concluído (2026-11-11):**
    - `git init` e `.gitignore`/`.gitattributes`;
    - `next.config.mjs` em `standalone` com `instrumentationHook`;
    - rota `/dashboard/series/detail?id=` trocada por `/dashboard/series/[id]/`, e `/dashboard` passou a redirecionar no servidor;
    - `Dockerfile` com vários estágios, `docker/dev-entrypoint.sh` (reinstala `node_modules` só quando o `package-lock.json` muda), `docker/seaweedfs/entrypoint.sh` (gera a configuração S3 a partir do `.env`), `docker-compose.yml`, `docker-compose.prod.yml` e `.env.example`;
    - `src/lib/env.ts`, `src/instrumentation.ts`, `src/server/health.ts` e `src/app/api/health/route.ts`;
    - Vitest (`vitest.config.ts` e 4 testes: validação de variáveis e checagem dos serviços reais), Playwright (`e2e/smoke.spec.ts` com 4 testes: página inicial, login, saúde, redirecionamento do painel e rota dinâmica da série) e ESLint (`next/core-web-vitals`);
    - dependências novas: `zod`, `postgres`, `ioredis`, `vitest`, `@playwright/test` (versão fixa igual à imagem), `eslint@8` e `eslint-config-next`.
    - **Testes:** typecheck ✅, lint ✅, Vitest 4/4 ✅, Playwright 4/4 ✅, todas as rotas com 200 ✅, recarga automática em cerca de 7 s ✅, imagem de produção saudável ✅, servidor recusa subir com variáveis inválidas ✅.

12. `README.md` criado (2026-11-11): o que é o produto, stack, requisitos (só Docker), primeiros passos, comandos do `scripts/dc.ps1`, serviços do compose, estrutura, variáveis de ambiente e produção. Atualizar o README quando entrarem serviços ou comandos novos. Depois a pessoa reescreveu o README; o `PASSOS.md` passou a ficar fora do git, e os links para ele foram tirados.
13. **Passo 1 concluído (2026-11-11):**
    - **Schema Drizzle:**
      - enums para status de série, frequência, status do vídeo, etapas, motivo do crédito, plano, status da assinatura, rede social e origem da música;
      - as tabelas do Auth.js seguem os nomes de propriedade do `@auth/drizzle-adapter`, com colunas em snake_case no banco;
      - `users.id` é texto (exigência do adaptador); as demais tabelas usam `uuid` com `gen_random_uuid()`.
    - **Regras garantidas pelo próprio banco:**
      - e-mail único e sempre em minúsculas;
      - horário no formato `HH:MM` e pelo menos um formato por série;
      - música de até 10 MB;
      - uma linha por etapa de cada vídeo;
      - no extrato de créditos: valor diferente de zero, sinal coerente com o motivo, no máximo um débito e um estorno por vídeo, e `idempotency_key` única para recargas;
      - no máximo uma assinatura vigente por usuário;
      - uma conexão por conta de rede social;
      - excluir o usuário apaga tudo dele em cascata, enquanto excluir um vídeo mantém o extrato (o `video_id` vira nulo).
    - **Serviço `migrate`:** `scripts/migrate.mjs`, em JavaScript puro, sem precisar de ferramentas de TypeScript. Na produção usa a imagem `runner-migrate`, só com `drizzle-orm`, `postgres`, o SQL e o script, rodando como usuário 1001.
    - **Criptografia dos tokens:** `src/server/crypto.ts` (AES-256-GCM, formato `v1:iv:tag:dados`) e a nova variável `ENCRYPTION_KEY` (32 bytes em base64, validada no início).
    - **Saldo de créditos:** `src/server/db/credits.ts`, com `getCreditBalance` (soma do extrato) e `SIGNUP_BONUS_CREDITS = 60`.
    - **Testes:** `src/test/global-setup.ts` apaga e recria o banco `reelpilot_test` e roda o `migrate.mjs` nele, provando que as migrações sobem do zero. `src/server/db/schema.test.ts` tem 12 testes (todas as tabelas e regras acima) e `src/server/crypto.test.ts` tem 3.
    - **Atalhos novos:** `migrate`, `db-generate <nome>`, `seed` e `psql` no `dc.ps1`. O `.vscode/settings.json` registra as tags `!reset`/`!override` do Compose para a extensão YAML.
    - **Resultado dos testes:** typecheck ✅, lint ✅, Vitest 19/19 ✅, Playwright 4/4 ✅, seed rodado duas vezes sem duplicar ✅, pilha de produção (migrate → web) saudável ✅.
14. **Passo 2 concluído (2026-11-11)**, com a decisão da pessoa de usar **JWT com expiração curta**:
    - **Pacotes:** `next-auth@5.0.0-beta.32` (fixo), `@auth/drizzle-adapter@1.11.3` e `@node-rs/argon2@2.2.2` (módulo nativo, em `serverComponentsExternalPackages`).
    - **`src/auth.config.ts`** é a parte que roda no Edge: páginas de login e erro em `/login/`, JWT com `maxAge` de 2 h e `session.user.id`.
    - **`src/auth.ts`** tem a configuração preguiçosa (o `env()` e o `db()` só são lidos na primeira requisição, nunca na build):
      - o adaptador Drizzle grava o e-mail em minúsculas;
      - o Google entra só com as duas variáveis preenchidas, com `allowDangerousEmailAccountLinking` (o Google verifica o e-mail);
      - o provedor Credentials devolve os códigos `invalid_credentials`/`rate_limited`;
      - o callback `jwt` guarda `sv` (`users.session_version`) e `checkedAt`, confere no banco a cada 60 s ou no `update()`, e devolve `null` se a conta sumiu ou a versão mudou;
      - o evento `createUser` dá o bônus de cadastro às contas do Google.
    - **`src/server/accounts.ts`:**
      - `registerUser` cria a conta e o bônus numa transação; 409 para e-mail repetido sem diferenciar maiúsculas;
      - `verifyCredentials` faz uma verificação falsa de argon2 quando o e-mail não existe, para não revelar contas pelo tempo de resposta;
      - limites: 5 falhas por e-mail a cada 15 min, 30 tentativas por IP a cada 15 min e 5 cadastros por IP por hora; o sucesso zera as falhas;
      - `grantSignupBonus` é idempotente (`idempotency_key = signup:<id>`);
      - `clientIp` usa a última entrada do `X-Forwarded-For`.
    - **Outros módulos:** `src/server/rate-limit.ts` (contadores no Redis com `INCR` + `EXPIRE NX`), `src/server/password.ts` e `src/server/redis.ts`.
    - **Migração `0001_user_session_version`:** `users.session_version`.
    - **Rotas:**
      - `/api/auth/[...nextauth]`, que reconstrói a URL pelo host público quando não há `AUTH_URL`;
      - `POST /api/register`;
      - `PATCH`/`DELETE /api/account`;
      - `POST /api/account/sign-out-everywhere`.
    - **Telas:**
      - `/login` virou página no servidor, que já redireciona quem está logado, mais `login-view.tsx` com o mesmo visual;
      - `callbackUrl` só aceita caminhos do próprio site (`src/lib/auth-shared.ts`);
      - "Forgot password?" agora diz a verdade (o e-mail só chega no Passo 16);
      - `src/app/dashboard/layout.tsx` tem o `SessionProvider`, que renova a sessão a cada 5 min e ao focar a janela;
      - o menu do painel e os ajustes (perfil, sair, **sair de todos os dispositivos** e excluir conta) usam a sessão real;
      - o botão do Google no cabeçalho cai no login com aviso quando o Google não está configurado.
    - **`store.ts`:** perdeu o login simulado (`user`, `accounts`, `signIn`...) e ganhou `resetDb()`.
    - **Variáveis novas:** `AUTH_SECRET` (gerado no `.env`), `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (vazios), `AUTH_RATE_LIMIT_SCALE` (50 no `.env` de desenvolvimento, 1 na produção) e `AUTH_TRUST_HOST`. A produção fixa `AUTH_URL=${APP_URL}/api/auth`.
    - **Testes:**
      - Vitest: `accounts.test.ts` (10 testes, banco `_test` e Redis no banco lógico 1) e `auth-shared.test.ts` (5);
      - Playwright: `e2e/auth.spec.ts` (10 testes: cadastro, e-mail repetido, senha errada e depois a certa voltando ao `callbackUrl`, aviso do Google, redirecionamento de rota protegida, 401 na API, `callbackUrl` externo ignorado, logout, perfil salvo e exclusão de conta) e `e2e/helpers.ts`;
      - `expect.timeout` de 15 s, porque o servidor de testes compila cada página na primeira visita.
    - **Resultado:** typecheck ✅, lint ✅, Vitest 35/35 ✅, Playwright 14/14 ✅ duas vezes seguidas, login completo na imagem de produção ✅ (cadastro, login, painel, sessão, logout).

15. **Login com Google validado com conta real (2026-11-11):**
    - **Configuração:** a pessoa criou o cliente OAuth "Web application" no Google Cloud (origem `http://localhost:3100`, retorno `http://localhost:3100/api/auth/callback/google`, app em modo de teste com o e-mail dela em Test users) e preencheu `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` no `.env`.
    - **Primeira tentativa:** falhou com "Google sign-in isn't available yet", porque o container tinha sido criado antes. Variáveis novas no `.env` exigem recriar o container (`.\scripts\dc.ps1 up`); `restart` não basta.
    - **Resultado no banco:** conta com provedor `google`, e-mail em minúsculas, nome e foto, sem senha e 60 créditos (`signup:<id>`).
    - **Ajustes feitos depois da conferência:**
      - `src/server/auth-adapter.ts` (`hardenAdapter`) descarta `access_token`, `refresh_token`, `id_token`, `expires_at` e `session_state` antes de gravar em `accounts`, porque o login não precisa deles e eles ficavam em texto puro. A publicação no YouTube terá conexão própria e cifrada (Passo 12). A linha já existente foi limpa à mão;
      - o evento `signIn` preenche `users.email_verified` quando o Google informa `email_verified`. Confirmado no segundo login da pessoa: campo preenchido, nenhum token gravado de volta, nenhuma conta duplicada e o bônus não foi dado de novo.
    - **Testes:** `auth-adapter.test.ts` (2 testes). O E2E do botão do Google agora cobre os dois cenários: com o Google configurado, confere que o clique vai para `accounts.google.com` com o retorno e as permissões certas; sem configuração, mostra o aviso.
    - **Console do navegador:**
      - `Extra attributes from the server: cz-shortcut-listen` vem da extensão ColorZilla da pessoa;
      - os avisos de CSP, Self-XSS e Quirks Mode são das páginas do próprio Google;
      - nenhum dos dois é do app.

16. **Passo 3 concluído (2026-11-11):**
    - **Servidor:**
      - `src/server/series.ts`: valida contra as listas do assistente (`z.enum` sobre os ids de `options.ts`), remove repetidos em `formats`/`platforms`, valida o fuso com `Intl.DateTimeFormat`, conta vídeos e publicados, e `deleteSeries` estorna os vídeos na fila;
      - `src/server/videos.ts`: `createVideo` trava os créditos do usuário com `pg_advisory_xact_lock(hashtextextended('credits:<id>'))`, confere o saldo, cria o vídeo `queued` com o título `<série> #n` e o débito; `failVideo` estorna uma vez só e não mexe em vídeo já falho ou publicado; `refundQueuedVideos` só estorna vídeos que tiveram débito; `deleteVideo` devolve o crédito se o vídeo ainda estava na fila;
      - `src/server/me.ts`: o plano vigente vem da assinatura ativa (senão, Free); a barra de créditos usa o tamanho do plano (60 no Free); `updateAccount` cuida de nome, fuso, notificações e publicação automática; `deleteConnection`;
      - `src/server/errors.ts` e `withUser()` em `http.ts` convertem os erros: validação → 400, inexistente → 404, sem crédito → 402.
    - **Rotas:** `/api/me`, `/api/series`, `/api/series/[id]`, `/api/series/[id]/videos`, `/api/videos`, `/api/videos/[id]` e `/api/social-connections/[id]`; `PATCH /api/account` agora devolve o `/api/me` completo.
    - **Compartilhado:** `src/lib/api-types.ts` (formato das respostas), `src/lib/plans.ts` (planos, que saíram do store), `FREQUENCIES` com os ids do banco e `optionName()` em `options.ts`. O `Badge` ganhou o tom `red`, e o `Card` aceita atributos HTML.
    - **Telas:**
      - lista de séries, detalhe e assistente (cria a série e enfileira o primeiro vídeo);
      - grade de vídeos: 9 estados com rótulos, mensagem de erro com "credit refunded", Publish e Download desativados com explicação (passos 10 e 12) e a prévia simulada do protótipo removida;
      - planos: plano e saldo reais; o upgrade avisa que ainda não há cobrança (Passo 15);
      - ajustes: perfil e preferências salvos no servidor com atualização otimista; contas sociais vindas da tabela; "Connect" explica que chega com a publicação automática (Passo 12);
      - menu lateral com o saldo real (`data-testid="credits-left"`);
      - o aviso de música no assistente diz que a trilha ainda não é salva (Passo 4).
    - **`src/lib/store.ts` apagado.**
    - **Testes:** `src/server/dashboard-api.test.ts` (15 testes de regras, entre eles 10 cliques simultâneos com 3 créditos gerando exatamente 3 vídeos), `e2e/dashboard.spec.ts` (6 testes: assistente, gerar e excluir com estorno, pausar e excluir série com estorno, isolamento entre contas no mesmo navegador, preferências e planos) e `smoke.spec.ts` atualizado para criar a série pela API.
    - **Defeito encontrado pelo E2E e corrigido:** ao excluir o último vídeo, a grade trocava para "No videos yet" e desmontava o aviso "Its credit is back". Agora o aviso e os diálogos ficam sempre montados.
    - **Resultado:** typecheck ✅, lint ✅, Vitest 52/52 ✅, Playwright 20/20 ✅ duas vezes seguidas, API na imagem de produção ✅ (criar série, gerar vídeo, saldo 59, 401 sem login).

17. **Passo 4 concluído (2026-11-11):**
    - **Pacote:** `@aws-sdk/client-s3@3.1158.0` (a versão mais recente com mais de 14 dias), com `forcePathStyle` e checksums só quando exigidos (`requestChecksumCalculation/responseChecksumValidation: WHEN_REQUIRED`), porque nem todo S3 compatível entende os CRC que o SDK manda por padrão.
    - **`src/server/storage.ts`:** `putObject`, `getObject` (com `Range`), `listKeys`, `deleteObjects` (em lotes de 1000), `deletePrefix` (recusa prefixos curtos como `users/`) e `cleanupAfterCommit` (uma falha só vai para o log).
    - **`src/server/media-url.ts`:** links `/api/media/<chave>?exp=&sig=` com HMAC-SHA256 (chave derivada do `AUTH_SECRET`), válidos por 30 min e presos à chave do arquivo. A rota `src/app/api/media/[...key]` não exige sessão (fica fora do middleware); confere a assinatura (403 se inválida, 410 se vencida), só aceita chaves `users/...` sem `..`, devolve 206 com `Range`, e manda `nosniff` e `Cache-Control: private`.
    - **`src/server/audio-file.ts`:** `sniffAudio` reconhece WAV (`RIFF....WAVE`), MP3 com ID3 e MP3 sem tag (cabeçalho de quadro MPEG Layer III válido); `cleanFileName`.
    - **`src/server/safe-fetch.ts`:**
      - `BlockList` com as faixas privadas, de loopback, link-local (metadados de nuvem), CGNAT, multicast, reservadas, IPv6 ULA e link-local, NAT64 e IPv4 mapeado em IPv6;
      - lookup próprio usado **na conexão** (sem janela para DNS rebinding);
      - IP literal conferido antes;
      - só `https`, sem usuário e senha na URL, até 3 redirecionamentos conferidos, tempo-limite total de 15 s e corte em 10 MB durante a leitura;
      - um gancho `testing` (só nos testes) libera `http` e um resolvedor local.
    - **`src/server/music.ts`:**
      - upload, importação, listagem e exclusão; `ownedTrackIds` impede usar faixa de outro usuário;
      - limites de 30 envios por hora por usuário (`rl:music:user:<id>`) e 50 faixas por biblioteca;
      - se o insert no banco falhar, o arquivo já gravado é apagado.
    - **Erros novos:** `TooLargeError` (413) e `RateLimitedError` (429) em `errors.ts` e `withUser`.
    - **Séries:** o campo `musicTrackIds` (até 10) é gravado na mesma transação da série; o `PATCH` substitui as faixas; `deleteSeries` devolve os ids dos vídeos para a rota apagar `users/<u>/videos/<v>/`.
    - **Rotas:** `/api/music` (GET e POST com corpo bruto e `X-File-Name`), `/api/music/import`, `/api/music/[id]` e `/api/media/[...key]`. As exclusões de vídeo, série e conta limpam o armazenamento depois do commit.
    - **Telas:**
      - `src/components/dashboard/music-picker.tsx`: links importados com o botão "Import links" (os que falham ficam no campo para correção), upload na hora com indicador, erros por arquivo, biblioteca com seleção, botão de ouvir e remover com confirmação;
      - o rótulo "TikTok Sound URLs" virou "Sound file URLs", porque páginas do TikTok não são arquivos de áudio e baixá-las exigiria raspar o site;
      - o detalhe da série mostra a música com `<audio controls>`;
      - `useMusic()` se atualiza a cada 20 min, antes de os links vencerem.
    - **Testes:**
      - `files-unit.test.ts` (8): reconhecimento de áudio, nome de arquivo, links assinados, lista de IPs bloqueados, recusa de `http`, de IP literal e de `localhost`/`postgres` resolvidos;
      - `files-integration.test.ts` (10, com o S3 real e um servidor HTTP local): upload, arquivo falso, vazio e acima de 10 MB, limite por hora e biblioteca cheia, importação com redirecionamento, página HTML, arquivo grande sem `Content-Length`, laço de redirecionamento, 404, `https://s3:8333` recusado sem o gancho, faixa alheia recusada na série, exclusão da faixa, `deletePrefix`;
      - `e2e/music.spec.ts` (4): assistente com WAV real e ".mp3" falso, link interno recusado, reprodução byte a byte, `Range` 206, assinatura adulterada e arquivo trocado com 403, remover faixa da biblioteca, excluir conta apaga os arquivos e upload acima de 10 MB com 413.
    - **Conferência do bucket:** nenhum arquivo órfão de usuário apagado.
    - **Resultado:** typecheck ✅, lint ✅, Vitest 70/70 ✅, Playwright 24/24 ✅, imagem de produção ✅ (upload, reprodução com `audio/wav`, exclusão da conta e arquivo com 404 depois).

18. **Tela de edição de série (2026-11-11, pedido da pessoa):**
    - **`src/components/dashboard/series-fields.tsx`:** os blocos do assistente viraram componentes compartilhados:
      - `FormatsNicheFields`, `LanguageVoiceFields` (com a prévia de voz), `ArtStyleField`, `CaptionStyleField` e `ScheduleFields` (fuso opcional);
      - o tipo `SeriesForm`, `emptySeriesForm`, `formFromSeries` e `sectionValid`, com as mesmas regras da API.
    - **Assistente:** `create/page.tsx` foi reescrito sobre esses blocos, com o mesmo visual e comportamento. O fuso não é enviado na criação; vale o da conta.
    - **`/dashboard/series/[id]/edit/`:**
      - todos os blocos em cartões, com a música pelo `MusicPicker` e o fuso da série;
      - envia ao `PATCH` só os campos alterados (listas comparadas como conjuntos);
      - "Save changes" fica desativado sem mudanças, com seção inválida ("Fill in every section to save.") ou com upload em andamento;
      - barra de salvar fixa no rodapé, aviso do navegador ao sair com alterações não salvas e nota de que as mudanças valem para os próximos vídeos;
      - série de outra conta mostra "doesn't exist" (a API devolve 404).
    - **Detalhe da série:** ganhou o botão "Edit" e o aviso "Changes saved" ao voltar (`?saved=1`, que é limpo da URL). `TIMEZONES` foi para `options.ts`, compartilhado com os ajustes.
    - **Falha intermitente encontrada (1 em 4 rodadas completas do E2E):** o assistente e a edição esperavam `refreshDashboard()` (recarregar saldo, séries, vídeos e música) antes de navegar. Com o servidor ocupado, a navegação atrasava. Agora a atualização roda em paralelo, porque a página seguinte já busca os próprios dados.
    - **Testes:** `e2e/edit-series.spec.ts` (3): editar todos os campos (formato, nicho, idioma, voz, upload de música nova e retirada da antiga, arte, legenda, nome, plataforma, frequência, horário e fuso), conferindo pela tela e pela API; salvar desativado com seção incompleta e "Cancel" descartando; série de outra conta.
    - **Resultado:** typecheck ✅, lint ✅, Vitest 70/70 ✅, Playwright 27/27 ✅ em 3 rodadas completas seguidas depois da correção, build de produção ✅.

19. **break-ui na tela de edição (2026-11-11):**
    - **Ferramenta só de desenvolvimento:** os conjuntos de pior caso estão em `src/lib/dev-data.ts` (worst, empty, one, huge) e entram pelos hooks `useMe`/`useSeries`/`useMusic` com `?data=`. O `src/components/dashboard/dev-data-toggle.tsx` é o seletor no rodapé, que só aparece fora da produção e recarrega a página com o conjunto escolhido.
    - **Capturas temporárias** em `e2e-shots/` (fora da bateria de testes): 1280, 768 e 320 px e zoom de 200%.
    - **Correções aplicadas (`fix all`), com as recomendações nas 3 decisões:**
      1. "Post to" com `grid-cols-1` (que equivale a `minmax(0,1fr)`) e `min-w-0`: em 320 px a página voltou de 591 para 320 px;
      2. e 3. listas de formatos e vozes sem altura fixa, para a escolha nunca ficar escondida;
      4. nome da faixa em até 2 linhas, com `overflow-wrap:anywhere` e `title`; no celular os botões de ouvir e remover ficam abaixo do nome (cerca de 190 px de nome contra 96);
      5. contador "N/10 selected", caixas desativadas ao chegar em 10 e envio novo só é marcado se houver espaço;
      6. `maxLength` de 80 no nome e de 1000 no nicho, contador "N/1,000", mensagens próprias na API ("The series name can have at most 80 characters.") e os limites compartilhados em `src/lib/limits.ts`;
      7. conexão expirada mostra o usuário e "Reconnect needed" numa linha própria, em âmbar;
      8. erros de link e de upload separados (`data-testid` `link-errors`/`file-errors`), cada um junto da sua ação;
      9. "Uploading …" com `min-w-0` e quebra de linha;
      10. `cleanFileName` preserva a extensão ao encurtar e conta caracteres, não unidades UTF-16 (emoji inteiros);
      11. na trilha de navegação, o primeiro item e o último de trilhas com 3+ itens não encolhem; só o nome do registro é cortado (com `title`);
      12. biblioteca recolhida: as selecionadas primeiro, até 8 linhas, e "Show all N tracks". As linhas visíveis ficam fixas ao marcar e desmarcar, para nada pular.
    - **Regressão permanente:** `e2e/break-ui.spec.ts` (6 testes sobre os dados de desenvolvimento). Ficou fixado: largura em 320 px, "Edit" visível, seleções fora de caixas roláveis, nome da faixa com mais de 160 px e com extensão, limite de 10 e "Show all 50 tracks", "Reconnect needed", `maxLength` e mensagem da API.
    - **A ferramenta fica fora da produção:** `api-client.ts` e `shell.tsx` carregam `dev-data`/`dev-data-toggle` com `require` sob `process.env.NODE_ENV === "production" ? null : …`. Conferido na imagem: nenhum texto dos dados de pior caso em `.next/static` nem em `.next/server`. A primeira versão, com `import` estático, levava os dados para o pacote mesmo sem renderizar.
    - **Encontrados de passagem e corrigidos no `scripts/dc.ps1`:**
      - com `$ErrorActionPreference = "Stop"`, o stderr do docker ("Container … Running") virava erro fatal no Windows PowerShell 5.1; o `Invoke-Docker` agora julga só pelo código de saída;
      - `e2e` e `check` zeram os contadores `rl:*` do Redis de desenvolvimento antes de rodar, porque cada rodada cria cerca de 35 contas do mesmo IP e várias seguidas estouravam o limite de cadastros.
    - **`e2e-shots/` (capturas temporárias) foi removido,** como combinado.
    - **Resultado:** typecheck ✅, lint ✅, Vitest 71/71 ✅, Playwright 33/33 ✅ (três rodadas completas), produção sem a ferramenta ✅.
    - **Achados do relatório (antes das correções):**
      - em 320 px a página fica com 591 px de largura por causa do nome longo do canal do YouTube em "Post to";
      - formato e voz selecionados ficam escondidos nas listas roláveis;
      - nomes de faixa ilegíveis no celular;
      - dá para marcar mais de 10 faixas;
      - mensagem do zod "String must contain at most 80 character(s)", porque o campo não tem limite;
      - conexão expirada aparece como "Not connected";
      - o erro da importação fica longe do botão e é apagado pelo upload;
      - o servidor corta a extensão de nomes de arquivo acima de 120 caracteres.

## Decisões
- **Arquitetura** (detalhe no `PASSOS.md`): Next.js em modo servidor + PostgreSQL/Drizzle + Auth.js + Redis/BullMQ com worker separado + S3 (SeaweedFS) + Claude API para roteiro + Kokoro e ComfyUI/FLUX locais atrás de interfaces (com versões falsas para testes) + ffmpeg para montar o vídeo + Stripe.
- **100% Docker:** testes e comandos sempre dentro dos containers. Na máquina e na VPS, só Docker.
- **SeaweedFS no lugar do MinIO:** a imagem `minio/minio` não existe mais no Docker Hub, porque a MinIO parou de distribuir a versão comunitária. O SeaweedFS (Apache 2.0) roda num único container. O app só usa a API S3, então trocar por R2/S3 é só mudar variáveis.
- **FLUX.1-schnell, não FLUX.1-dev:** o dev tem licença não comercial; o schnell é Apache 2.0.
- **Kokoro na CPU:** deixa os 12 GB da RTX 3060 só para as imagens. O Kokoro não tem alemão, que sai do assistente no Passo 7.
- **Portas 3100 e 8125:** a 3000 e a 8025 são usadas pelo projeto `ajudaisocial`, que sobe junto com o Docker.
- **Node 24 LTS** (`node:24.22.1-alpine3.24`) nas imagens; todas as imagens com versão fixada.
- **Sessão JWT de 2 h com conferência no banco a cada minuto** (decisão da pessoa no Passo 2). Ela troca a revogação instantânea por simplicidade; o `session_version` dá o "sair de todos os dispositivos" com atraso de até 1 minuto.
- **Upload pelo app e links assinados pelo app, em vez de URLs pré-assinadas do S3** (mudança em relação ao plano original do Passo 4). O bucket nunca fica exposto (sem porta nem CORS), o conteúdo é validado antes de gravar e tudo funciona igual no desenvolvimento e na produção. O custo é a banda passando pelo app, aceitável para músicas de até 10 MB. Para os MP4 finais, reavaliar no Passo 10.
- **Importação só de links diretos para arquivos de áudio.** Páginas do TikTok ou do YouTube não são aceitas.
- **404, e não 403, para registros de outro usuário** (e para ids malformados): não revela se o registro existe.
- **Excluir vídeo na fila devolve o crédito; vídeo em produção ou pronto não.** Vídeo que falha é sempre estornado.
- **Telas sem simulação:** o que depende de passos futuros (música, publicar, baixar, pagar, conectar redes) aparece desativado ou com aviso honesto, em vez de fingir que funciona.
- **Barra final das URLs feita pelo middleware** (`skipTrailingSlashRedirect`), só para páginas. A API aceita os dois formatos.
- Estilos de arte com nome de marca registrada ("Disney", "Ghibli", "Lego") serão renomeados no Passo 8.
- Sem confirmação de permissão: nome, logotipo, fotos, depoimentos e textos longos (FAQ, termos, privacidade) foram substituídos por versões próprias. A busca por semelhança visual com o original deixou de ser objetivo; marca e textos definitivos ficam para o Passo 17.

## Erros e correções
- **Docker Desktop não subia** (2026-11-11, `Wsl/Service/CreateInstance/MountDisk/HCS/E_ACCESSDENIED` nos `.vhdx` em `E:\docker\DockerDesktopWSL`). Causa: os arquivos foram criados numa sessão de administrador, então o usuário comum não podia alterar as permissões. Correção (com UAC): `icacls E:\docker\DockerDesktopWSL /grant <SID do usuário>:(OI)(CI)F /grant *S-1-5-83-0:(OI)(CI)F /T`, seguido de `wsl --shutdown`. Os 137 volumes foram conferidos depois.
- **Tags de imagem inexistentes:** `node:22.12.0-alpine` e `minio/minio` não existem mais. Antes de fixar uma versão, conferir com `docker manifest inspect <imagem>`.
- **PowerShell 5.1 estraga acentos:** `Get-Content`/`Set-Content` sem codificação leem UTF-8 sem BOM como ANSI. Editar arquivos com a ferramenta de escrita ou com `[IO.File]::ReadAllText/WriteAllText` em UTF-8.
- **`npm ci` falha com `node_modules` em volume** (apaga o ponto de montagem). O entrypoint de desenvolvimento usa `npm install`.
- **Aspas em comandos PowerShell → `docker exec sh -c`:** o PowerShell 5.1 quebra as aspas internas (`cut -d" "`, `psql -F " | "`). Para comandos com aspas aninhadas, usar a ferramenta Bash ou um script.
- **Tipos antigos em `.next/types`** após apagar uma rota quebram o `tsc`. Limpar com `docker compose exec web rm -rf .next/types/<rota>`.
- **ioredis com falha de conexão** registrava "Unhandled error event". O cliente da checagem de saúde tem um listener de `error`.
- **Auth.js montava URLs com `http://0.0.0.0:3000`** (o endereço interno do container), porque usa `request.url`, e o Next já preenche `X-Forwarded-Host`. A rota `/api/auth/[...nextauth]` reconstrói a URL pelo host público; na produção vale o `AUTH_URL` fixo.
- **Logout e atualização de perfil não funcionavam no navegador** (`MissingCSRF` no log). Duas causas:
  - o `next-auth/react` chama `/api/auth/*` sem barra final; o 308 do `trailingSlash` fazia o navegador perder o corpo do POST, com o token CSRF. Correção: `skipTrailingSlashRedirect` e redirecionamento de barra feito pelo middleware, só para páginas;
  - o middleware também rodava em `/api/auth` e reemitia o cookie de sessão, sobrescrevendo o cookie que o Auth.js apaga ou troca. Correção: as rotas públicas de API saíram do `matcher`.
- **`update()` do `useSession` sem argumento só faz GET** (não dispara `trigger: "update"`). O perfil chama `update({})`.
- **E2E: `getByRole("alert")` achava 2 elementos**, porque o Next tem o `__next-route-announcer__` com `role="alert"`. O helper `formError()` procura o alerta dentro do diálogo. Também `toHaveURL(/\/$/)` casava com qualquer página; a página inicial usa uma expressão exata.
- **Aviso de build conhecido e inofensivo:** a `jose` (usada pelo Auth.js) referencia `CompressionStream`, que não existe no runtime Edge. Os tokens não usam compressão.
- **IP do cliente sem proxy:** o Next mantém um `X-Forwarded-For` enviado pelo cliente (falsificável) e, sem ele, usa o IP do gateway do Docker (igual para todos). O limite por IP só é confiável atrás do Caddy (Passo 19).
- Do protótipo:
  - texto legal estimado por caracteres ficou curto → comparar a altura com o original;
  - heredocs com apóstrofo quebravam no terminal → gravar arquivos com a ferramenta de escrita;
  - `Scene` com altura zero → posição pela classe recebida;
  - `scroll-behavior: smooth` → removido;
  - `onBlur` sincroniza campos preenchidos automaticamente;
  - `favicon.ico` → criado em `public/`.

## Pendências
- **Próximo: Passo 5 (fila BullMQ e worker separado)**, aguardando autorização.
- Produção: criar um segundo cliente OAuth com o domínio `https` e publicar o app no Google Auth Platform (Passo 19).
- Primeiro commit do repositório (pela pessoa).
- Decisões da pessoa: nome/marca definitivos, onde fica a GPU em produção (worker de IA neste PC com túnel até a VPS, ou servidor com GPU), preços dos planos.

## Limitações conhecidas
- **Vídeos ficam "In queue" para sempre** até o worker (Passo 5). Não há prévia nem arquivo; Publish e Download ficam desativados.
- **Arquivos órfãos possíveis:** se o armazenamento falhar ao excluir (vídeo, série, conta ou faixa), os arquivos ficam no bucket (o erro vai para o log). Uma varredura periódica entra com o agendador ou a manutenção (Passos 11/18).
- **Duração da música não é calculada** (`duration_ms` fica vazio). O ffprobe preenche no Passo 9.
- A lista de vídeos mostra os 100 mais recentes (sem paginação ainda).
- A prévia de voz no assistente ainda usa a voz do navegador (o Kokoro entra no Passo 7).
- **Sem verificação de e-mail nem recuperação de senha** até o Passo 16 (e-mails).
- Conectar redes sociais ainda não é possível: o botão explica que chega com a publicação automática (Passo 12). Só as conexões criadas pelo seed aparecem.
- Não há cobrança: o upgrade de plano só explica que os planos pagos ainda não abriram (Passo 15).
- As preferências "publicar automaticamente" e "notificações por e-mail" já ficam salvas, mas só terão efeito nos passos 12 e 16.
- O Kokoro e o ComfyUI ainda não estão no compose (passos 7 e 8). Com a IA rodando, nada mais pode ocupar a VRAM da RTX 3060.
- Produção ainda sem HTTPS, worker, agendador e backup (Passo 19).
