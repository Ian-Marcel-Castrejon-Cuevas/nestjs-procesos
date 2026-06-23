@echo off
REM Levantar frontend
start cmd /k "cd /d C:\Users\cmartinez\Desktop\Proyect_One && npm run dev -- --host"

REM Levantar backend
start cmd /k "cd /d C:\Users\cmartinez\Desktop\nest-js_procesos\apps\nest-js_procesos && npm run start:dev"

pause