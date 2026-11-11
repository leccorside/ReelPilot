# CONTEXTO — ReelPilot (de protótipo do FacelessReels a produto real)

## Estado atual
- Next.js 14 (app router) em **modo servidor** (`output: "standalone"`, `trailingSlash`) + Tailwind 3 + `@tailwindcss/typography`. O plano do produto real está no `PASSOS.md`, um arquivo **local, fora do git** (listado no `.gitignore`). Quem clonar o repositório não o recebe, por isso as decisões e o progresso de cada passo também ficam registrados aqui. O **Passo 0 (fundação) está concluído**.
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
- Painel: `/dashboard` (redireciona no servidor para séries), `/dashboard/series`, `/dashboard/series/[id]/`, `/dashboard/create` (assistente de 6 etapas), `/dashboard/videos`, `/dashboard/settings`, `/dashboard/billing`.
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

12. `README.md` criado (2026-11-11): o que é o produto, stack, requisitos (só Docker), primeiros passos, comandos do `scripts/dc.ps1`, serviços do compose, estrutura, variáveis de ambiente e produção. Atualizar o README quando entrarem serviços ou comandos novos.

## Decisões
- **Arquitetura** (detalhe no `PASSOS.md`): Next.js em modo servidor + PostgreSQL/Drizzle + Auth.js + Redis/BullMQ com worker separado + S3 (SeaweedFS) + Claude API para roteiro + Kokoro e ComfyUI/FLUX locais atrás de interfaces (com versões falsas para testes) + ffmpeg para montar o vídeo + Stripe.
- **100% Docker:** testes e comandos sempre dentro dos containers. Na máquina e na VPS, só Docker.
- **SeaweedFS no lugar do MinIO:** a imagem `minio/minio` não existe mais no Docker Hub, porque a MinIO parou de distribuir a versão comunitária. O SeaweedFS (Apache 2.0) roda num único container. O app só usa a API S3, então trocar por R2/S3 é só mudar variáveis.
- **FLUX.1-schnell, não FLUX.1-dev:** o dev tem licença não comercial; o schnell é Apache 2.0.
- **Kokoro na CPU:** deixa os 12 GB da RTX 3060 só para as imagens. O Kokoro não tem alemão, que sai do assistente no Passo 7.
- **Portas 3100 e 8125:** a 3000 e a 8025 são usadas pelo projeto `ajudaisocial`, que sobe junto com o Docker.
- **Node 24 LTS** (`node:24.22.1-alpine3.24`) nas imagens; todas as imagens com versão fixada.
- Estilos de arte com nome de marca registrada ("Disney", "Ghibli", "Lego") serão renomeados no Passo 8.
- Sem confirmação de permissão: nome, logotipo, fotos, depoimentos e textos longos (FAQ, termos, privacidade) foram substituídos por versões próprias. A busca por semelhança visual com o original deixou de ser objetivo; marca e textos definitivos ficam para o Passo 17.

## Erros e correções
- **Docker Desktop não subia** (2026-11-11, `Wsl/Service/CreateInstance/MountDisk/HCS/E_ACCESSDENIED` nos `.vhdx` em `E:\docker\DockerDesktopWSL`). Causa: os arquivos foram criados numa sessão de administrador, então o usuário comum não podia alterar as permissões. Correção (com UAC): `icacls E:\docker\DockerDesktopWSL /grant <SID do usuário>:(OI)(CI)F /grant *S-1-5-83-0:(OI)(CI)F /T`, seguido de `wsl --shutdown`. Os 137 volumes foram conferidos depois.
- **Tags de imagem inexistentes:** `node:22.12.0-alpine` e `minio/minio` não existem mais. Antes de fixar uma versão, conferir com `docker manifest inspect <imagem>`.
- **PowerShell 5.1 estraga acentos:** `Get-Content`/`Set-Content` sem codificação leem UTF-8 sem BOM como ANSI. Editar arquivos com a ferramenta de escrita ou com `[IO.File]::ReadAllText/WriteAllText` em UTF-8.
- **`npm ci` falha com `node_modules` em volume** (apaga o ponto de montagem). O entrypoint de desenvolvimento usa `npm install`.
- **Tipos antigos em `.next/types`** após apagar uma rota quebram o `tsc`. Limpar com `docker compose exec web rm -rf .next/types/<rota>`.
- **ioredis com falha de conexão** registrava "Unhandled error event". O cliente da checagem de saúde tem um listener de `error`.
- Do protótipo:
  - texto legal estimado por caracteres ficou curto → comparar a altura com o original;
  - heredocs com apóstrofo quebravam no terminal → gravar arquivos com a ferramenta de escrita;
  - `Scene` com altura zero → posição pela classe recebida;
  - `scroll-behavior: smooth` → removido;
  - `onBlur` sincroniza campos preenchidos automaticamente;
  - `favicon.ico` → criado em `public/`.

## Pendências
- **Próximo: Passo 1 (banco de dados com Drizzle e o serviço `migrate`)**, aguardando autorização.
- Primeiro commit do repositório (pela pessoa).
- Decisões da pessoa: nome/marca definitivos, onde fica a GPU em produção (worker de IA neste PC com túnel até a VPS, ou servidor com GPU), preços dos planos.

## Limitações conhecidas
- O painel ainda grava os dados no navegador até o Passo 3. Vídeos são simulados, o pagamento não cobra e a conexão social pede só o @.
- O Kokoro e o ComfyUI ainda não estão no compose (passos 7 e 8). Com a IA rodando, nada mais pode ocupar a VRAM da RTX 3060.
- Produção ainda sem HTTPS, worker, agendador e backup (Passo 19).
