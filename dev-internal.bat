@echo off
title Warehouse Services (Internal Terminal)

npx concurrently --kill-others --prefix-colors "green,blue,magenta,cyan" --names "BACKEND,SSR,TUNNEL,DEV" ^
  "cd /d \"e:\warehouse project\warehouse-backend\" && .\venv\Scripts\python.exe -m daphne -b 0.0.0.0 -p 8000 config.asgi:application" ^
  "cd /d \"e:\warehouse project\warehouse-front\" && npm run build && node server.js" ^
  "cd /d \"e:\warehouse project\" && npx cloudflared tunnel run --protocol http2 --url http://localhost:4200 warehouse" ^
  "cd /d \"e:\warehouse project\warehouse-front\" && npm run start -- --port 4300"
