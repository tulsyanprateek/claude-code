@echo off
REM PSA Dashboard — Data Refresh
REM Double-click this file to regenerate dashboard_data.js from data-shadow/

cd /d "%~dp0"
echo Refreshing PSA dashboard data...
python generate_data.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Script failed. See messages above.
    pause
) else (
    echo.
    echo Data refresh complete.
    timeout /t 3
)
