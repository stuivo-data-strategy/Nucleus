@echo off
echo === Nucleus Server Startup ===
echo.

echo Checking Node.js...
node --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found on PATH.
    echo Extract node-v22.12.0-win-x64.zip from the offline folder
    echo and add the extracted folder to your system PATH.
    pause
    exit /b 1
)

echo.
echo Checking SurrealDB...
surreal version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: SurrealDB not found on PATH.
    echo Run surreal-v3.0.5-windows.exe from the offline folder to install.
    pause
    exit /b 1
)

echo.
echo Starting SurrealDB...
start "SurrealDB" surreal start surrealkv://C:/nucleus_data --user root --pass root --bind 0.0.0.0:8000
timeout /t 3 /nobreak > nul

echo.
echo Running database setup...
node database\setup.js

echo.
echo Starting Nucleus API...
start "Nucleus API" cmd /k "cd api && node dist\index.js"

echo.
echo === Started ===
echo SurrealDB: port 8000
echo API: port 3001
echo.
echo To serve the web UI, run a static server pointing at web\
echo Example: npx serve web -l 3000
echo.
pause
