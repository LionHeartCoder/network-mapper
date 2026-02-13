@echo off

setlocal

set BCDEDIT=%SYSTEMROOT%\system32\bcdedit.exe

set BCDSTORE=C:\Boot\BCD

for /f "tokens=3" %%A in ('%BCDEDIT% /store %BCDSTORE% /create /application osloader') do set guid=%%A

%BCDEDIT% /store %BCDSTORE% /set %guid% device partition=D:
%BCDEDIT% /store %BCDSTORE% /set %guid% path \Windows\system32\winload.exe
%BCDEDIT% /store %BCDSTORE% /set %guid% osdevice partition=D:
%BCDEDIT% /store %BCDSTORE% /set %guid% systemroot \Windows
%BCDEDIT% /store %BCDSTORE% /set %guid% description "Windows 7"
%BCDEDIT% /store %BCDSTORE% /displayorder %guid% /addfirst
exit