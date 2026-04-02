@echo off
title Cortexa Platform Manager
echo ========================================================
echo   ⚡ CORTEXA - PLATFORM INITIALIZATION SEQUENCE ⚡
echo ========================================================
echo.
echo [1/2] Starting Cortexa Backend (Port 5000)...
start "CORTEXA_SERVER" cmd /k "cd server && npm run dev"

echo [2/2] Starting Cortexa Frontend (Port 5173)...
start "CORTEXA_CLIENT" cmd /k "cd client && npm run dev"

echo.
echo --------------------------------------------------------
echo ✅ Both systems have been triggered. 
echo - Server: http://localhost:5000
echo - Client: http://localhost:5173 (or 5174)
echo.
echo Keep the new windows open while working!
echo --------------------------------------------------------
pause
