# Bàn giao công việc cho AI

Tệp này là mẫu ghi chú chung để người dùng, Gemini và ChatGPT nhìn cùng yêu cầu. Nó không tự gửi tin nhắn giữa các AI; người dùng cập nhật nội dung và cung cấp PR/link cần xem.

## Trạng thái
REVIEW_REQUESTED

## Yêu cầu
- Việc cần làm: Phát hành gói Windows tự chạy, có Node.js portable, tự cài thư viện lần đầu và khởi động bằng VBS.
- Tiêu chí hoàn thành: Không cần cài Node.js hệ thống; VBS đợi máy chủ sẵn sàng trước khi mở trình duyệt; ZIP không chứa dữ liệu kho, tệp `.env`, `node_modules` hay cache cài đặt.
- Giới hạn hoặc điều cần giữ nguyên: Không đưa bí mật hoặc dữ liệu thật lên GitHub hay ZIP; cần Internet lần đầu để tải thư viện ứng dụng nếu chưa được cài sẵn.

## Tham chiếu
- Branch: `deploy/render-persistent-auth`
- Pull Request: https://github.com/nguyenbahoa20-dotcom/QLKHOVATFIX/pull/3
- Tệp hoặc màn hình liên quan: `KhoiDongApp.vbs`, `chay_phan_mem.bat`, `start_servers.bat`, `package-lock.json`, `README.md`

## Kết quả thực hiện
- Tóm tắt thay đổi: Thêm Node.js portable v24.21.0 vào gói Windows; VBS gọi cùng một launcher PowerShell có kiểm tra nhiều lần bấm, cài dependency bằng `npm ci` và xác minh SHA-256 nếu phải tải runtime; BAT dùng cùng luồng nhưng hiện lỗi trong cửa sổ; GitHub Actions có thể dựng ZIP portable từ repo.
- Tệp đã sửa: `KhoiDongApp.ps1`, `KhoiDongApp.vbs`, `chay_phan_mem.bat`, `.gitignore`, `README.md`, `AI_HANDOFF.md`, `.github/workflows/package-windows.yml`; thêm `package-lock.json`.
- Kiểm tra đã chạy và kết quả: Node portable chạy được; `npm run lint` thành công với các dependency đã có. `npm ci` mới bị mạng npm ngắt giữa chừng trong môi trường này. `npm run build` không hoàn tất vì sandbox chặn esbuild đọc thư mục cha; GitHub Actions cần xác nhận build. Chưa thử trên một máy Windows sạch; không có test tự động trong package.json.

## Việc tiếp theo
- Người/AI nhận việc: Người dùng xem thay đổi trên Pull Request rồi chấp nhận hoặc yêu cầu sửa.
- Câu hỏi còn mở: Cần kiểm tra GitHub Actions và chạy thử VBS trên máy Windows sạch. AI Studio chưa được đồng bộ qua giao diện của nó trong phiên này.

## Quy ước cập nhật
- Khi bắt đầu, chuyển trạng thái sang `IN_PROGRESS` và điền yêu cầu cụ thể.
- Khi đã tạo PR và ghi kết quả kiểm tra, chuyển sang `REVIEW_REQUESTED`.
- Người dùng quyết định chấp nhận, yêu cầu sửa, hay đóng công việc.
- Không ghi bí mật, API key, mật khẩu, token hay dữ liệu thật của khách hàng vào tệp này.
