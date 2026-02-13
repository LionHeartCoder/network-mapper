select volume 0
assign letter=h
select disk 0
create partition primary size=100
select partition 2
format fs=ntfs label="System Reserved" quick
assign letter=c
active
create partition primary
select partition 3
shrink desired=2048
format fs=ntfs quick
assign letter=d
create partition primary
select partition 4
format fs=ntfs quick
assign letter=e