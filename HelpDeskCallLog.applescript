-- Help Desk Call Log (AppleScript Version)

-- Prompt for each field
set timeStr to do shell script "date '+%Y-%m-%d %H:%M:%S'"
display dialog "Caller Name:" default answer ""
set caller to text returned of result

display dialog "Phone #:" default answer ""
set phone to text returned of result

display dialog "School:" default answer ""
set school to text returned of result

display dialog "Barcode:" default answer ""
set barcode to text returned of result

display dialog "Device:" default answer ""
set device to text returned of result

display dialog "Ticket #:" default answer ""
set ticket to text returned of result

display dialog "Issue:" default answer ""
set issue to text returned of result

display dialog "Notes:" default answer ""
set notes to text returned of result

-- Format the log entry
set logEntry to "Time:\t" & timeStr & return & Â
    "Caller:\t" & caller & return & Â
    "Phone#:\t" & phone & return & Â
    "School:\t" & school & return & Â
    "Barcode:\t" & barcode & return & Â
    "Device:\t" & device & return & Â
    "Ticket#:\t" & ticket & return & Â
    "Issue:\t" & issue & return & Â
    "Notes:\t" & notes

-- Copy to clipboard
set the clipboard to logEntry

display dialog "Call log entry copied to clipboard! Paste into your document or log." buttons {"OK"} default button "OK"

-- Optionally, append to a text file for persistent log
set logFile to (POSIX path of (path to documents folder)) & "HelpDeskCallLog.txt"
do shell script "echo '---------------------\n" & logEntry & "' >> " & quoted form of logFile

display dialog "Call log entry saved to HelpDeskCallLog.txt in your Documents folder." buttons {"OK"} default button "OK"
