@echo Dell 7010 Imaging Script
@echo This script will prepare the machine
@echo and apply the appropriate images to the local machine.
@echo Author: Wesley H. Campbell; Date Created: 12-5-2013; Last Modified: 7-21-2014;
net use y: \\10.42.0.1\winimages /user:wds\localadmin
pause
@echo Recreating partitions..
@echo off
diskpart /s 7010-Format.bat
@echo on
@echo Partitions created.  Beginning imaging process..
@echo Applying Windows 7 image..
imagex /apply y:\SHS-78-Mosley.wim 1 d:
@echo Applying boot sector image..
imagex /apply y:\OptiPlex7010BootSect.wim 1 c:
@echo Imaging complete!
@echo Now to modify the boot sector...
Bcdedit /delete {default}
bcdedit /delete {d0e9942c-5bb5-11e3-bfc1-f23c6b85a487}
7010-bcd.bat