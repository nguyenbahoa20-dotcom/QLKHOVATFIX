Option Explicit

Dim shell, fso, appFolder, psScript, command, attempt, ready, url
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appFolder = fso.GetParentFolderName(WScript.ScriptFullName)
psScript = appFolder & "\KhoiDongApp.ps1"
url = "http://127.0.0.1:3000/"

' PowerShell handles the single-instance check, portable Node.js and first-run npm install.
command = "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File " & _
          Chr(34) & psScript & Chr(34) & " -FromVbs"
shell.Run command, 0, False

' Wait until the server is ready before opening the browser. First launch may install packages.
ready = IsAppReady(url)
For attempt = 1 To 150
    If ready Then Exit For
    WScript.Sleep 2000
    ready = IsAppReady(url)
Next

If ready Then
    shell.Run url
Else
    MsgBox "Ung dung chua khoi dong duoc." & vbCrLf & _
           "Hay ket noi Internet khi chay lan dau, sau do chay chay_phan_mem.bat de xem loi.", _
           vbExclamation, "TaxVault Pro"
End If

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
