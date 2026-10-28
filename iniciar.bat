@echo off
rem Inicia o servidor Prolog + dashboard em http://localhost:8080
chcp 65001 >nul
set "SWIPL=swipl"
where swipl >nul 2>nul || set "SWIPL=C:\Program Files\swipl\bin\swipl.exe"
cd /d "%~dp0"
start "" http://localhost:8080
"%SWIPL%" prolog\servidor.pl 8080
