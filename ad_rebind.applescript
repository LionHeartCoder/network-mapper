-- AppleScript for AD Unbind, Rename, and Rebind
-- Update YOURDOMAIN and OU as needed for your environment

display dialog "Enter Network Administrator Username:" default answer ""
set adminUser to text returned of result

display dialog "Enter Network Administrator Password:" default answer "" with hidden answer
set adminPass to text returned of result

display dialog "Enter new device name:" default answer ""
set deviceName to text returned of result

-- Unbind from AD
set unbindCmd to "dsconfigad -remove -u " & quoted form of adminUser & " -p " & quoted form of adminPass
try
    set unbindResult to do shell script unbindCmd
on error errMsg
    display dialog "Unbind from AD failed: " & errMsg buttons {"OK"} default button "OK"
    error "Unbind failed"
end try

-- Rename device
set renameCmd to "scutil --set ComputerName " & quoted form of deviceName & "; scutil --set HostName " & quoted form of deviceName & "; scutil --set LocalHostName " & quoted form of deviceName
try
    do shell script renameCmd
on error errMsg
    display dialog "Rename failed: " & errMsg buttons {"OK"} default button "OK"
    error "Rename failed"
end try

-- Rebind to AD (update YOURDOMAIN and OU as needed)
set adDomain to "YOURDOMAIN"
set adOU to "/OU=Macs,DC=yourdomain,DC=com"
set bindCmd to "dsconfigad -add " & adDomain & " -u " & quoted form of adminUser & " -p " & quoted form of adminPass & " -ou " & quoted form of adOU
try
    do shell script bindCmd
on error errMsg
    display dialog "Rebind to AD failed: " & errMsg buttons {"OK"} default button "OK"
    error "Rebind failed"
end try

-- Confirm changes
set checkCmd to "dsconfigad -show"
try
    set checkResult to do shell script checkCmd
    if checkResult contains adDomain then
        display dialog "Device successfully renamed and rebound to AD. Reboot now?" buttons {"Reboot", "Later"} default button "Reboot"
        if button returned of result is "Reboot" then
            do shell script "shutdown -r now" with administrator privileges
        end if
    else
        display dialog "AD bind verification failed. Please try again." buttons {"OK"} default button "OK"
    end if
on error errMsg
    display dialog "Verification failed: " & errMsg buttons {"OK"} default button "OK"
end try
