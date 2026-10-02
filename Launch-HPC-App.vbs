' ===================================================================
' Health & Pain Care Center (HPC) - Silent Desktop Application Launcher
' ===================================================================
Option Explicit

On Error Resume Next

Dim WshShell, fso, strPath, strBatFile
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get absolute directory of this script
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
strBatFile = strPath & "\Start-HPC.bat"

' Validate presence of Start-HPC.bat
If Not fso.FileExists(strBatFile) Then
    MsgBox "Launcher Error: Could not locate 'Start-HPC.bat' in:" & vbCrLf & strPath & vbCrLf & vbCrLf & "Please ensure the file is present in the HPC folder.", 16, "Health & Pain Care Center"
    WScript.Quit 1
End If

' Ensure working directory is set to project root
WshShell.CurrentDirectory = strPath

' Launch Start-HPC.bat completely hidden (0 = hide window, False = don't wait)
WshShell.Run """" & strBatFile & """", 0, False

If Err.Number <> 0 Then
    MsgBox "Failed to launch HPC Server:" & vbCrLf & Err.Description, 16, "Health & Pain Care Center"
End If

Set fso = Nothing
Set WshShell = Nothing
