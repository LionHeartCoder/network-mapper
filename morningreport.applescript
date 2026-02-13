-- Technology Playbook - Opening Procedures (AppleScript Version)

set checklist to {"Turn on Office Lights", "Double check storage area is secured and locked"}
set networkDevices to {Â
    {"CAES Primary Switch", "10.11.0.1"}, {"CAES DPL Server", "10.11.0.100"}, Â
    {"CES Primary Switch", "10.12.0.1"}, {"CES DPL Server", "10.12.0.100"}, Â
    {"HES Primary Switch", "10.13.0.1"}, {"HES DPL Server", "10.13.0.100"} Â
    -- Add more as needed
}
set websites to {Â
    {"Casper/JAMF", "https://casper.iwcs.k12.va.us"}, Â
    {"Camera System", "https://iwcs-gweb.iwcs.k12.va.us/securitycenter"}, Â
    {"PowerSchool", "https://powerschool.iwcs.k12.va.us"} Â
    -- Add more as needed
}

set results to {}
repeat with item in checklist
    display dialog item buttons {"Done"} default button "Done"
    set end of results to item & ": Done"
end repeat

-- Ping network devices
set networkResults to {}
repeat with device in networkDevices
    set devName to item 1 of device
    set devIP to item 2 of device
    set pingResult to do shell script "ping -c 1 -W 1 " & devIP & " >/dev/null && echo Up || echo Down"
    set end of networkResults to devName & " (" & devIP & "): " & pingResult
end repeat

-- Check websites (basic reachability)
set websiteResults to {}
repeat with site in websites
    set siteName to item 1 of site
    set siteURL to item 2 of site
    try
        set curlResult to do shell script "curl -Is " & siteURL & " | head -n 1"
        if curlResult contains "200" or curlResult contains "301" or curlResult contains "302" then
            set status to "Up"
        else
            set status to "Down"
        end if
    on error
        set status to "Down"
    end try
    set end of websiteResults to siteName & ": " & status
end repeat

-- Collect notes
display dialog "Add any notes or issues:" default answer ""
set notes to text returned of result

-- Generate report
set report to "Morning Technology Report:" & return & return
repeat with r in results
    set report to report & r & return
end repeat
set report to report & return & "Network Devices:" & return
repeat with n in networkResults
    set report to report & n & return
end repeat
set report to report & return & "Websites:" & return
repeat with w in websiteResults
    set report to report & w & return
end repeat
set report to report & return & "Notes: " & notes & return

-- Copy to clipboard
set the clipboard to report

display dialog "Report generated and copied to clipboard." buttons {"OK"} default button "OK"
