# QLKHOVATFIX — Quản lý kho và hóa đơn VAT

Ứng dụng gồm giao diện React, máy chủ Express và cơ sở dữ liệu SQLite. Không thể triển khai dưới dạng trang GitHub Pages tĩnh.

## Chạy trên máy tính

1. Giải nén ZIP bằng **Extract All**; không chạy trực tiếp bên trong cửa sổ ZIP.
2. Cài Node.js phiên bản 22 trở lên.
3. Khi có Internet, nhấp đúp `chay_phan_mem.bat`. File này cài thư viện ở lần chạy đầu, rồi mở ứng dụng.
4. Các lần sau có thể chạy lại `chay_phan_mem.bat` khi offline. Tính năng Gemini cần Internet.

Khi chạy chế độ phát triển, đăng nhập được tắt để dễ kiểm tra cục bộ. Không đưa máy chủ phát triển ra Internet. Nếu chạy lệnh production `npm start`, cần điền `ADMIN_USERNAME` và `ADMIN_PASSWORD` trong `.env`; mật khẩu phải dài ít nhất 16 ký tự.

## Triển khai trực tuyến bằng Render

Tệp `render.yaml` cấu hình máy chủ Node dùng đúng phiên bản thư viện trong `bun.lock`, có ổ lưu trữ bền vững cho SQLite và tự cập nhật khi nhánh `main` đổi.

1. Đưa các thay đổi triển khai vào `main` sau khi xem và chấp nhận Pull Request.
2. Tạo tài khoản Render, chọn **New → Blueprint**, rồi kết nối repository GitHub `nguyenbahoa20-dotcom/QLKHOVATFIX`.
3. Khi Render hỏi giá trị bí mật, nhập tên đăng nhập và mật khẩu riêng. Mật khẩu phải có ít nhất 16 ký tự. Không ghi các giá trị này vào GitHub.
4. Xác nhận cấu hình và chi phí trong Render để tạo dịch vụ. Khi hoàn tất, Render cấp link dạng `https://<tên-dịch-vụ>.onrender.com`.
5. Mở link và đăng nhập bằng thông tin đã đặt. Trình duyệt sẽ hiện hộp thoại đăng nhập.

Blueprint dùng gói máy chủ trả phí nhỏ nhất và ổ lưu trữ 1 GB để giữ dữ liệu sau khi khởi động lại. Giá có thể thay đổi; hãy xác nhận số tiền ở trang Render trước khi tạo dịch vụ. Có thể thêm `GEMINI_API_KEY` trong trang quản lý dịch vụ nếu muốn dùng phân tích Gemini; ứng dụng vẫn mở được khi chưa có khóa này.

## Kiểm tra

- `npm run lint` kiểm tra TypeScript.
- `npm run build` dựng giao diện và máy chủ.
- GitHub Actions chạy hai bước này cho Pull Request và thay đổi trên `main`.
