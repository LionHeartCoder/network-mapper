@echo Dell 3011 AIO Out-Of-Box Imaging Script
@echo This script will prepare the machine
@echo and apply the appropriate images to the local machine.
@echo Author: Wesley H. Campbell; Date Created: 12-5-2013; Last Modified: 5-23-2014;
net use y: \\10.42.0.1\winimages /user:wds\localadmin
pause
@echo Recreating partitions..
@echo off
diskpart /s Partition2.bat
timeout 2
diskpart /s Partition3.bat
timeout 2
diskpart /s Partition4.bat
timeout 2
diskpart /s Partition0.bat
timeout 2
diskpart /s Format.bat
@echo on
@echo Partitions created.  Beginning imaging process..
@echo Applying Windows 7 image..
imagex /apply y:\SHS-93-Tripp.wim 1 d:
@echo Applying Windows PE image..
imagex /apply y:\Dell-3011AIO-WinPE.wim 1 e:
@echo Applying boot sector image..
imagex /apply y:\Dell-3011AIO-BootSect.wim 1 c:
@echo Imaging complete!
@echo Now to modify the boot sector...
Bcdedit /delete {default}
bcdedit /delete {d0e9942c-5bb5-11e3-bfc1-f23c6b85a487}
bcd.bat