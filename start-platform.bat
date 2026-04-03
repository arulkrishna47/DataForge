@echo off
title Cortexa Platform Manager
echo ========================================================
echo   ⚡ CORTEXA - PLATFORM INITIALIZATION SEQUENCE ⚡
echo ========================================================
echo.
echo [1/3] Starting Cortexa Backend (Port 5000)...
start "CORTEXA_SERVER" cmd /k "cd server && npm run dev"

echo [2/3] Starting Cortexa AI Service (Port 8000)...
start "CORTEXA_AI" cmd /k "cd ai-service && python main.py"

echo [3/3] Starting Cortexa Frontend (Port 5173)...
start "CORTEXA_CLIENT" cmd /k "cd client && npm run dev"

echo.
echo --------------------------------------------------------
echo ✅ All 3 systems have been triggered. 
echo - Server: http://localhost:5000
echo - AI Service: http://localhost:8000
echo - Client: http://localhost:5173 (or 5174)
echo.
echo Keep the new windows open while working!
echo --------------------------------------------------------
pause
