echo Deleting specified registry keys...
reg delete HKLM\SOFTWARE\MICROSOFT\WINDOWS\CURRENTVERSION\RUN /v IgfxTray /f
reg delete HKLM\SOFTWARE\MICROSOFT\WINDOWS\CURRENTVERSION\RUN /v Persistence /f
reg delete HKCR\Directory\Background\shellex\ContextMenuHandlers\igfxcui\ /f
reg delete HKLM\Software\Microsoft\Windows\CurrentVersion\Run /v HotKeysCmds /f
pause