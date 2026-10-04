@echo off
setlocal
chcp 65001 >nul
title TaxVault Pro - Kho VAT
cd /d "%~dp0"

echo ================================================================
echo   TAXVAULT PRO - QUAN LY KHO VAT
echo ================================================================
echo Node.js portable duoc chay tu thu muc ung dung.
echo Lan dau can Internet de cai cac thu vien JavaScript.
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0TaxVaultPro.ps1" -ShowConsole
set EXIT_CODE=%ERRORLEVEL%
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Khoi dong that bai. Hay xem thong bao va cac tep server-error-*.log.
  pause
)
exit /b %EXIT_CODE%
