# Summary of Scripts from the old WDS Folder

This document summarizes the contents and purpose of each script in the "Scripts from the old WDS" folder.

---

## Disk Partitioning & Formatting Scripts
- **390-Format.bat, 7010-Format.bat, 755-Format.bat, Laptop-Format.bat, Format.bat, format-OLD.bat**
  - Automate disk partitioning, formatting, and assignment of drive letters for various Dell models.
  - Used in imaging and system setup workflows.
  - Example: Create system reserved partition, format as NTFS, assign drive letters, set active partition.

- **Partition0.bat, Partition2.bat, Partition3.bat, Partition4.bat**
  - Delete specific partitions on disk 0.

---

## Boot Configuration Scripts
- **390-bcd.bat, 7010-bcd.bat, 755-bcd.bat, Laptop-bcd.bat, bcd.bat**
  - Use BCDEDIT to create and configure boot entries for Windows and Windows PE.
  - Set device, path, osdevice, systemroot, and description for boot entries.
  - Add entries to display order.

---

## Imaging & Deployment Scripts
- **DefaultLoad-OptiPlex755.bat, Dell3011-OutOfBoxPrep-OLD.bat, Dell3011-OutOfBoxPrep.bat, SHS-74-Carter.bat, SHS-75-Roberts.bat, SHS-78-Mosley.bat, SHS-85-Horne.bat, SHS-89-Kiah.bat, SHS-90-Quant.bat, SHS-93-Tripp.bat, SMS-D103-Bailey.bat, WHS-321.bat, WHS-323-Bryant.bat, WHS-521-Downing.bat, WHS-CTEcart.bat**
  - Automate network mapping, partitioning, and applying Windows images using `imagex`.
  - Apply boot sector images and modify boot sector entries.
  - Scripts are customized for specific rooms, devices, or models.

---

## WIM File Management
- **Mount WinPE 4.0 x64 WIM File.bat**
  - Mounts WinPE WIM file for modification.
- **Commit DISM Unmount.bat, Discard DISM Unmount.bat**
  - Unmount WIM file, either committing or discarding changes.

---

## Registry & Cleanup Scripts
- **IntelHotKeyCleanup.bat, Student - PostInstall.bat**
  - Delete Intel graphics hotkey registry entries and other post-install registry keys.
  - Student - PostInstall also deletes itself and a desktop batch file after running.

---

## Software Activation & Install
- **Office 2013 Activation.bat, Office 2013 Activation Self-Deleting.bat**
  - Activate Microsoft Office 2013 using `ospp.vbs`.
  - Self-deleting variant removes itself after activation.
- **SCEP-Install.bat**
  - Installs System Center Endpoint Protection client from network share, then deletes itself.

---

## Windows Update & Maintenance
- **wsus_powershell.ps1**
  - Resets Windows Update services and client IDs, deletes SoftwareDistribution folder, and triggers update detection.

---

## Windows Unattended Setup
- **unattend 1903.xml, unattend.xml**
  - XML files for automating Windows setup and OOBE.
  - Configure locale, user accounts, desktop optimization, organization, and timezone.

---

## Miscellaneous
- **Commit DISM Unmount.bat, Discard DISM Unmount.bat**
  - Manage WIM file mounting/unmounting.

---

# Notes
- Most scripts are tailored for specific Dell models or school locations.
- Imaging scripts rely on network shares and specific image files.
- Registry cleanup and post-install scripts help finalize deployments.
- Unattend XML files are critical for automating Windows setup.

---

This summary covers all scripts in the folder as of October 2025. For details on any specific script, refer to its contents or request a deeper analysis.
