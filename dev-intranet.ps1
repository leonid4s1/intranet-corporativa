# dev-intranet.ps1
# Lanza backend, frontend y cloudflared (si corresponde) con perfil Local o Tunnel.
# Uso:
#   .\dev-intranet.ps1 -Profile Tunnel
#   .\dev-intranet.ps1 -Profile Local
# Opcionales:
#   -ForceHttp2   -> usa --protocol http2 en cloudflared (útil si QUIC está bloqueado)
#   -CleanPort    -> intenta liberar el puerto 3000 antes de arrancar el backend

param(
  [ValidateSet('Local','Tunnel')]
  [string]$Profile = 'Tunnel',
  [switch]$ForceHttp2,
  [switch]$CleanPort
)

$ErrorActionPreference = 'Stop'

# Rutas del proyecto
$Root   = "C:\Users\Public\Leonardo\intranet-corporativa"
$Server = Join-Path $Root "server"
$Client = Join-Path $Root "cliente"

function Ensure-Path($p) {
  if (!(Test-Path $p)) { throw "No existe: $p" }
}

Ensure-Path $Root
Ensure-Path $Server
Ensure-Path $Client

# Verifica comandos requeridos
function Assert-Command($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    throw "No se encontró '$cmd'. $hint"
  }
}

Assert-Command node "Instala Node.js 20+"
Assert-Command npm  "Viene con Node.js"

if ($Profile -eq 'Tunnel') {
  Assert-Command cloudflared "Instala con: winget install Cloudflare.cloudflared  (o choco/scoop)"
}

# Selecciona .env según el perfil
$EnvFileLocal  = Join-Path $Server ".env.development.local"
$EnvFileTunnel = Join-Path $Server ".env.development.tunnel"
$EnvTarget     = if ($Profile -eq 'Local') { $EnvFileLocal } else { $EnvFileTunnel }

if (!(Test-Path $EnvTarget)) {
  throw "Falta el archivo de entorno para ${Profile}: $EnvTarget"
}

# Copia al .env activo (lo que lea el backend)
$EnvActive = Join-Path $Server ".env"
Copy-Item $EnvTarget $EnvActive -Force

Write-Host "Perfil: $Profile" -ForegroundColor Cyan
Write-Host "Usando entorno: $EnvActive" -ForegroundColor Cyan

# (Opcional) liberar puerto 3000
if ($CleanPort) {
  try {
    $conns = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($conns) {
      $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
      foreach ($pid in $pids) {
        Write-Host "Matando proceso en :3000 (PID $pid)..." -ForegroundColor Yellow
        Stop-Process -Id $pid -Force
      }
      Start-Sleep -Milliseconds 500
    }
  } catch {
    Write-Warning "No se pudo limpiar el puerto 3000 automáticamente: $_"
  }
}

# Instalar dependencias si faltan
Push-Location $Server
if (!(Test-Path "node_modules")) {
  Write-Host "Instalando dependencias de backend..." -ForegroundColor DarkCyan
  npm ci
}
Pop-Location

Push-Location $Client
if (!(Test-Path "node_modules")) {
  Write-Host "Instalando dependencias de frontend..." -ForegroundColor DarkCyan
  npm ci
}
Pop-Location

# Comandos a lanzar (en ventanas separadas)
$BackendCmd  = "cd `"$Server`"; node src/index.js"
$FrontendCmd = "cd `"$Client`"; npm run dev -- --host"

# Arranca backend
Start-Process powershell -ArgumentList "-NoExit","-Command",$BackendCmd -WindowStyle Normal
Start-Sleep -Milliseconds 400

# Arranca frontend (Vite con host expuesto para HMR a través del túnel)
Start-Process powershell -ArgumentList "-NoExit","-Command",$FrontendCmd -WindowStyle Normal
Start-Sleep -Milliseconds 400

# Si perfil es Tunnel, abre cloudflared apuntando a Vite (5173)
if ($Profile -eq 'Tunnel') {
  $protoArg = $(if ($ForceHttp2) { "--protocol http2 " } else { "" })
  $TunnelCmd = "cloudflared tunnel ${protoArg}--url http://localhost:5173"
  Start-Process powershell -ArgumentList "-NoExit","-Command",$TunnelCmd -WindowStyle Normal

  Write-Host ""
  Write-Host "Cuando cloudflared muestre la URL https://xxxxx.trycloudflare.com, compártela con las oficinas." -ForegroundColor Yellow
  Write-Host "Si quieres guardar esa URL en tu .env actual, crea/usa el script set-tunnel-url.ps1" -ForegroundColor Yellow
} else {
  Write-Host "Entorno local listo: http://localhost:5173" -ForegroundColor Green
}

Write-Host ""
Write-Host "TIP:" -ForegroundColor DarkGray
Write-Host " - Si HMR no conecta por la red, puedes forzar http2: .\dev-intranet.ps1 -Profile Tunnel -ForceHttp2" -ForegroundColor DarkGray
Write-Host " - Si el :3000 está en uso: .\dev-intranet.ps1 -Profile Local -CleanPort" -ForegroundColor DarkGray
