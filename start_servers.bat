@echo off
chcp 65001 >nul
title TaxVault Pro - Server Engine
cd /d "%~dp0"

echo =====================================================
echo    HE THONG QUAN LY KHO VAT VA GMAIL LOCAL
echo =====================================================
echo.
echo Dang kiem tra moi truong va khoi dong may chu Node.js...
echo.

REM Tu dong cai thu vien can thiet neu chua co
if not exist "node_modules\.bin\tsx.cmd" (
    echo Chua tim thay thu vien node_modules. Dang tu dong chay npm install...
    call npm install
    if errorlevel 1 (
        echo Khong cai duoc thu vien. Hay kiem tra ket noi Internet va chay lai.
        pause
        exit /b 1
    )
)

REM Khoi dong Node.js Server o cong 3000
npm run dev

