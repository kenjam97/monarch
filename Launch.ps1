param([switch]$Stop, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$rrRoot = $PSScriptRoot
$rrEntry = Join-Path $rrRoot 'server\index.ts'
$rrData = Join-Path $rrRoot 'data'
$rrPidFile = Join-Path $rrData 'server-process.json'
$rrUrl = 'http://127.0.0.1:4317'
try {
    if ($Stop) {
        if (!(Test-Path -LiteralPath $rrPidFile)) { Write-Host 'No launcher-managed Monarch process is recorded.'; exit 0 }
        $rrState = Get-Content -LiteralPath $rrPidFile -Raw | ConvertFrom-Json
        $rrProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($rrState.pid)" -ErrorAction SilentlyContinue
        if ($rrProcess -and $rrProcess.CommandLine -and $rrProcess.CommandLine.Contains($rrEntry)) {
            Stop-Process -Id $rrState.pid
            Write-Host 'Monarch stopped. Your study data is saved.'
        } else { Write-Host 'Monarch is already stopped. No other process was changed.' }
        exit 0
    }
    try { $rrHealth = Invoke-RestMethod -Uri "$rrUrl/api/health" -TimeoutSec 2 } catch { $rrHealth = $null }
    if ($rrHealth.application -eq 'monarch') {
        if (!$NoBrowser) { Start-Process $rrUrl }
        Write-Host "Monarch is already running at $rrUrl"
        exit 0
    }
    $rrNode = (Get-Command node.exe -ErrorAction Stop).Source
    $rrVersion = & $rrNode -p 'process.versions.node'
    if ([version]$rrVersion -lt [version]'22.13.0') { throw 'Monarch needs Node.js 22.13 or later. Install a current Node.js LTS release, then launch again.' }
    Set-Location -LiteralPath $rrRoot
    if (!(Test-Path -LiteralPath (Join-Path $rrRoot 'node_modules\tsx\package.json'))) {
        Write-Host 'Installing application dependencies (first launch only)...'
        $rrNpm = (Get-Command npm.cmd -ErrorAction Stop).Source
        & $rrNpm ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your connection and try again.' }
    }
    if (!(Test-Path -LiteralPath (Join-Path $rrRoot 'dist\index.html'))) {
        Write-Host 'Building Monarch...'
        & $rrNode (Join-Path $rrRoot 'node_modules\vite\bin\vite.js') build
        if ($LASTEXITCODE -ne 0) { throw 'Build failed. See the message above.' }
    }
    New-Item -ItemType Directory -Force -Path $rrData | Out-Null
    $env:PORT = '4317'
    $env:MONARCH_DATA = $rrData
    $rrProcess = Start-Process -FilePath $rrNode -ArgumentList @('--import', 'tsx', ('"' + $rrEntry + '"')) -WorkingDirectory $rrRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $rrData 'server.log') -RedirectStandardError (Join-Path $rrData 'server-error.log')
    @{pid=$rrProcess.Id; entry=$rrEntry} | ConvertTo-Json | Set-Content -LiteralPath $rrPidFile
    $rrReady = $false
    for ($rrAttempt = 0; $rrAttempt -lt 30; $rrAttempt++) {
        try { $rrHealth = Invoke-RestMethod -Uri "$rrUrl/api/health" -TimeoutSec 1; if ($rrHealth.application -eq 'monarch') { $rrReady = $true; break } } catch { }
        if ($rrProcess.HasExited) { break }
        Start-Sleep -Milliseconds 400
    }
    if (!$rrReady) { throw "Monarch did not start. Check $rrData\server-error.log. Port 4317 may be in use." }
    if (!$NoBrowser) { Start-Process $rrUrl }
    Write-Host "Monarch is ready at $rrUrl"
    Write-Host "Your watched Inbox: $rrData\Inbox"
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
