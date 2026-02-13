@echo Dell 3011 AIO Out-Of-Box Imaging Script
@echo This script will prepare the machine
@echo and apply the appropriate images to the local machine.
@echo Author: Wesley H. Campbell; Date Created: 12-5-2013; Last Modified: 12-6-2013;
net use y: \\10.42.0.1\winimages /user:wds\localadmin
pause
@echo Creating partitions..
@echo off
diskpart /s format.bat
@echo on
@echo Partitions created.  Beginning imaging process..
@echo Applying Windows 7 image..
imagex /apply y:\Dell3011-Windows7-prepped.wim 1 d:
@echo Applying Windows PE image..
imagex /apply y:\Dell-3011AIO-WinPE.wim 1 e:
@echo Applying boot sector image..
imagex /apply y:\Dell-3011AIO-BootSect.wim 1 c:
@echo Imaging complete!
@echo Now to modify the boot sector...
Bcdedit /delete {default}
bcdedit /delete {d0e9942c-5bb5-11e3-bfc1-f23c6b85a487}
bcd.bat