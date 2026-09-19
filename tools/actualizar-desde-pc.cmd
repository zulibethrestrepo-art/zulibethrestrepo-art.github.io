@echo off
rem Robot local: lee los seguidores desde este computador (donde Instagram si
rem responde) y publica el resultado en GitHub. Lo ejecuta la tarea programada
rem de Windows "Seguidores Zulibeth" una vez al dia; tambien se puede abrir a mano.
rem El resultado de la ultima corrida queda en tools\ultima-corrida.log

setlocal
cd /d "%~dp0.."
set LOG=%~dp0ultima-corrida.log

echo ==== %date% %time% ==== > "%LOG%"

echo Bajando lo ultimo de GitHub... >> "%LOG%"
git pull --rebase --quiet >> "%LOG%" 2>&1

echo Leyendo seguidores... >> "%LOG%"
node tools\seguidores.js >> "%LOG%" 2>&1
if errorlevel 1 (
  echo No se pudo leer ninguna red; no se publica nada. >> "%LOG%"
  exit /b 1
)

git diff --quiet -- seguidores.json historial.json
if not errorlevel 1 (
  echo Sin cambios que publicar. >> "%LOG%"
  exit /b 0
)

git add seguidores.json historial.json >> "%LOG%" 2>&1
git commit --quiet -m "Seguidores: actualizacion desde el PC" >> "%LOG%" 2>&1
git push --quiet >> "%LOG%" 2>&1
if errorlevel 1 (
  echo El primer envio fallo; reintentando tras traer cambios... >> "%LOG%"
  git pull --rebase --quiet >> "%LOG%" 2>&1
  git push --quiet >> "%LOG%" 2>&1
)
if errorlevel 1 (
  echo ERROR: no se pudo publicar en GitHub. >> "%LOG%"
  exit /b 1
)
echo Publicado en GitHub. >> "%LOG%"
exit /b 0
