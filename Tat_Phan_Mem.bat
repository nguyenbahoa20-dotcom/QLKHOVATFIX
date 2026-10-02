@echo off
chcp 65001 >nul
title TaxVault Pro - Tat Ung Dung

echo =======================================================
echo     DANG TAT VA DON DEP TIEN TRINH TAXVAULT PRO...
echo =======================================================

REM Don dep triet de cac tien trinh node đang chay ngam
taskkill /F /IM node.exe >nul 2>&1

echo.
echo  [+] Da dong phan mem thanh cong!
echo  [+] Tat ca dich vu ngam da dung hoan toan.
echo.

timeout /t 3 /nobreak >nul
exit

