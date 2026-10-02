Set WshShell = CreateObject("WScript.Shell")

' 1. Thực thi file batch khởi động ở chế độ ẨN HOÀN TOÀN (WindowStyle = 0, WaitOnReturn = False)
WshShell.Run "cmd /c start_servers.bat", 0, False

' 2. Chờ 8 giây để máy chủ Backend & Frontend hoàn tất khởi động
WScript.Sleep 8000

' 3. Tự động mở trình duyệt mặc định điều hướng đến ứng dụng TaxVault Pro
WshShell.Run "http://localhost:3000"
