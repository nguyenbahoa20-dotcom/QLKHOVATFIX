param([switch]$ShowConsole, [switch]$FromVbs)

$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
$appUrl = 'http://127.0.0.1:3000/'
$runtimeVersion = 'v24.21.0'
$runtimeFolderName = 'node-v24.21.0-win-x64'
$runtimeFolder = Join-Path $appRoot "runtime\$runtimeFolderName"
$nodeExe = Join-Path $runtimeFolder 'node.exe'
$npmCmd = Join-Path $runtimeFolder 'npm.cmd'
$npmCli = Join-Path $runtimeFolder 'node_modules\npm\bin\npm-cli.js'
$npmPrefix = Join-Path $runtimeFolder 'node_modules\npm\bin\npm-prefix.js'
$npmPackage = Join-Path $runtimeFolder 'node_modules\npm\package.json'
$runtimeZip = Join-Path $appRoot "runtime\$runtimeFolderName.zip"
$runtimeUrl = "https://nodejs.org/dist/$runtimeVersion/$runtimeFolderName.zip"
$runtimeSha256 = '158F7685B44DE51F6C0DF1D153526CBCD3E1BC739A8DFC607721CEF75DE9E541'
$npmCache = Join-Path $appRoot '.npm-cache'

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

function Test-PortableRuntime {
    $requiredFiles = @($nodeExe, $npmCmd, $npmCli, $npmPrefix, $npmPackage)
    foreach ($requiredFile in $requiredFiles) {
        if (-not (Test-Path -LiteralPath $requiredFile)) { return $false }
    }

    try {
        $nodeVersion = ((& $nodeExe --version 2>&1) | Out-String).Trim()
        $nodeExitCode = $LASTEXITCODE
        $expectedNpmVersion = (Get-Content -LiteralPath $npmPackage -Raw | ConvertFrom-Json).version
        $npmVersion = ((& $nodeExe $npmCli --version 2>&1) | Out-String).Trim()
        $npmExitCode = $LASTEXITCODE
        return ($nodeExitCode -eq 0 -and $nodeVersion -eq $runtimeVersion -and
            $npmExitCode -eq 0 -and $npmVersion -eq $expectedNpmVersion)
    } catch {
        return $false
    }
}

function Install-PortableRuntime {
    New-Item -ItemType Directory -Path (Split-Path $runtimeZip) -Force | Out-Null

    if (Test-Path -LiteralPath $runtimeZip) {
        $cachedHash = (Get-FileHash -LiteralPath $runtimeZip -Algorithm SHA256).Hash
        if ($cachedHash -ne $runtimeSha256) {
            Remove-Item -LiteralPath $runtimeZip -Force
        }
    }

    if (-not (Test-Path -LiteralPath $runtimeZip)) {
        if ($ShowConsole) { Write-Host 'Dang tai bo Node.js portable chinh thuc...' }
        Invoke-WebRequest -Uri $runtimeUrl -OutFile $runtimeZip -UseBasicParsing
    }

    $actualHash = (Get-FileHash -LiteralPath $runtimeZip -Algorithm SHA256).Hash
    if ($actualHash -ne $runtimeSha256) {
        Remove-Item -LiteralPath $runtimeZip -Force -ErrorAction SilentlyContinue
        throw 'Goi Node.js tai ve khong dung ma kiem tra. Hay thu lai khi ket noi Internet on dinh.'
    }

    if (Test-Path -LiteralPath $runtimeFolder) {
        Remove-Item -LiteralPath $runtimeFolder -Recurse -Force
    }
    Expand-Archive -LiteralPath $runtimeZip -DestinationPath (Split-Path $runtimeFolder) -Force

    if (-not (Test-PortableRuntime)) {
        throw 'Khong cai duoc dung phien ban Node.js/npm can thiet tu goi portable.'
    }
}

function Test-AppDependencies {
    if (-not (Test-Path -LiteralPath (Join-Path $appRoot 'package-lock.json')) -or
        -not (Test-Path -LiteralPath $npmCli) -or
        -not (Test-Path -LiteralPath $nodeExe)) { return $false }

    Push-Location $appRoot
    try {
        $checkOutput = & $nodeExe $npmCli ls --depth=0 --json --cache $npmCache 2>&1
        $checkExitCode = $LASTEXITCODE
    } catch {
        return $false
    } finally {
        Pop-Location
    }

    $tsxCli = Join-Path $appRoot 'node_modules\tsx\dist\cli.mjs'
    return ($checkExitCode -eq 0 -and (Test-Path -LiteralPath $tsxCli))
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
        # Another click is already preparing the app. A VBS waiter must not
        # report success: only the process that owns startup may open a browser.
        for ($i = 0; $i -lt 90; $i++) {
            Start-Sleep -Seconds 2
            if (Test-AppReady) {
                if ($FromVbs) { exit 2 }
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

    # npm.cmd is only a wrapper; it cannot run unless npm's bundled Node files
    # are present. Repair partial portable runtimes by restoring the official ZIP.
    if ($ShowConsole) { Write-Host 'Dang kiem tra phien ban Node.js/npm portable...' }
    if (-not (Test-PortableRuntime)) {
        Install-PortableRuntime
    }

    if ($ShowConsole) { Write-Host 'Dang kiem tra thu vien cua ung dung...' }
    if (-not (Test-AppDependencies)) {
        if (-not (Test-Path -LiteralPath (Join-Path $appRoot 'package-lock.json'))) {
            throw 'Thiếu package-lock.json nên không thể cài đúng các thư viện của ứng dụng.'
        }

        if ($ShowConsole) { Write-Host 'Thu vien thieu hoac sai phien ban. Dang cai lai theo package-lock.json...' }
        $installLog = Join-Path $appRoot 'startup-install.log'
        $appModules = Join-Path $appRoot 'node_modules'
        if (Test-Path -LiteralPath $appModules) {
            Remove-Item -LiteralPath $appModules -Recurse -Force
        }
        Push-Location $appRoot
        try {
            & $nodeExe $npmCli ci --cache $npmCache --no-audit --no-fund --loglevel=error 2>&1 | Tee-Object -FilePath $installLog
            $installExitCode = $LASTEXITCODE
        } finally {
            Pop-Location
        }
        if ($installExitCode -ne 0 -or -not (Test-AppDependencies)) {
            $installDetails = if (Test-Path -LiteralPath $installLog) { (Get-Content -LiteralPath $installLog -Tail 8) -join "`r`n" } else { '' }
            throw "Không cài được thư viện. Kết nối Internet rồi thử lại. $installDetails"
        }
    } elseif ($ShowConsole) {
        Write-Host 'Node.js/npm va cac thu vien da dung chuan; bo qua cai dat.'
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
