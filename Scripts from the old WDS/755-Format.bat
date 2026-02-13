select volume 0
assign letter=e
select disk 0
clean
create partition primary size=100
select partition 1
format fs=ntfs label="System Reserved" quick
assign letter=c
active
create partition primary
select partition 2
format fs=ntfs quick
assign letter=d