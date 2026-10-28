@echo off
rem Roda os testes unitários das regras (plunit)
chcp 65001 >nul
set "SWIPL=swipl"
where swipl >nul 2>nul || set "SWIPL=C:\Program Files\swipl\bin\swipl.exe"
cd /d "%~dp0"
"%SWIPL%" -q -g run_tests -t halt testes\testes.pl
