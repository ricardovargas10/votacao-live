@echo off
cd /d "%~dp0"
title Configurar o OBS para a votacao
chcp 65001 >nul
node configurar-obs.js
pause
