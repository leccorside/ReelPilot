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
  & docker @DockerArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

switch ($Command) {
  "up"         { Invoke-Docker (@("compose", "up", "-d", "--build", "--wait") + $Rest) }
  "down"       { Invoke-Docker (@("compose", "--profile", "test", "down") + $Rest) }
  "logs"       { Invoke-Docker (@("compose", "logs", "-f", "--tail", "200") + $Rest) }
  "ps"         { Invoke-Docker @("compose", "ps") }
  "test"       { Invoke-Docker (@("compose", "run", "--rm", "--no-deps", "web", "npm", "test", "--") + $Rest) }
  "e2e"        { Invoke-Docker (@("compose", "--profile", "test", "run", "--rm", "e2e", "npx", "playwright", "test") + $Rest) }
  "lint"       { Invoke-Docker @("compose", "run", "--rm", "--no-deps", "web", "npm", "run", "lint") }
  "typecheck"  { Invoke-Docker @("compose", "run", "--rm", "--no-deps", "web", "npm", "run", "typecheck") }
  "check"      {
    Invoke-Docker @("compose", "run", "--rm", "--no-deps", "web", "npm", "run", "typecheck")
    Invoke-Docker @("compose", "run", "--rm", "--no-deps", "web", "npm", "run", "lint")
    Invoke-Docker @("compose", "run", "--rm", "--no-deps", "web", "npm", "test")
    Invoke-Docker @("compose", "--profile", "test", "run", "--rm", "e2e", "npx", "playwright", "test")
  }
  "npm"        { Invoke-Docker (@("compose", "run", "--rm", "--no-deps", "web", "npm") + $Rest) }
  "shell"      { Invoke-Docker @("compose", "exec", "web", "sh") }
  "prod-build" { Invoke-Docker ($prod + @("build", "web")) }
  "prod-up"    { Invoke-Docker ($prod + @("up", "-d", "--wait")) }
  "reset"      {
    Invoke-Docker @("compose", "--profile", "test", "down", "-v")
    Invoke-Docker @("compose", "up", "-d", "--build", "--wait")
  }
  default      { Get-Help $PSCommandPath -Detailed | Out-String | Write-Host; Get-Content $PSCommandPath -TotalCount 20 | Select-Object -Skip 1 | Write-Host }
}
