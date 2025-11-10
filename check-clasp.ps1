param(
  [switch]$NonDev,
  [switch]$AddPing,
  [switch]$ForceLogin,
  [string]$Func = "testCrearRemito"
)

$ErrorActionPreference = "Stop"

function Exec($cmd, [switch]$IgnoreExit) {
  Write-Host "`n> $cmd" -ForegroundColor Cyan
  $pinfo = New-Object System.Diagnostics.ProcessStartInfo
  $pinfo.FileName = "cmd.exe"
  $pinfo.Arguments = "/c $cmd"
  $pinfo.RedirectStandardOutput = $true
  $pinfo.RedirectStandardError = $true
  $pinfo.UseShellExecute = $false
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $pinfo
  [void]$p.Start()
  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  if ($stdout) { $stdout.TrimEnd().Split("`n") | % { Write-Host $_ } }
  if ($stderr) { $stderr.TrimEnd().Split("`n") | % { Write-Host $_ } }
  if (-not $IgnoreExit -and $p.ExitCode -ne 0) { throw "Comando falló ($($p.ExitCode)): $cmd" }
  return @{ code=$p.ExitCode; out=$stdout; err=$stderr }
}

function Assert-File($path, $msg) { if (!(Test-Path $path)) { throw "$msg (no encontrado: $path)" } }
function Read-Json($path) { try { Get-Content $path -Raw | ConvertFrom-Json } catch { throw "JSON inválido: $path" } }

Write-Host "=== Diagnóstico clasp run ===" -ForegroundColor Yellow

Exec "node -v" | Out-Null
Exec "npm -v" | Out-Null
Exec "clasp --version" | Out-Null

Assert-File ".clasp.json" "Falta .clasp.json (binding)"
$clasp = Read-Json ".clasp.json"
$rootDir = if ($clasp.PSObject.Properties.Name -contains "rootDir" -and $clasp.rootDir) { $clasp.rootDir } else { "." }
Write-Host "rootDir detectado: $rootDir" -ForegroundColor Green
$manifestPath = Join-Path $rootDir "appsscript.json"
Assert-File $manifestPath "Falta appsscript.json (manifiesto)"
$manifest = Read-Json $manifestPath
if (!$clasp.scriptId) { throw ".clasp.json no contiene 'scriptId'." }
Write-Host "scriptId: $($clasp.scriptId)" -ForegroundColor Green

Write-Host "`n=== Validación de manifest ===" -ForegroundColor Yellow
$hasExecApi = $manifest.PSObject.Properties.Name -contains "executionApi"
$access = if ($hasExecApi) { $manifest.executionApi.access } else { $null }
Write-Host ("executionApi.access: " + ($access | ForEach-Object { $_ }))
if (-not $hasExecApi -or -not $access) {
  Write-Host "⚠️ Falta 'executionApi.access' (MYSELF/DOMAIN/ANYONE)." -ForegroundColor DarkYellow
} else {
  Write-Host "OK executionApi.access" -ForegroundColor Green
}
if ($manifest.oauthScopes) {
  Write-Host "oauthScopes:" -ForegroundColor Green
  $manifest.oauthScopes | % { Write-Host " - $_" }
}

Write-Host "`n=== clasp open (sanity) ===" -ForegroundColor Yellow
Exec "clasp open" -IgnoreExit | Out-Null

Write-Host "`n=== clasp push ===" -ForegroundColor Yellow
try {
  Exec "clasp push"
} catch {
  Write-Host "❌ 'clasp push' falló. Intentá re-inicializar el binding:" -ForegroundColor Red
  Write-Host "   1) Backup:    Copy-Item .clasp.json .clasp.json.bak"
  Write-Host "   2) Rebind:    clasp clone $($clasp.scriptId)"
  Write-Host "   3) rootDir:   editá .clasp.json y agregá `"rootDir`": `"$rootDir`""
  Write-Host "   4) Probar:    clasp push"
  throw
}

Write-Host "`n=== Deployments ===" -ForegroundColor Yellow
$deps = Exec "clasp deployments"
$hasApiExecutable = (($deps.out + "`n" + $deps.err) -match "(api|oneplatform).*version")
if ($hasApiExecutable) { Write-Host "OK: se detecta API Executable." -ForegroundColor Green }
else { Write-Host "⚠️ No se detecta API Executable. IDE: Deploy > New deployment > Type: API Executable." -ForegroundColor DarkYellow }

$createdTmp = $false
$tmpFile = Join-Path $rootDir "tmp_ping.gs"
if ($AddPing) {
  Write-Host "`n=== Creando $tmpFile ===" -ForegroundColor Yellow
  if (!(Test-Path $tmpFile)) {
@"
function ping() { return 'pong'; }
"@ | Out-File -Encoding utf8 $tmpFile
    $createdTmp = $true
    Exec "clasp push"
  }
  Write-Host "Probando 'clasp run ping'..." -ForegroundColor Yellow
  if ($NonDev) { Exec "clasp run --nondev ping" } else { Exec "clasp run ping" }
}

Write-Host "`n=== Probando función: $Func ===" -ForegroundColor Yellow
if ($NonDev) { Exec "clasp run --nondev $Func" } else { Exec "clasp run $Func" }
Write-Host "`n✅ Éxito (si no tiró error arriba)." -ForegroundColor Green

if ($createdTmp) {
  Write-Host "`n=== Limpieza $tmpFile ===" -ForegroundColor Yellow
  Remove-Item $tmpFile -Force
  Exec "clasp push"
}

Write-Host "`n=== Fin diagnóstico ===" -ForegroundColor Yellow
