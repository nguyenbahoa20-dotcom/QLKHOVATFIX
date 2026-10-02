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

REM 1. Don dep cac tien trinh ket port 3000 cu (neu co)
taskkill /F /IM node.exe >nul 2>&1

REM 2. Tu dong kiem tra va cai dat node_modules neu chua co
if not exist "node_modules\" (
    echo Chua tim thay thu vien node_modules. Dang tu dong chay npm install...
    call npm install
)

REM 3. Khoi dong Node.js Server o cong 3000
npm run dev


