@echo Dell Latitude Laptop Imaging Script
@echo This script will prepare the machine
@echo and apply the appropriate images to the local machine.
@echo Author: Wesley H. Campbell; Date Created: 12-5-2013; Last Modified: 7-03-2014;
net use y: \\10.42.0.1\winimages /user:wds\localadmin
pause
@echo Recreating partitions..
@echo off
diskpart /s Laptop-Format.bat
@echo on
@echo Partitions created.  Beginning imaging process..
@echo Applying Windows 7 image..
imagex /apply y:\WHS-CTEcart.wim 1 d:
@echo Applying boot sector image..
imagex /apply y:\E6420BootSect.wim 1 c:
@echo Imaging complete!
@echo Now to modify the boot sector...
Bcdedit /delete {default}
Laptop-bcd.bat