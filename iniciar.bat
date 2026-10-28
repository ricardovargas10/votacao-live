@echo off
cd /d "%~dp0"
title Votacao do proximo jogo
chcp 65001 >nul
where node >nul 2>nul || (echo Node.js nao encontrado. Instale em https://nodejs.org e rode de novo. & pause & exit /b)
start "" http://localhost:3000/admin
node server.js
pause
