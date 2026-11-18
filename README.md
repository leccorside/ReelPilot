# 🎬 ReelPilot

### Plataforma SaaS de criação e publicação automatizada de vídeos com Inteligência Artificial

<p align="center">
  <img src="https://img.shields.io/badge/STATUS-EM_DESENVOLVIMENTO-F59E0B?style=for-the-badge" alt="Status"/>
  <img src="https://img.shields.io/badge/NEXT.JS-14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/REACT-18-149ECA?style=for-the-badge&logo=react&logoColor=white" alt="React"/>
  <img src="https://img.shields.io/badge/DOCKER-READY-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"/>
</p>

<p align="center">
  <strong>Crie. Automatize. Publique. Escale.</strong>
</p>

<p align="center">
  Transforme ideias em vídeos curtos completos, com roteiro, narração, imagens, legendas animadas e publicação automatizada nas principais redes sociais.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TikTok-000000?style=flat-square&logo=tiktok&logoColor=white" alt="TikTok"/>
  <img src="https://img.shields.io/badge/Instagram-E4405F?style=flat-square&logo=instagram&logoColor=white" alt="Instagram"/>
  <img src="https://img.shields.io/badge/YouTube_Shorts-FF0000?style=flat-square&logo=youtube&logoColor=white" alt="YouTube Shorts"/>
</p>

---

## 📌 Sobre o projeto

O **ReelPilot** é uma plataforma SaaS desenvolvida para automatizar a produção e distribuição de vídeos curtos sem a necessidade de aparecer diante das câmeras.

Com uma combinação de Inteligência Artificial, processamento multimídia e automações, a plataforma tem como objetivo transformar a criação de conteúdo em um processo escalável.

A proposta é permitir que criadores de conteúdo, empreendedores e gestores de redes sociais configurem séries de vídeos que serão produzidos e publicados automaticamente.

### ✨ Principais funcionalidades previstas

- 🤖 **Roteiros com IA:** geração automatizada de conteúdos utilizando Claude.
- 🎙️ **Narração inteligente:** conversão de texto em voz com Kokoro TTS.
- 🎨 **Imagens com IA:** criação de imagens personalizadas para cada cena.
- 🎞️ **Montagem automatizada:** processamento e composição de vídeos com FFmpeg.
- 💬 **Legendas dinâmicas:** legendas animadas e sincronizadas.
- 🎵 **Trilhas sonoras:** incorporação de músicas aos vídeos.
- 📅 **Agendamento:** organização da produção e das publicações.
- 📱 **Publicação multiplataforma:** integração com TikTok, Instagram e YouTube.
- 📊 **Painel centralizado:** gerenciamento de séries, vídeos e configurações.
- 🐳 **Infraestrutura Docker:** ambiente isolado, reproduzível e preparado para evolução.

> ⚠️ **Estado atual:** o projeto está em desenvolvimento. Painel, contas, créditos, armazenamento e a **fila de geração com worker** já funcionam de verdade: "Generate video" produz um MP4 real, por enquanto com provedores falsos (roteiro fixo, narração em silêncio e imagens de cor sólida). Roteiro com IA, voz, imagens, publicação e cobrança entram nas próximas etapas.

> 📝 **Observação:** ReelPilot é o nome provisório do projeto.

---

## 📑 Navegação

