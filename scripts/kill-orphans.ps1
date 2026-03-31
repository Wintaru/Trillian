# kill-orphans.ps1
# Finds and kills node.exe processes that are NOT managed by PM2.
# Safe to run at any time — it will never kill the PM2 daemon or any
# process that PM2 currently knows about.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts\kill-orphans.ps1

$ErrorActionPreference = "Stop"

# --- Build the safe list ---

# 1. PM2 daemon
$daemonPidFile = "$env:USERPROFILE\.pm2\pm2.pid"
if (-not (Test-Path $daemonPidFile)) {
    Write-Error "PM2 daemon PID file not found at $daemonPidFile. Is PM2 running?"
    exit 1
}
$daemonPid = [int](Get-Content $daemonPidFile)

# 2. PM2-managed process PIDs (hardcoded names; add any new PM2 apps here)
$pm2AppNames = @("Trillian", "TrillianWebhook")
$managedPids = @()
foreach ($name in $pm2AppNames) {
    $pidOutput = (pm2 pid $name 2>$null) -join ''
    if ($pidOutput -match '^\d+$' -and [int]$pidOutput -gt 0) {
        $managedPids += [int]$pidOutput
    }
}

$safePids = (@($daemonPid) + $managedPids) | Where-Object { $_ -gt 0 }

Write-Host "PM2 daemon PID : $daemonPid"
Write-Host "Managed PIDs   : $($managedPids -join ', ')"
Write-Host ""

# --- Find all node processes ---
$nodeProcs = Get-Process -Name node -ErrorAction SilentlyContinue
if (-not $nodeProcs) {
    Write-Host "No node.exe processes found."
    exit 0
}

# --- Identify orphans ---
$orphans = $nodeProcs | Where-Object { $safePids -notcontains $_.Id }

if (-not $orphans) {
    Write-Host "No orphan processes found. All node.exe processes are accounted for by PM2."
    exit 0
}

Write-Host "Found $($orphans.Count) orphan(s):"
$orphans | Select-Object Id,
    @{N="StartTime"; E={$_.StartTime.ToString("yyyy-MM-dd HH:mm:ss")}},
    @{N="Memory(MB)"; E={[math]::Round($_.WorkingSet64 / 1MB, 1)}} |
    Format-Table -AutoSize

$confirm = Read-Host "Kill all orphans? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Aborted."
    exit 0
}

foreach ($proc in $orphans) {
    try {
        Stop-Process -Id $proc.Id -Force
        Write-Host "Killed PID $($proc.Id) (started $($proc.StartTime.ToString('HH:mm:ss')))"
    } catch {
        Write-Warning "Failed to kill PID $($proc.Id): $_"
    }
}

Write-Host ""
Write-Host "Done. Verify with: pm2 list"
