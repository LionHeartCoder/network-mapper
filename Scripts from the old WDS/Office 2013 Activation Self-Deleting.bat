@echo Activating Microsoft Office 2013...
C:
cd "C:\Program Files (x86)\Microsoft Office\Office15"
cscript ospp.vbs /act
pause
del /f/q "%~0" | exit