@echo off
REM Levantar frontend
start cmd /k "cd /d C:\Users\cmartinez\Desktop\Proyect_One && npx serve -s dist -l 5173"

REM Levantar backend
start cmd /k "cd /d C:\Users\cmartinez\Desktop\nest-js_procesos\apps\nest-js_procesos && npm run start:prod"

REM NGINX
start cmd /k "cd /d C:\Users\cmartinez\Desktop\nest-js_procesos\nginx-1.30.1 && nginx.exe"

pause