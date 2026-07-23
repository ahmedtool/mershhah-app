@echo off
set STREAMPAY_API_KEY=fe01856a-e2c2-40f7-8449-4ed8deb91582
set STREAMPAY_API_SECRET=260aa962-8f59-44fa-81bb-01fa81197e97
set STREAMPAY_BASE_URL=https://stream-app-service.streampay.sa/api/v2
set PORT=8080
cd artifacts\api-server
pnpm dev
