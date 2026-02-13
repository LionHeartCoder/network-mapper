import pandas as pd

# Define the data for the action plan
# Using casual, "self-written" language
data = [
    {
        "Done?": "[ ]",
        "Priority": "High",
        "Task": "Fix APC at my desk",
        "Notes": "It's offline. Needs reboot? Email Brian once fixed so he can verify.",
        "Deadline": "Today"
    },
    {
        "Done?": "[ ]",
        "Priority": "High",
        "Task": "Schedule Updates Meeting",
        "Notes": "With Brian & Daniel. Need plan for the 100+ devices left. Goal: Finish before Dec break.",
        "Deadline": "ASAP (nxt 2 days)"
    },
    {
        "Done?": "[ ]",
        "Priority": "Medium",
        "Task": "Angela Bowman - Wifi",
        "Notes": "Needs password. Check her OS for updates while I'm helping her.",
        "Deadline": "ASAP"
    },
    {
        "Done?": "[ ]",
        "Priority": "Low",
        "Task": "Dell BIOS/Secure Boot Check",
        "Notes": "Advisory re: 2011 cert expiring. Check models made after 2012. Update BIOS if needed.",
        "Deadline": "When time allows"
    }
]

# Create a DataFrame
df = pd.read_json(pd.io.json.dumps(data))

# Reorder columns to make sense logically
df = df[["Done?", "Priority", "Task", "Notes", "Deadline"]]

# Create the Excel writer
file_name = "Brian_Action_Items.xlsx"
writer = pd.ExcelWriter(file_name, engine='xlsxwriter')

# Write the main sheet
df.to_excel(writer, sheet_name='Action Plan', index=False)

# Get the xlsxwriter workbook and worksheet objects to apply formatting
workbook = writer.book
worksheet = writer.sheets['Action Plan']

# Add a formatted header
header_format = workbook.add_format({
    'bold': True,
    'text_wrap': True,
    'valign': 'top',
    'fg_color': '#D7E4BC', # Light green, looks like a standard office template
    'border': 1
})

# Add a format for the "Done?" column (center alignment)
center_format = workbook.add_format({'align': 'center'})

# Set column widths for better readability
worksheet.set_column('A:A', 8, center_format)  # Done?
worksheet.set_column('B:B', 10) # Priority
worksheet.set_column('C:C', 35) # Task
worksheet.set_column('D:D', 50) # Notes
worksheet.set_column('E:E', 15) # Deadline

# Apply header format
for col_num, value in enumerate(df.columns.values):
    worksheet.write(0, col_num, value, header_format)

# Create a second blank tab for the device list mentioned in the emails
worksheet2 = workbook.add_worksheet('Device List Placeholder')
worksheet2.write(0, 0, "Paste the '22H2 or Lower Needs Updates' CSV data here")

# Close the Pandas Excel writer and output the Excel file
writer.close()

print(f"File '{file_name}' has been created successfully.")