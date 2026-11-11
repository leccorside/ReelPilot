<#
  Atalhos do ambiente Docker (tudo roda dentro dos containers).
  Uso: .\scripts\dc.ps1 <comando> [argumentos]

    up           sobe o ambiente de desenvolvimento (http://localhost:3000, e-mails em http://localhost:8025)
    down         para os containers (os dados ficam nos volumes)
    logs [svc]   acompanha os logs (de todos ou de um serviço)
    ps           lista os serviços e a saúde de cada um
    test         testes unitários e de integração (Vitest)
    e2e          testes de ponta a ponta (Playwright)
    lint         ESLint
    typecheck    checagem de tipos (tsc)
    check        typecheck + lint + test + e2e
    migrate      aplica as migrações pendentes do banco
    db-generate <nome>  gera uma migração nova a partir de src/server/db/schema.ts
    seed         recria a conta de demonstração (creator@example.com) com dados de exemplo
    psql         abre o terminal SQL do banco de desenvolvimento
    npm <args>   roda o npm dentro do container (ex.: .\scripts\dc.ps1 npm install zod)
    shell        abre um terminal no container web
    prod-build   constrói a imagem de produção
    prod-up      sobe o ambiente com a imagem de produção
    reset        APAGA os volumes (banco, redis, arquivos) e sobe do zero
#>
param(
  [Parameter(Position = 0)][string]$Command = "help",
  [Parameter(Position = 1, ValueFromRemainingArguments = $true)][string[]]$Rest
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
$prod = @("-f", "docker-compose.yml", "-f", "docker-compose.prod.yml")

function Invoke-Docker([string[]]$DockerArgs) {
  # Docker writes progress ("Container … Running") to stderr. In Windows PowerShell 5.1, with
  # ErrorActionPreference "Stop", that becomes a terminating error, so success is judged by the
  # exit code only.
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & docker @DockerArgs 2>&1 | ForEach-Object { "$_" }
  } finally {
    $ErrorActionPreference = $previous
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# Each E2E run creates ~35 accounts from the same IP: clear the development rate-limit counters
# (sign-in, sign-up, music uploads) first so repeated runs don't hit the limits.
function Reset-RateLimits {
  Invoke-Docker @("compose", "exec", "-T", "redis", "sh", "-c", 'redis-cli --scan --pattern "rl:*" | xargs -r redis-cli del > /dev/null')
}

switch ($Command) {
  "up"         { Invoke-Docker (@("compose", "up", "-d", "--build", "--wait") + $Rest) }
  "down"       { Invoke-Docker (@("compose", "--profile", "test", "down") + $Rest) }
  "logs"       { Invoke-Docker (@("compose", "logs", "-f", "--tail", "200") + $Rest) }
  "ps"         { Invoke-Docker @("compose", "ps") }
  "test"       { Invoke-Docker (@("compose", "run", "--rm", "--no-deps", "web", "npm", "test", "--") + $Rest) }
  "e2e"        { Reset-RateLimits; Invoke-Docker (@("compose", "--profile", "test", "run", "--rm", "e2e", "npx", "playwright", "test") + $Rest) }
  "lint"       { Invoke-Docker @("compose", "run", "--rm", "--no-deps", "web", "npm", "run", "lint") }
  "typecheck"  { Invoke-Docker @("compose", "run", "--rm", "--no-deps", "web", "npm", "run", "typecheck") }
  "check"      {
    Invoke-Docker @("compose", "run", "--rm", "--no-deps", "web", "npm", "run", "typecheck")
    Invoke-Docker @("compose", "run", "--rm", "--no-deps", "web", "npm", "run", "lint")
    Invoke-Docker @("compose", "run", "--rm", "--no-deps", "web", "npm", "test")
    Reset-RateLimits
    Invoke-Docker @("compose", "--profile", "test", "run", "--rm", "e2e", "npx", "playwright", "test")
  }
  "migrate"    { Invoke-Docker @("compose", "run", "--rm", "migrate") }
  "db-generate" {
    if (-not $Rest) { Write-Host "Informe o nome da migração. Ex.: .\scripts\dc.ps1 db-generate add_video_tags"; exit 1 }
    Invoke-Docker @("compose", "run", "--rm", "--no-deps", "web", "npx", "drizzle-kit", "generate", "--name", $Rest[0])
  }
  "seed"       { Invoke-Docker @("compose", "run", "--rm", "--no-deps", "web", "npx", "tsx", "scripts/seed.ts") }
  "psql"       { Invoke-Docker @("compose", "exec", "postgres", "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"') }
  "npm"        { Invoke-Docker (@("compose", "run", "--rm", "--no-deps", "web", "npm") + $Rest) }
  "shell"      { Invoke-Docker @("compose", "exec", "web", "sh") }
  "prod-build" { Invoke-Docker ($prod + @("build", "web")) }
  "prod-up"    { Invoke-Docker ($prod + @("up", "-d", "--wait")) }
  "reset"      {
    Invoke-Docker @("compose", "--profile", "test", "down", "-v")
    Invoke-Docker @("compose", "up", "-d", "--build", "--wait")
  }
  default      {
    $lines = Get-Content $PSCommandPath -Encoding UTF8
    $end = [Array]::IndexOf($lines, "#>")
    $lines[1..($end - 1)] | Write-Host
  }
}
