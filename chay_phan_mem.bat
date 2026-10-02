@echo off
chcp 65001 >nul
title TaxVault Pro - HE THONG QUAN LY KHO VAT VA GMAIL LOCAL

echo ======================================================================
echo   HE THONG QUAN LY KHO VAT VA GMAIL (NODE.JS + SQLITE LOCAL)
echo ======================================================================
echo.

REM 1. Kiem tra moi truong Node.js
echo [1/3] Dang kiem tra moi truong Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Chua tim thay Node.js tren may tinh!
    echo Vui long tai va cai dat Node.js (phien ban LTS) tai https://nodejs.org/
    pause
    exit /b
)

REM 2. Tu dong kiem tra va cai dat thu vien node_modules neu thieu
if not exist "node_modules\" (
    echo.
    echo [THONG BAO] Chua tim thay thu vien node_modules. Dang tu dong chay npm install...
    echo Vui long cho trong giay lat (chi thuc hien lan dau tien)...
    call npm install
    echo.
) else (
    echo [2/3] Moi truong thu vien node_modules da san sang.
)

REM 3. Khoi chay Server va Tu dong mo trinh duyet web
echo [3/3] Dang khoi chay ung dung Quan Ly Kho VAT tai http://localhost:3000 ...
echo.
echo ======================================================================
echo   LUU Y: Vui long KHONG dong cua so CMD nay khi dang dung phan mem.
echo   Moi du lieu duoc tu dong luu vao file local: vat_database.db
echo   Khi bam "Thoat Phan Mem" tren giao dien, cua so nay se tu dong dong.
echo ======================================================================
echo.

REM Tu dong mo trang web http://localhost:3000 sau 6 giay de server kip khoi dong
start "" cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"

REM Chay Node.js Server
call npm run dev

echo.
echo ======================================================================
echo   PHAN MEM DA DUOC DONG AN TOAN. TOAN BO DU LIEU DA DUOC LUU!
echo ======================================================================
timeout /t 2 >nul
exit



