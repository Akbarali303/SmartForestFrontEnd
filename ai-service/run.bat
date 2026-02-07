@echo off
REM PowerShell da: .\run.bat deb yozing
cd /d "%~dp0"
if not exist "venv" (
  echo Venv yaratilmoqda...
  python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt -q
echo AI servis ishga tushmoqda (kamera + Telegram)...
python person_detector.py
pause
