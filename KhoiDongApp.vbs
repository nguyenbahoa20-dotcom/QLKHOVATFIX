Option Explicit

Dim shell, fso, appFolder, psScript, command, launchCode, url
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appFolder = fso.GetParentFolderName(WScript.ScriptFullName)
psScript = appFolder & "\KhoiDongApp.ps1"
url = "http://127.0.0.1:3000/"

' Wait for this launch attempt to finish. The PowerShell mutex allows only
' its owner to report success, so repeated clicks cannot queue browser tabs.
command = "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File " & _
          Chr(34) & psScript & Chr(34) & " -FromVbs"
launchCode = shell.Run(command, 0, True)

If launchCode = 0 Then
    If IsAppReady(url) Then
        shell.Run url
    Else
        ShowLaunchError
    End If
ElseIf launchCode <> 2 Then
    ShowLaunchError
End If

Sub ShowLaunchError
    MsgBox "Ung dung chua khoi dong duoc." & vbCrLf & _
           "Hay chay chay_phan_mem.bat trong thu muc ung dung de xem loi chi tiet.", _
           vbExclamation, "TaxVault Pro"
End Sub

Function IsAppReady(testUrl)
    On Error Resume Next
    Dim request
    Set request = CreateObject("WinHttp.WinHttpRequest.5.1")
    request.SetTimeouts 1000, 1000, 1000, 1000
    request.Open "GET", testUrl, False
    request.Send
    IsAppReady = (Err.Number = 0 And request.Status >= 200 And request.Status < 500)
    Err.Clear
    Set request = Nothing
    On Error GoTo 0
End Function
