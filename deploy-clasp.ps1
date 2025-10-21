<#
deploy-clasp.ps1
Uso: ejecutar desde la raíz del repo (Windows PowerShell)
  .\deploy-clasp.ps1

Este script ejecuta `clasp push` y luego `clasp deploy` con una descripción automática.
Requiere: node/npm y @google/clasp instalado y logueado (clasp login) con la cuenta correcta.
#>

Write-Host "Iniciando deploy de Apps Script (clasp)" -ForegroundColor Cyan

function Exec-Command($cmd, $args) {
    # Normalizar ArgumentList: Start-Process falla si ArgumentList es $null
    $argList = @()
    if ($args -ne $null -and $args -ne '') {
        # Si recibimos un string, envolverlo en arreglo; si ya es arreglo, usarlo tal cual
        if ($args -is [System.Array]) { $argList = $args } else { $argList = @($args) }
    }
    $proc = Start-Process -FilePath $cmd -ArgumentList $argList -NoNewWindow -PassThru -Wait -RedirectStandardOutput stdout.txt -RedirectStandardError stderr.txt
    $out = Get-Content stdout.txt -Raw -ErrorAction SilentlyContinue
    $err = Get-Content stderr.txt -Raw -ErrorAction SilentlyContinue
    Remove-Item stdout.txt, stderr.txt -ErrorAction SilentlyContinue
    return @{ ExitCode = $proc.ExitCode; StdOut = $out; StdErr = $err }
}

try {
    Write-Host "Verificando que 'clasp' esté disponible..." -NoNewline
    $res = Exec-Command 'clasp' '--version'
    if ($res.ExitCode -ne 0) {
        Write-Error "clasp no está disponible o falló: $($res.StdErr)"
        exit 1
    }
    Write-Host " OK (version: $($res.StdOut.Trim()))"
} catch {
    Write-Error "Error al verificar clasp: $_"
    exit 1
}

Write-Host "Ejecutando: clasp push" -ForegroundColor Yellow
$push = Exec-Command 'clasp' 'push'
Write-Host $push.StdOut
if ($push.ExitCode -ne 0) {
    Write-Error "clasp push falló: $($push.StdErr)"
    exit $push.ExitCode
}

$description = "auto-deploy: $(Get-Date -Format o)"
Write-Host "Ejecutando: clasp deploy --description '$description'" -ForegroundColor Yellow
$deploy = Exec-Command 'clasp' "deploy --description `"$description`""
Write-Host $deploy.StdOut
if ($deploy.ExitCode -ne 0) {
    Write-Error "clasp deploy falló: $($deploy.StdErr)"
    exit $deploy.ExitCode
}

Write-Host "Deploy completado." -ForegroundColor Green
Write-Host $deploy.StdOut

exit 0
