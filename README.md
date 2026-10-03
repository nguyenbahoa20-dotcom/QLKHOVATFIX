# QLKHOVATFIX — Quản lý kho và hóa đơn VAT

Ứng dụng gồm giao diện React, máy chủ Express và cơ sở dữ liệu SQLite. Không thể triển khai dưới dạng trang GitHub Pages tĩnh.

## Chạy trên máy tính Windows

1. Giải nén ZIP bằng **Extract All**; không chạy ứng dụng bên trong cửa sổ ZIP.
2. Không cần cài Node.js riêng: gói Windows mang theo Node.js portable trong thư mục `runtime`.
3. Lần đầu, kết nối Internet rồi nhấp đúp `KhoiDongApp.vbs`. Ứng dụng sẽ tự cài các thư viện từ `package.json`/`package-lock.json`, chờ máy chủ sẵn sàng rồi mới mở trình duyệt. Không cần chạy `chay_phan_mem.bat` trước.
4. Khi ứng dụng mở lần đầu, tạo tên đăng nhập và mật khẩu cho tài khoản Admin. Admin có thể tạo tài khoản Admin hoặc User trong nút **Tài khoản**.
5. Những lần sau, nhấp đúp `KhoiDongApp.vbs`. Sau khi đã cài thư viện, chạy ứng dụng được khi offline. Tính năng Gemini cần Internet.

Nếu VBS báo không khởi động được, nhấp đúp `chay_phan_mem.bat` để xem thông báo lỗi trong cửa sổ. Các thư viện JavaScript sẽ được tự tải ở lần chạy đầu, nên máy cần Internet lúc đó. Nếu thư mục `runtime` bị thiếu, launcher sẽ tải Node.js portable chính thức và kiểm tra mã SHA-256 trước khi dùng. Không cần cài Python hay SQLite riêng.

### Chia sẻ ứng dụng

Gửi toàn bộ thư mục dự án đã giải nén hoặc ZIP phát hành cho máy Windows khác. Không gửi `vat_database.db` hay tệp `.env` nếu có: cơ sở dữ liệu chứa thông tin riêng và máy nhận sẽ tự tạo kho dữ liệu mới. Node.js portable đã nằm trong gói; máy nhận chỉ cần Internet một lần để tải thư viện ứng dụng. Sau khi cài, dữ liệu lưu riêng trên máy đó; việc chép ứng dụng không đồng bộ dữ liệu giữa các máy.

### Tạo gói Windows từ GitHub

Sau khi các thay đổi launcher được chấp nhận, mở **Actions → Package Windows portable app → Run workflow**. Khi quy trình hoàn tất, tải artifact `QLKHOVATFIX-Windows-Portable` ở cuối trang chạy. Gói có Node.js portable đã kiểm tra SHA-256; không có cơ sở dữ liệu, tệp `.env`, hay thư viện cài sẵn. Máy nhận cần Internet ở lần chạy đầu để cài thư viện ứng dụng.

User có thể xem và nhập dữ liệu nhưng không thể xóa hóa đơn/lịch sử, xóa hàng khỏi kho, làm sạch dữ liệu hoặc phục hồi bản sao lưu. Các thao tác này dành cho Admin. Sau khi máy chủ khởi động lại, người dùng cần đăng nhập lại. Không đưa máy chủ phát triển ra Internet.

## Triển khai trực tuyến bằng Render

Tệp `render.yaml` cấu hình máy chủ Node dùng đúng phiên bản thư viện trong `bun.lock`, có ổ lưu trữ bền vững cho SQLite và tự cập nhật khi nhánh `main` đổi.

1. Đưa các thay đổi triển khai vào `main` sau khi xem và chấp nhận Pull Request.
2. Tạo tài khoản Render, chọn **New → Blueprint**, rồi kết nối repository GitHub `nguyenbahoa20-dotcom/QLKHOVATFIX`.
3. Khi Render hỏi giá trị bí mật, nhập tên đăng nhập và mật khẩu riêng. Mật khẩu phải có ít nhất 16 ký tự. Không ghi các giá trị này vào GitHub.
4. Xác nhận cấu hình và chi phí trong Render để tạo dịch vụ. Khi hoàn tất, Render cấp link dạng `https://<tên-dịch-vụ>.onrender.com`.
5. Mở link, hoàn tất lớp xác thực máy chủ nếu trình duyệt yêu cầu, sau đó tạo tài khoản Admin lần đầu hoặc đăng nhập bằng tài khoản đã tạo. Admin có thể tạo tài khoản User trong ứng dụng.

Blueprint dùng gói máy chủ trả phí nhỏ nhất và ổ lưu trữ 1 GB để giữ dữ liệu sau khi khởi động lại. Giá có thể thay đổi; hãy xác nhận số tiền ở trang Render trước khi tạo dịch vụ. Có thể thêm `GEMINI_API_KEY` trong trang quản lý dịch vụ nếu muốn dùng phân tích Gemini; ứng dụng vẫn mở được khi chưa có khóa này.

## Kiểm tra

- `npm run lint` kiểm tra TypeScript.
- `npm run build` dựng giao diện và máy chủ.
- GitHub Actions chạy hai bước này cho Pull Request và thay đổi trên `main`.
