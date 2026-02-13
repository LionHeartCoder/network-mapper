param(
    [string]$LogFile = (Join-Path $PSScriptRoot "wsus_reset_log.txt")
)

function Log {
    param([string]$msg)
    Write-Host $msg
    Add-Content -Path $LogFile -Value ("[" + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "] " + $msg)
}

Log "Starting WSUS reset script."

try {
    Log "Stopping Windows Update services (BITS, wuauserv)..."
    Stop-Service -Name BITS, wuauserv -Force -ErrorAction Stop
    Log "Services stopped successfully."
} catch {
    Log "Error stopping services: $_"
}

try {
    Log "Removing update client registry properties..."
    Remove-ItemProperty -Name AccountDomainSid, PingID, SusClientId, SusClientIDValidation -Path HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\ -ErrorAction SilentlyContinue
    Log "Registry properties removed."
} catch {
    Log "Error removing registry properties: $_"
}

try {
    Log "Deleting SoftwareDistribution folder..."
    Remove-Item "$env:SystemRoot\SoftwareDistribution" -Recurse -Force -ErrorAction SilentlyContinue
    Log "SoftwareDistribution folder deleted."
} catch {
    Log "Error deleting SoftwareDistribution folder: $_"
}

try {
    Log "Starting Windows Update services (BITS, wuauserv)..."
    Start-Service -Name BITS, wuauserv -ErrorAction Stop
    Log "Services started successfully."
} catch {
    Log "Error starting services: $_"
}

try {
    Log "Forcing update detection (wuauclt)..."
    wuauclt /resetauthorization /detectnow
    Log "wuauclt command executed."
} catch {
    Log "Error running wuauclt: $_"
}

try {
    Log "Triggering update detection via COM object..."
    (New-Object -ComObject Microsoft.Update.AutoUpdate).DetectNow()
    Log "COM object update detection triggered."
} catch {
    Log "Error triggering COM object update detection: $_"
}

Log "WSUS reset script completed. Log saved to $LogFile."
