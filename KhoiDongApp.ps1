param([switch]$ShowConsole, [switch]$FromVbs)

$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
$appUrl = 'http://localhost:3000/'
$runtimeVersion = 'v24.21.0'
$runtimeFolderName = 'node-v24.21.0-win-x64'
$runtimeFolder = Join-Path $appRoot "runtime\$runtimeFolderName"
$nodeExe = Join-Path $runtimeFolder 'node.exe'
$npmCmd = Join-Path $runtimeFolder 'npm.cmd'
$runtimeZip = Join-Path $appRoot "runtime\$runtimeFolderName.zip"
$runtimeUrl = "https://nodejs.org/dist/$runtimeVersion/$runtimeFolderName.zip"
$runtimeSha256 = '158F7685B44DE51F6C0DF1D153526CBCD3E1BC739A8DFC607721CEF75DE9E541'

function Test-AppReady {
    try {
        $response = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 2
        return ($response.StatusCode -eq 200 -and $response.Content -match 'TaxVault Pro')
    } catch {
        return $false
    }
}

function Show-StartupMessage([string]$message, [int]$icon = 48) {
    if ($FromVbs) { return }
    if ($ShowConsole) {
        Write-Host $message
    } else {
        $shell = New-Object -ComObject WScript.Shell
        [void]$shell.Popup($message, 0, 'TaxVault Pro', $icon)
    }
}

function Open-App {
    if (-not $FromVbs) { Start-Process $appUrl }
}

# Open an already-running instance. Never start another server on every click.
if (Test-AppReady) {
    Open-App
    exit 0
}

$mutex = [System.Threading.Mutex]::new($false, 'Local\QLKHOVATFIX-Server3000-Startup')
$ownsMutex = $false
try {
    try {
        $ownsMutex = $mutex.WaitOne(0)
    } catch [System.Threading.AbandonedMutexException] {
        $ownsMutex = $true
    }

    if (-not $ownsMutex) {
        # Another click is already preparing the app. Wait for that instance only.
        for ($i = 0; $i -lt 90; $i++) {
            Start-Sleep -Seconds 2
            if (Test-AppReady) {
                Open-App
                exit 0
            }
        }
        throw 'Một lần khởi động khác đang bị kẹt. Hãy chạy chay_phan_mem.bat để xem thông báo lỗi.'
    }

    if (Test-AppReady) {
        Open-App
        exit 0
    }

    if (-not (Test-Path -LiteralPath $nodeExe)) {
        New-Item -ItemType Directory -Path (Split-Path $runtimeZip) -Force | Out-Null
        if (-not (Test-Path -LiteralPath $runtimeZip)) {
            if ($ShowConsole) { Write-Host 'Đang tải Node.js portable chính thức...' }
            Invoke-WebRequest -Uri $runtimeUrl -OutFile $runtimeZip -UseBasicParsing
        }

        $actualHash = (Get-FileHash -LiteralPath $runtimeZip -Algorithm SHA256).Hash
        if ($actualHash -ne $runtimeSha256) {
            throw 'Gói Node.js không khớp mã kiểm tra an toàn. Hãy tải lại gói ứng dụng.'
        }

        Expand-Archive -LiteralPath $runtimeZip -DestinationPath (Split-Path $runtimeFolder) -Force
    }

    if (-not (Test-Path -LiteralPath $nodeExe) -or -not (Test-Path -LiteralPath $npmCmd)) {
        throw 'Không tìm thấy Node.js portable trong thư mục ứng dụng.'
    }

    $tsxCli = Join-Path $appRoot 'node_modules\tsx\dist\cli.mjs'
    if (-not (Test-Path -LiteralPath $tsxCli)) {
        if (-not (Test-Path -LiteralPath (Join-Path $appRoot 'package-lock.json'))) {
            throw 'Thiếu package-lock.json nên không thể cài đúng các thư viện của ứng dụng.'
        }

        if ($ShowConsole) { Write-Host 'Đang cài thư viện ứng dụng lần đầu. Cần Internet...' }
        $installLog = Join-Path $appRoot 'startup-install.log'
        Push-Location $appRoot
        try {
            & $npmCmd ci --cache (Join-Path $appRoot '.npm-cache') --no-audit --no-fund 2>&1 | Tee-Object -FilePath $installLog
            $installExitCode = $LASTEXITCODE
        } finally {
            Pop-Location
        }
        if ($installExitCode -ne 0 -or -not (Test-Path -LiteralPath $tsxCli)) {
            $installDetails = if (Test-Path -LiteralPath $installLog) { (Get-Content -LiteralPath $installLog -Tail 8) -join "`r`n" } else { '' }
            throw "Không cài được thư viện. Kết nối Internet rồi thử lại. $installDetails"
        }
    }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $stdoutLog = Join-Path $appRoot "server-$stamp.log"
    $stderrLog = Join-Path $appRoot "server-error-$stamp.log"
    Start-Process -FilePath $nodeExe `
        -ArgumentList 'node_modules\tsx\dist\cli.mjs', 'server.ts' `
        -WorkingDirectory $appRoot `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -WindowStyle Hidden | Out-Null

    for ($i = 0; $i -lt 90; $i++) {
        Start-Sleep -Seconds 2
        if (Test-AppReady) {
            Open-App
            exit 0
        }
    }

    $details = if (Test-Path -LiteralPath $stderrLog) { (Get-Content -LiteralPath $stderrLog -Tail 8) -join "`r`n" } else { '' }
    throw "Máy chủ chưa sẵn sàng. Hãy chạy chay_phan_mem.bat để xem lỗi. $details"
} catch {
    Show-StartupMessage $_.Exception.Message
    exit 1
} finally {
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
