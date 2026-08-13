@echo off
chcp 65001 >nul
title Publicar Stonegy Auth Server no GitHub (fafadexs1)
cls

echo =====================================================================
echo    🚀 ENVIANDO STONEGY AUTH SERVER PARA O GITHUB (fafadexs1)
echo =====================================================================
echo.
echo Repositório de destino:
echo https://github.com/fafadexs1/stonegy-auth-server.git
echo.
echo [*] Enviando arquivos para a branch main...
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [!] Ocorreu um erro no envio.
    echo Certifique-se de que criou o repositório 'stonegy-auth-server' em:
    echo https://github.com/new
    echo.
) else (
    echo.
    echo =====================================================================
    echo  ✅ Código enviado com sucesso para o GitHub!
    echo =====================================================================
)

echo.
pause
