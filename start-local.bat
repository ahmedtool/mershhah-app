@echo off
echo ========================================
echo  Starting Mershhah locally
echo ========================================
echo.

echo [1/2] Starting API Server on port 8080...
start "Mershhah API" cmd /c "cd /d %~dp0artifacts\api-server && set STREAMPAY_API_KEY=fe01856a-e2c2-40f7-8449-4ed8deb91582 && set STREAMPAY_API_SECRET=260aa962-8f59-44fa-81bb-01fa81197e97 && set STREAMPAY_BASE_URL=https://stream-app-service.streampay.sa/api/v2 && set PORT=8080 && pnpm dev"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend on port 5173...
start "Mershhah Frontend" cmd /c "cd /d %~dp0artifacts\mershhah && pnpm dev"

echo.
echo ========================================
echo  Both servers are starting...
echo  Frontend: http://localhost:5173
echo  API:      http://localhost:8080
echo ========================================
echo.
pause
