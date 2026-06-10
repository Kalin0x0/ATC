@echo off
REM ============================================================================
REM  Atlantic Core - Windows database import helper
REM  An open project by Naiemi Group.
REM
REM  Double-click this file (or run it from CMD) to import atc.sql into a
REM  fresh `atc` database. Requires the MySQL/MariaDB client (`mysql`) on PATH.
REM ============================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo  Atlantic Core - Database Import
echo  --------------------------------
echo.

REM --- Check the mysql client is available ---
where mysql >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] The "mysql" command was not found.
  echo  Add your MySQL/MariaDB "bin" folder to PATH, for example:
  echo      C:\xampp\mysql\bin            ^(XAMPP^)
  echo      C:\Program Files\MariaDB 11\bin
  echo.
  pause
  exit /b 1
)

REM --- Gather connection details (press Enter for defaults) ---
set "DBHOST=localhost"
set "DBUSER=root"
set "DBNAME=atc"

set /p DBHOST=Host [localhost]:
if "%DBHOST%"=="" set "DBHOST=localhost"
set /p DBUSER=User [root]:
if "%DBUSER%"=="" set "DBUSER=root"
set /p DBNAME=Database name [atc]:
if "%DBNAME%"=="" set "DBNAME=atc"

echo.
echo  Creating database "%DBNAME%" (if it does not exist)...
mysql -h %DBHOST% -u %DBUSER% -p -e "CREATE DATABASE IF NOT EXISTS %DBNAME% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if errorlevel 1 (
  echo  [ERROR] Could not create the database. Check your credentials and try again.
  pause
  exit /b 1
)

echo.
echo  Importing atc.sql into "%DBNAME%" (this can take a moment)...
mysql -h %DBHOST% -u %DBUSER% -p %DBNAME% < "%~dp0atc.sql"
if errorlevel 1 (
  echo  [ERROR] Import failed. See the message above.
  pause
  exit /b 1
)

echo.
echo  [OK] Done. The Atlantic Core schema is installed in "%DBNAME%".
echo  Next: set your connection string in server.cfg / infra\.env, e.g.
echo      set mysql_connection_string "mysql://atc:PASSWORD@%DBHOST%/%DBNAME%?charset=utf8mb4"
echo.
pause
endlocal
