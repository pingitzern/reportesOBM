# Test script: call Apps Script web app to verify remitos are archived
# Usage: .\test-remitos-archived.ps1 -Url <WEB_APP_URL> -Token <SESSION_TOKEN>
# Example: .\test-remitos-archived.ps1 -Url 'https://script.google.com/macros/s/AKfy.../exec' -Token 'your-session-token'

param(
    [Parameter(Mandatory=$true)]
    [string] $Url,

    [Parameter(Mandatory=$false)]
    [string] $Token
)

function PostJson($url, $body) {
    $json = $body | ConvertTo-Json -Depth 10
    $headers = @{
        'Content-Type' = 'text/plain; charset=utf-8'
    }
    $resp = Invoke-RestMethod -Uri $url -Method Post -Body $json -Headers $headers -ErrorAction Stop
    return $resp
}

# Build a minimal payload for crear_remito
$payload = @{ action = 'crear_remito'; token = $Token; reporteData = @{ id = 'test-1'; cliente = 'test' }; observaciones = 'test' }

try {
    $result = PostJson -url $Url -body $payload
    Write-Host "Response:" -ForegroundColor Cyan
    $result | ConvertTo-Json -Depth 10 | Write-Host
} catch {
    Write-Host "Request failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