- [Sobre o projeto](#-sobre-o-projeto)
- [Como funciona](#-como-funciona)
- [Tecnologias](#-tecnologias)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação e execução](#-instalação-e-execução)
- [Acessos locais](#-acessos-locais)
- [Comandos disponíveis](#-comandos-disponíveis)
- [Serviços Docker](#-serviços-docker)
- [Estrutura do projeto](#-estrutura-do-projeto)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Testes e qualidade](#-testes-e-qualidade)
- [Ambiente de produção](#-ambiente-de-produção)
- [Roadmap](#-roadmap)
- [Documentação](#-documentação)
- [Licença](#-licença)

---

## 🔄 Como funciona

O ReelPilot foi projetado para automatizar todo o ciclo de produção de vídeos, desde a configuração inicial até sua publicação.

### 01. Configuração da série

O usuário cria uma série e define:

- Nicho e temática do conteúdo.
- Idioma e formato do vídeo.
- Voz utilizada na narração.
- Estilo visual das imagens.
- Música e identidade sonora.
- Estilo das legendas.
- Redes sociais de destino.
- Frequência e horário de publicação.

### 02. Processamento automatizado

O agendador identifica os vídeos que precisam ser produzidos e encaminha as tarefas para uma fila de processamento.

O worker executa as etapas necessárias, utilizando provedores de IA e ferramentas locais.

### 03. Geração do vídeo

```mermaid
flowchart TD
    A["Configuração da série"] --> B["Agendador"]
    B --> C["Fila de processamento"]
    C --> D["Geração do roteiro"]
    D --> E["Narração com IA"]
    E --> F["Geração de imagens"]
    F --> G["Montagem com FFmpeg"]
    G --> H["Legendas e música"]
    H --> I["Vídeo finalizado"]
    I --> J["Painel ReelPilot"]
    J --> K["Publicação automatizada"]
    K --> L["TikTok"]
    K --> M["Instagram"]
    K --> N["YouTube Shorts"]
```

*Fluxo planejado para as próximas etapas do desenvolvimento.*

### 04. Publicação e gerenciamento

Após o processamento, o vídeo ficará disponível no painel para acompanhamento e gerenciamento.

A publicação será realizada automaticamente nas plataformas conectadas, conforme as configurações de cada série e as permissões disponibilizadas pelas APIs oficiais.

---

## 🛠️ Tecnologias

A arquitetura combina tecnologias web modernas, ferramentas de Inteligência Artificial e infraestrutura conteinerizada.

### Frontend e aplicação

| Tecnologia | Finalidade |
|---|---|
| **Next.js 14** | Framework principal com App Router |
| **React 18** | Construção de interfaces |
| **TypeScript** | Tipagem e segurança do código |
| **Tailwind CSS** | Estilização e design responsivo |

### Banco de dados e infraestrutura

| Tecnologia | Finalidade |
|---|---|
| **PostgreSQL 16** | Persistência de dados |
| **Redis 7** | Cache e suporte às filas |
| **BullMQ** | Gerenciamento de tarefas assíncronas (Passo 5) |
| **SeaweedFS** | Armazenamento compatível com S3 |
| **Docker Compose** | Orquestração dos serviços |
| **Caddy** | HTTPS e proxy reverso (planejado) |

### Inteligência Artificial e processamento

| Tecnologia | Finalidade | Execução |
|---|---|---|
| **Claude API** | Geração de roteiros | API externa |
| **Kokoro TTS** | Narração e síntese de voz | CPU local |
| **ComfyUI** | Orquestração de geração de imagens | GPU local |
| **FLUX.1-schnell** | Modelo generativo de imagens | GPU local |
| **FFmpeg** | Montagem e processamento audiovisual | Local |

### Testes e qualidade

| Tecnologia | Finalidade |
|---|---|
| **Vitest** | Testes unitários e de integração |
| **Playwright** | Testes end-to-end |
| **TypeScript** | Verificação estática de tipos |
| **ESLint** | Análise e padronização do código |

---

## 💻 Pré-requisitos

Para executar o ambiente atual de desenvolvimento, é necessário apenas:

- Docker Engine ou Docker Desktop.
- Docker Compose **v2.24 ou superior**.
- Git para clonar o repositório.

**Não é necessário instalar Node.js, npm, PostgreSQL, Redis ou outras dependências diretamente na máquina.**

Todos os serviços da aplicação são executados dentro de containers.

### Requisitos de GPU

As funcionalidades futuras de Inteligência Artificial local, introduzidas a partir dos Passos 7 e 8, exigirão:

- GPU NVIDIA.
- Mínimo de **12 GB de VRAM**.
- Drivers NVIDIA compatíveis.
- Suporte à utilização de GPU pelo Docker.

> 💡 A GPU não é necessária para executar a fundação atual da aplicação. Será exigida para os recursos planejados de geração local de imagens.

---

## 🚀 Instalação e execução

### 1. Obtenha o código-fonte

Clone o repositório do projeto ou baixe seu código-fonte e acesse o diretório raiz:

```bash
cd reelpilot
```

### 2. Configure as variáveis de ambiente

Crie o arquivo `.env` utilizando o modelo fornecido.

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env
```

**Linux / macOS:**

```bash
cp .env.example .env
```

Edite o `.env` e configure as credenciais e demais variáveis necessárias.

> 🔐 Nunca utilize as senhas de exemplo em ambientes públicos ou de produção.

### 3. Inicialize a aplicação

**Windows (PowerShell):**

```powershell
.\scripts\dc.ps1 up
```

**Linux / macOS:**

```bash
docker compose up -d --build --wait
```

Na primeira execução, o Docker construirá as imagens necessárias, criará os volumes e inicializará os serviços.

### 4. Acesse a plataforma

Após a inicialização, abra:

**http://localhost:3100**

O ambiente de desenvolvimento oferece recarga automática da aplicação ao modificar os arquivos.

---

## 🌐 Acessos locais

| Serviço | Endereço | Descrição |
|---|---|---|
| 🖥️ **ReelPilot** | http://localhost:3100 | Aplicação web e painel |
| 💚 **Health Check** | http://localhost:3100/api/health/ | Monitoramento de dependências |
| 📧 **Mailpit** | http://localhost:8125 | Visualização de e-mails de desenvolvimento |

As portas podem ser personalizadas no arquivo `.env`:

```env
WEB_PORT=3100
MAILPIT_PORT=8125
```

O endpoint de saúde verifica os serviços essenciais, incluindo banco de dados, Redis e armazenamento.

---

## ⌨️ Comandos disponíveis

O projeto conta com um script PowerShell que centraliza as operações do Docker.

### Desenvolvimento

| Comando | Descrição |
|---|---|
| `.\scripts\dc.ps1 up` | Inicializa o ambiente |
| `.\scripts\dc.ps1 down` | Interrompe os containers |
| `.\scripts\dc.ps1 ps` | Lista serviços e estados |
| `.\scripts\dc.ps1 logs` | Exibe os logs |
| `.\scripts\dc.ps1 logs web` | Exibe os logs da aplicação |
| `.\scripts\dc.ps1 logs worker` | Exibe os logs do worker de vídeo (cada vídeo, tentativa e falha) |
| `.\scripts\dc.ps1 shell` | Abre um terminal no container web |
| `docker compose up -d --scale worker=3` | Sobe mais workers para gerar mais vídeos ao mesmo tempo |

### Dependências

Instale pacotes diretamente no container:

```powershell
.\scripts\dc.ps1 npm install <pacote>
```

> ⚠️ **Importante:** não execute instalações de dependências com o npm da máquina host. O `package-lock.json` deve ser gerado dentro do ambiente Linux do container, garantindo consistência entre os ambientes.

### Banco de dados

| Comando | Descrição |
|---|---|
| `.\scripts\dc.ps1 migrate` | Aplica as migrações pendentes (o `up` também aplica, pelo serviço `migrate`) |
| `.\scripts\dc.ps1 db-generate <nome>` | Gera uma migração nova a partir de `src/server/db/schema.ts` |
| `.\scripts\dc.ps1 seed` | Recria a conta de demonstração `creator@example.com` com séries, vídeos e créditos |
| `.\scripts\dc.ps1 psql` | Abre o terminal SQL do banco de desenvolvimento |

> Toda mudança no schema vira um arquivo SQL versionado em `drizzle/`. Nunca altere o banco à mão nem edite uma migração já aplicada: gere uma nova.

### Testes e validação

| Comando | Descrição |
|---|---|
| `.\scripts\dc.ps1 test` | Executa os testes com Vitest (os testes de banco usam um banco `_test` recriado do zero a cada execução) |
| `.\scripts\dc.ps1 e2e` | Executa os testes Playwright (zera antes os contadores de tentativas do Redis de desenvolvimento, porque cada rodada cria várias contas) |
| `.\scripts\dc.ps1 check` | Executa lint, verificação de tipos e testes |

### Produção

| Comando | Descrição |
|---|---|
| `.\scripts\dc.ps1 prod-build` | Constrói as imagens de produção (web, worker e migrate) |
| `.\scripts\dc.ps1 prod-up` | Inicializa o ambiente de produção |

### Reinicialização completa

```powershell
.\scripts\dc.ps1 reset
```

**⚠️ ATENÇÃO: operação destrutiva.**

Esse comando remove os volumes persistentes utilizados pelo projeto, incluindo:

- Dados do PostgreSQL.
- Dados persistidos do Redis.
- Arquivos do armazenamento SeaweedFS.

Após a remoção, o ambiente é inicializado novamente.

Utilize somente quando precisar recriar completamente o ambiente local.

---

## 🐳 Serviços Docker

Todos os componentes atuais são orquestrados pelo Docker Compose.

| Serviço | Imagem | Responsabilidade |
|---|---|---|
| `web` | Dockerfile (`dev`) | Aplicação Next.js |
| `worker` | Dockerfile (`dev` com `tsx watch`; `runner-worker` em produção) | Gera os vídeos da fila `video-generation` (BullMQ), com ffmpeg. Limite de 2 CPUs e 2 GB; escala com `--scale worker=N` |
| `migrate` | Dockerfile (`dev`; `runner-migrate` em produção) | Aplica as migrações e encerra; `web` e `worker` só sobem depois dele |
| `postgres` | `postgres:16.6-alpine` | Banco de dados relacional |
| `redis` | `redis:7.4.1-alpine` | Sessões, limites de tentativas e a fila de vídeos |
| `s3` | `chrislusf/seaweedfs:4.51` | Armazenamento de arquivos |
| `s3-init` | `amazon/aws-cli:2.39.7` | Inicialização do bucket |
| `mailpit` | `axllent/mailpit:v1.21.8` | Captura de e-mails |
| `kokoro` | `ghcr.io/remsky/kokoro-fastapi-cpu:v0.9.2` | Narração na CPU (só com o perfil `ai`; 4,9 GB; 4 CPUs e 4 GB) |
| `comfyui` | `docker/comfyui` (ComfyUI v0.43.0 + PyTorch CUDA 13) | Imagens das cenas na GPU NVIDIA (só com o perfil `ai`) |
| `comfy-models-init` | `docker/comfyui` | Baixa e confere os modelos de imagem (13,7 GB) e encerra |
| `e2e` | `mcr.microsoft.com/playwright:v1.64.1-noble` | Testes automatizados E2E |

O serviço `e2e` é executado sob demanda com o perfil de testes.

### Como um vídeo é gerado

1. `POST /api/series/:id/videos` cobra 1 crédito, grava o vídeo como `queued` e o coloca na fila (o id do vídeo é o id do job, então ele nunca entra duas vezes).
2. O `worker` executa as etapas em ordem: **roteiro → narração → imagens → montagem**. Cada etapa grava o resultado (em `video_steps` e no S3) antes da próxima, e uma etapa concluída nunca é refeita.
3. Se uma etapa falha, o job é tentado de novo até 3 vezes, com espera crescente (10 s, 20 s). Na última falha, o vídeo fica `failed` com uma mensagem legível e o crédito volta.
4. Se o worker cair no meio, o BullMQ entrega o vídeo a outro worker (ou ao mesmo, quando religar), que continua da etapa em que parou, sem cobrar de novo.
5. A cada minuto, o worker confere vídeos esquecidos: os que ficaram fora da fila (Redis fora do ar na criação) voltam para ela, e os que falharam sem registro são marcados como falha e estornados.

A montagem usa ffmpeg de verdade e gera MP4 1080×1920 H.264/AAC mais uma miniatura. A narração ainda é silêncio e as imagens são de cor sólida (passos 7 e 8). `FAKE_PROVIDER_DELAY_MS` (2 s no desenvolvimento) faz cada etapa falsa demorar, para o progresso aparecer no painel.

### Imagens com ComfyUI + FLUX.1-schnell

Com `IMAGE_PROVIDER=comfyui` e o perfil `ai`, as imagens das cenas vêm do container `comfyui` na GPU NVIDIA (o padrão `fake` gera cores sólidas):

- **Imagem:** `docker/comfyui/`, com ComfyUI v0.43.0, o nó ComfyUI-GGUF e PyTorch 2.14.1 + CUDA 13, rodando sem root e sem porta publicada.
- **Modelos:** ficam no volume `comfy-models`, baixados uma vez pelo serviço `comfy-models-init` (~13,7 GB, com o SHA-256 de cada arquivo conferido):
  - FLUX.1-schnell em GGUF Q5_K_S;
  - T5 em fp8;
  - CLIP-L;
  - VAE.

  Todos têm licença comercial; o FLUX.1-dev não é usado.
- **Fluxo:** versionado em `docker/comfyui/workflows/flux-schnell.json`: 4 passos, 768×1344, e o ffmpeg amplia para 1080×1920. A imagem volta pelo WebSocket, sem ficar gravada no ComfyUI.
- **Consistência:** uma imagem por cena, com a mesma semente em todo o vídeo e um prompt base por estilo de arte (sem nomes de marcas).
- **Falhas:** cada imagem é salva no S3 assim que fica pronta; numa nova tentativa, só as que faltam são geradas. Se faltar memória na GPU, o worker pede ao ComfyUI que libere a VRAM e tenta de novo.
- **Desempenho na RTX 3060:** ~35 s por imagem (o texto passa pelo T5 na CPU, para o FLUX ficar fixo na GPU), pico de 10,1 GB de VRAM e ~10 GB de RAM. A primeira imagem depois de o ComfyUI iniciar leva alguns minutos, porque carrega 13 GB de modelos. Medição: `docker compose exec worker npx tsx scripts/image-bench.ts`.
- **Atenção:** enquanto o ComfyUI trabalha, nada mais pode usar a VRAM da placa (Docker Model Runner, Ollama, jogos). Com o perfil `ai` inteiro (ComfyUI + Kokoro), o WSL precisa de pelo menos 16 GB de memória.

### Narração com o Kokoro

Com `TTS_PROVIDER=kokoro` e o perfil `ai` ligado (`COMPOSE_PROFILES=ai` no `.env`, ou `docker compose --profile ai up -d`), a narração vem do container `kokoro` (Kokoro-FastAPI v0.9.2 na CPU, sem custo por vídeo; o padrão `fake` gera silêncio):

- **Como é gerada:** uma requisição por cena, com pausa de 250 ms entre cenas. A duração de cada cena sai do próprio áudio, e as imagens acompanham a fala. Cada palavra tem seu tempo, para as legendas.
- **Idiomas:** inglês, espanhol, português, francês (uma voz só), italiano e hindi. O alemão saiu do assistente porque o Kokoro não tem.
- **Velocidade:** cerca de 0,36× o tempo real em 4 CPUs (uma narração de 45 s leva ~16 s); o container usa ~2,3 GB de memória gerando.
- **Prévia de voz:** o assistente toca o narrador real (`GET /api/voices/preview?voice=&language=`). Cada voz e idioma é gerada uma vez e fica guardada no S3.
- **Medição:** `docker compose exec worker npx tsx scripts/tts-bench.ts`.

### Roteiro com a Claude API

Com `SCRIPT_PROVIDER=claude` e `ANTHROPIC_API_KEY` no `.env`, o roteiro vem da Claude API (o padrão `fake` usa um roteiro fixo, sem custo):

- **Escrita:** `CLAUDE_SCRIPT_MODEL` (padrão `claude-sonnet-5-5`) escreve em JSON validado: tema, formato, título, gancho, 4 a 8 cenas (narração no idioma da série, descrição visual em inglês), legenda e hashtags, com 90 a 130 palavras (cerca de 35 a 55 s). Fora do formato, há um pedido de correção.
- **Revisão:** `CLAUDE_REVIEW_MODEL` (padrão `claude-haiku-5-5`) confere as regras de conteúdo das plataformas.
- **Temas:** os temas dos vídeos anteriores da série não se repetem.
- **Falhas definitivas:** recusa, conteúdo proibido ou problema da conta falham o vídeo na hora, com estorno. O cliente nunca vê detalhes da conta; o log do worker mostra "ACTION NEEDED".
- **Custo:** cada vídeo fica registrado em `video_steps.cost_micro_usd`.

> ⚠️ Com `SCRIPT_PROVIDER=claude`, todo vídeo gerado, inclusive pelos testes E2E, faz chamadas pagas. A bateria real de validação é `docker compose exec worker npx tsx scripts/script-battery.ts` (5 formatos × 3 idiomas, cerca de US$ 0,50 a 1,00).

### Serviços planejados

| Serviço | Responsabilidade |
|---|---|
| `scheduler` | Agendamento de geração e publicação |
| `caddy` | Proxy reverso e HTTPS |

---

## 📁 Estrutura do projeto

```text
reelpilot/
│
├── src/
│   ├── app/
│   │   └── api/
│   │       └── health/
│   │
│   ├── components/
│   ├── lib/
│   ├── server/
│   │   ├── db/
│   │   │   ├── schema.ts
│   │   │   ├── credits.ts
│   │   │   └── index.ts
│   │   ├── accounts.ts
│   │   ├── crypto.ts
│   │   ├── health.ts
│   │   ├── password.ts
│   │   └── rate-limit.ts
│   ├── test/
│   ├── auth.ts
│   ├── auth.config.ts
│   ├── middleware.ts
│   └── instrumentation.ts
│
├── drizzle/
│
├── e2e/
│
├── docker/
│
├── scripts/
│   ├── dc.ps1
│   ├── migrate.mjs
│   └── seed.ts
│
├── drizzle.config.ts
├── .env.example
├── Dockerfile
├── CONTEXTO.md
└── README.md
```

### Organização das responsabilidades

| Diretório / Arquivo | Responsabilidade |
|---|---|
| `src/app` | Páginas, layouts e rotas da API |
| `src/components` | Componentes visuais reutilizáveis |
| `src/lib` | Utilitários compartilhados: opções do assistente, planos, tipos da API e cliente da API (SWR) |
| `src/server` | Lógica exclusiva do servidor |
| `src/server/db/schema.ts` | Schema do banco (Drizzle): usuários, séries, vídeos, etapas, créditos, assinaturas e redes sociais |
| `src/server/db/credits.ts` | Saldo de créditos, calculado pela soma do extrato |
| `src/server/crypto.ts` | Criptografia AES-256-GCM dos tokens das redes sociais |
| `src/server/accounts.ts` | Cadastro, verificação de senha, limites de tentativas e versão de sessão |
| `src/server/password.ts` | Hash de senha com argon2id |
| `src/server/rate-limit.ts` | Contadores de tentativas no Redis |
| `src/server/series.ts` | Séries: validação contra as opções do assistente e acesso só do dono |
| `src/components/dashboard/series-fields.tsx` | Campos da série, compartilhados pelo assistente de criação e pela tela de edição |
| `src/components/dashboard/music-picker.tsx` | Escolha da música: upload, importação por link e biblioteca |
| `src/server/videos.ts` | Vídeos e créditos: débito com trava por usuário, estornos |
| `src/server/me.ts` | Conta: plano, saldo, preferências e contas sociais |
| `src/server/storage.ts` | Armazenamento S3: gravar, ler, listar e apagar arquivos e pastas |
| `src/server/music.ts` | Biblioteca de música: upload, importação por link, exclusão |
| `src/server/audio-file.ts` | Reconhece MP3 e WAV pelos bytes do arquivo |
| `src/server/safe-fetch.ts` | Download de links digitados pelo usuário com proteção contra SSRF |
| `src/server/media-url.ts` | Links assinados e de validade curta para os arquivos |
| `src/auth.ts` | Configuração completa do Auth.js (provedores, sessão JWT, conferência no banco) |
| `src/auth.config.ts` | Parte da configuração que roda no Edge (usada pelo middleware) |
| `src/middleware.ts` | Protege `/dashboard` e a API privada; adiciona a barra final às URLs de páginas |
| `src/test` | Preparação dos testes (banco `_test` recriado a cada execução) |
| `src/instrumentation.ts` | Validação inicial das variáveis de ambiente |
| `drizzle` | Migrações SQL versionadas |
| `e2e` | Cenários de testes Playwright |
| `docker` | Configurações e entrypoints |
| `scripts/dc.ps1` | Automação de comandos Docker |
| `scripts/migrate.mjs` | Aplica as migrações (usado pelo serviço `migrate`) |
| `scripts/seed.ts` | Dados de demonstração para desenvolvimento |

A estrutura será ampliada conforme os módulos de geração, processamento e publicação forem implementados.

---

## 🔐 Variáveis de ambiente

Todas as configurações necessárias estão documentadas no arquivo:

**[`.env.example`](.env.example)**

A aplicação realiza a validação das variáveis durante a inicialização por meio de:

```text
src/lib/env.ts
```

Caso alguma configuração obrigatória esteja ausente ou inválida, o servidor interromperá a inicialização e apresentará os erros encontrados.

### Boas práticas

- Nunca versionar o arquivo `.env`.
- Não compartilhar tokens ou chaves de API.
- Utilizar credenciais diferentes para desenvolvimento e produção.
- Substituir todas as senhas padrão.
- Manter o `.env.example` atualizado.
- Gerar a `ENCRYPTION_KEY` com `openssl rand -base64 32` e guardá-la com cuidado: sem ela, os tokens das redes sociais salvos no banco ficam ilegíveis.
- Gerar o `AUTH_SECRET` da mesma forma. Trocá-lo desconecta todos os usuários.
- Usar `AUTH_RATE_LIMIT_SCALE=1` em produção. O valor maior (50) serve só para o desenvolvimento, onde os testes de ponta a ponta fazem muitos logins seguidos.

---

## 🔌 API do painel

Todas as rotas exigem login (sem sessão: `401`). Registro de outro usuário ou id inválido respondem `404`, para não revelar que existe.

| Método e rota | O que faz |
|---|---|
| `GET /api/me` | Perfil, preferências, plano, saldo de créditos e contas sociais conectadas |
| `PATCH /api/account` | Atualiza nome (até 80 caracteres), fuso (qualquer fuso IANA), notificações por e-mail e publicação automática |
| `GET /api/series` | Séries do usuário, com total de vídeos e de publicados |
| `POST /api/series` | Cria uma série com os campos do assistente (`403` quando o plano já tem o máximo de séries) |
| `GET` / `PATCH` / `DELETE /api/series/:id` | Detalhe, edição (inclusive pausar e retomar) e exclusão |
| `POST /api/series/:id/videos` | Coloca um vídeo novo na fila e cobra 1 crédito (`402` sem crédito) |
| `GET /api/videos?seriesId=&limit=&cursor=` | Vídeos do usuário, do mais novo ao mais antigo, opcionalmente de uma série. Páginas de `limit` vídeos (padrão 50, máximo 200); a próxima página vem com `cursor=<createdAt>_<id>` do último vídeo recebido |
| `GET` / `DELETE /api/videos/:id` | Detalhe e exclusão (a exclusão também tira o vídeo da fila; um vídeo em produção para sozinho) |
| `DELETE /api/social-connections/:id` | Desconecta uma rede social |
| `GET /api/music` | Biblioteca de música do usuário, com links de reprodução assinados |
| `POST /api/music` | Envia um MP3 ou WAV (até 10 MB) como corpo da requisição; nome original no cabeçalho `X-File-Name` |
| `POST /api/music/import` | Importa `{ url }` de um MP3/WAV (só `https`, até 10 MB) |
| `DELETE /api/music/:id` | Remove a faixa da biblioteca, das séries e do armazenamento |
| `GET /api/voices/preview?voice=&language=` | Link assinado para a prévia do narrador naquele idioma (`503` com o serviço de voz fora) |
| `GET /api/media/<arquivo>?exp=&sig=` | Entrega um arquivo por link assinado (sem login; o link é a permissão), com suporte a `Range` |

Os campos das séries incluem `musicTrackIds` (até 10 faixas da própria biblioteca). Os vídeos prontos trazem `videoUrl` e `thumbnailUrl`, links assinados de 30 minutos para o MP4 e a miniatura.

**Séries por plano:** Free e Starter 1, Growth 3, Pro sem limite. O `GET /api/me` informa o limite e o uso em `limits`, e o assistente avisa antes de começar.

### Arquivos

- **Bucket privado:** fica dentro da rede do Docker e nunca é exposto. O navegador envia e recebe arquivos pelo app.
- **Upload:** o servidor confere o conteúdo real (bytes de MP3 ou WAV, não a extensão) e o tamanho antes de gravar. Respostas: `413` acima de 10 MB e `429` acima de 30 envios por hora.
- **Importação por link:** só `https`. O endereço é resolvido na hora da conexão e recusado se apontar para a rede interna (127.x, 10.x, 192.168.x, 169.254.169.254, serviços do Docker...). Redirecionamentos são conferidos e o download para em 10 MB.
- **Links de reprodução:** valem 30 minutos e só para o arquivo para o qual foram gerados.
- **Pastas:** `users/<usuário>/music/...` e `users/<usuário>/videos/<vídeo>/...`. Excluir um vídeo, uma série ou a conta apaga os arquivos correspondentes.

### Regras de créditos

- O saldo é sempre a soma do extrato (`credit_ledger`).
- Gerar um vídeo cobra 1 crédito na mesma transação, com uma trava por usuário no Postgres: cliques simultâneos nunca deixam o saldo negativo.
- Um vídeo que falha (depois de todas as tentativas) devolve o crédito uma única vez.
- Excluir um vídeo que ainda não ficou pronto (na fila ou em produção) devolve o crédito; excluir uma série devolve os créditos dos vídeos dela que não ficaram prontos.
- Retomar um vídeo depois de uma queda do worker nunca cobra de novo: a cobrança acontece só na criação.

---

## 🔑 Login e contas

- **Cadastro e login com e-mail e senha:** senhas guardadas com argon2id. O e-mail não diferencia maiúsculas de minúsculas.
- **Login com Google:** fica ativo quando `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` estão preenchidos. No Google Cloud Console, crie um "ID do cliente OAuth" do tipo aplicativo da Web, com o redirecionamento autorizado `<APP_URL>/api/auth/callback/google` (no desenvolvimento, `http://localhost:3100/api/auth/callback/google`). Sem essas variáveis, o botão avisa que o Google ainda não está disponível.
- **Sessão:** JWT válido por 2 horas sem atividade, renovado automaticamente enquanto o painel está aberto. A cada minuto o servidor confere a sessão no banco, então uma conta excluída ou o "Sign out of all devices" (em Settings) derruba as sessões abertas em até 1 minuto.
- **Proteção contra tentativas repetidas** (contadores no Redis):

  | Limite | Valor |
  |---|---|
  | Senhas erradas por e-mail | 5 a cada 15 minutos |
  | Tentativas de login por IP | 30 a cada 15 minutos |
  | Cadastros por IP | 5 por hora |

- **Rotas protegidas:** `/dashboard/**` e toda a API, menos `/api/auth`, `/api/health` e `/api/register`. Quem não está logado vai para o login e volta à página pedida depois de entrar.

> ⚠️ Em produção, o limite por IP depende do proxy reverso (Caddy) sobrescrever o `X-Forwarded-For` com o IP real e de o container `web` não ter porta publicada. Sem isso, o cabeçalho pode ser falsificado pelo cliente.

---

## 🧪 Testes e qualidade

O ReelPilot utiliza ferramentas de testes automatizados e validação estática para melhorar a confiabilidade do código.

### Testes unitários e de integração

```powershell
.\scripts\dc.ps1 test
```

Executados com **Vitest**.

### Testes end-to-end

```powershell
.\scripts\dc.ps1 e2e
```

Executados com **Playwright** em um container dedicado, contra o servidor de desenvolvimento. Antes da bateria, o `e2e/warmup.ts` visita todas as páginas do painel para elas já estarem compiladas.

### Dados de pior caso (só no desenvolvimento)

Para testar telas com dados difíceis (nomes muito longos, listas cheias, campos vazios), o painel aceita `?data=worst`, `?data=empty` (sem contas conectadas e com saldo zero), `?data=one` ou `?data=huge` na URL, e mostra um seletor recolhido ("Data: …") no rodapé para trocar entre eles. Os dados ficam em `src/lib/dev-data.ts` e substituem as respostas da API só no navegador; salvar nesse modo vai para a API real.

Essa ferramenta **não existe na build de produção**: o seletor e os dados são carregados com uma condição que o bundler descarta. Os testes `e2e/break-ui.spec.ts` usam esses dados para garantir que as telas continuam resistindo a eles.

### Validação completa

```powershell
.\scripts\dc.ps1 check
```

Executa as verificações configuradas de:

- Tipagem TypeScript.
- Lint e padrões de código.
- Testes unitários e de integração.
- Testes end-to-end.

---

## 🌍 Ambiente de produção

O projeto utiliza o modo `standalone` do Next.js para construir uma imagem otimizada de produção.

### Construir a imagem

```powershell
.\scripts\dc.ps1 prod-build
```

Imagens resultantes:

```text
reelpilot-web:local       (Next.js standalone)
reelpilot-worker:local    (worker em um único arquivo empacotado pelo esbuild, com ffmpeg; ~450 MB)
reelpilot-migrate:local   (só as migrações)
```

As imagens rodam sem privilégios de root.

### Inicializar a produção

```powershell
.\scripts\dc.ps1 prod-up
```

### Recursos planejados para deploy

A preparação completa para hospedagem em VPS está prevista para o **Passo 19**, incluindo:

- Configuração de domínio.
- HTTPS com Caddy.
- Agendador de tarefas.
- Rotinas de backup.
- Implantação e operação em VPS.

> ⚠️ O ambiente de produção ainda está em evolução. A existência de uma imagem `standalone` não significa que a plataforma esteja pronta para operação pública.

---

## 🗺️ Roadmap

O desenvolvimento é feito de forma incremental, em etapas numeradas (Passo 0 a Passo 19) de um plano de trabalho mantido localmente, fora do repositório.

### Fundação e infraestrutura

- [x] Fundação inicial do projeto — Passo 0
- [x] Ambiente Docker de desenvolvimento
- [x] Aplicação Next.js 14
- [x] Serviços PostgreSQL, Redis e SeaweedFS
- [x] Monitoramento básico de saúde
- [x] Configuração do ambiente de testes
- [x] Banco de dados com Drizzle, migrações versionadas e seed — Passo 1
- [x] Autenticação real: e-mail/senha, Google, sessão JWT e limites de tentativas — Passo 2
- [x] API de séries, vídeos e créditos; painel sem dados no navegador — Passo 3

### Aplicação e processamento

- [x] Persistência real dos dados do painel
- [x] Gerenciamento das séries (criar, editar todos os campos e a música, pausar, retomar, excluir)
- [x] Música de fundo (upload e importação) e armazenamento privado — Passo 4
- [x] Fila de geração (BullMQ) e worker com etapas retomáveis, gerando MP4 real com provedores falsos — Passo 5
- [x] Roteiro com a Claude API, com saída validada, revisão de conteúdo e custo por vídeo — Passo 6 (falta a bateria real)
- [x] Narração local com o Kokoro na CPU, com tempos das palavras e prévia real no assistente — Passo 7
- [x] Imagens locais com ComfyUI + FLUX.1-schnell na RTX 3060, uma por cena, retomáveis — Passo 8
- [ ] Montagem automatizada dos vídeos
- [ ] Sincronização de legendas e áudio

### Automação e publicação

- [ ] Agendamento automatizado de vídeos
- [ ] Integração com TikTok
- [ ] Integração com Instagram
- [ ] Integração com YouTube
- [ ] Monitoramento de tarefas e publicações

### Produção e escalabilidade

- [ ] Ambiente completo de produção — Passo 19
- [ ] HTTPS e proxy reverso
- [ ] Backups e recuperação
- [ ] Deploy na VPS

> O roadmap acima é uma visão resumida. O que já foi implementado e as decisões técnicas de cada etapa ficam registrados no [CONTEXTO.md](CONTEXTO.md).

---

## 📚 Documentação

A documentação do projeto está organizada em arquivos específicos para facilitar a continuidade do desenvolvimento.

| Documento | Descrição |
|---|---|
| 📖 **[README.md](README.md)** | Apresentação e instruções gerais |
| 🧠 **[CONTEXTO.md](CONTEXTO.md)** | Histórico, contexto e decisões técnicas |
| ⚙️ **[.env.example](.env.example)** | Modelo de configuração do ambiente |

**Recomendação:** antes de implementar uma nova funcionalidade, consulte o `CONTEXTO.md` para preservar a arquitetura e as decisões já tomadas.

---

## 🔒 Licença

**Projeto privado e proprietário.**

Todos os direitos reservados.

O código-fonte, a documentação e os demais componentes não podem ser copiados, modificados, redistribuídos ou utilizados comercialmente sem autorização expressa do proprietário.

---

<p align="center">
  <strong>🎬 ReelPilot</strong>
</p>

<p align="center">
  <em>Do roteiro à publicação. Conteúdo automatizado com Inteligência Artificial.</em>
</p>

<p align="center">
  <sub>Desenvolvido com Next.js, TypeScript, Docker e Inteligência Artificial.</sub>
</p>

<p align="center">
  <sub>© 2026 ReelPilot. Todos os direitos reservados.</sub>
</p>
