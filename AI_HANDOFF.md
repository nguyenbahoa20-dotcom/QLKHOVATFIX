# Bàn giao công việc cho AI

Tệp này là mẫu ghi chú chung để người dùng, Gemini và ChatGPT nhìn cùng yêu cầu. Nó không tự gửi tin nhắn giữa các AI; người dùng cập nhật nội dung và cung cấp PR/link cần xem.

## Trạng thái
REVIEW_REQUESTED

## Yêu cầu
- Việc cần làm: Chuẩn bị triển khai QLKHOVATFIX trên host có máy chủ Express và lưu trữ SQLite bền vững.
- Tiêu chí hoàn thành: Có bảo vệ đăng nhập, cổng host cấp, đường dẫn cơ sở dữ liệu cấu hình được, Blueprint Render và CI kiểm tra build.
- Giới hạn hoặc điều cần giữ nguyên: Không đưa bí mật/dữ liệu thật lên GitHub; không triển khai trang tĩnh; không tự merge PR.

## Tham chiếu
- Branch: deploy/render-persistent-auth
- Pull Request: https://github.com/nguyenbahoa20-dotcom/QLKHOVATFIX/pull/3
- Tệp hoặc màn hình liên quan: `server.ts`, `src/db/sqliteServer.ts`, `vite.config.ts`, `render.yaml`, `README.md`

## Kết quả thực hiện
- Tóm tắt thay đổi: Thêm xác thực Basic chỉ trong production, kiểm tra nguồn cho thao tác ghi, đọc `PORT`, dùng đường dẫn SQLite cấu hình được; thay Pages bằng Blueprint Render; ẩn nút tắt máy chủ trên bản production.
- Tệp đã sửa: `server.ts`, `src/db/sqliteServer.ts`, `src/components/Navbar.tsx`, `vite.config.ts`, `.env.example`, `.github/workflows/main.yml`, `render.yaml`, `README.md`, `AI_HANDOFF.md`.
- Kiểm tra đã chạy và kết quả: GitHub Actions #8 thành công: cài thư viện theo bun.lock, kiểm tra TypeScript và build app/server. Không chạy được npm install cục bộ trong môi trường làm việc hiện tại.

## Việc tiếp theo
- Người/AI nhận việc: Người dùng xem Pull Request, sau đó chấp nhận hoặc yêu cầu sửa.
- Câu hỏi còn mở: Render là dịch vụ trả phí; cần người dùng tạo dịch vụ và xác nhận mức phí trước khi có link trực tuyến.

## Quy ước cập nhật
- Khi bắt đầu, chuyển trạng thái sang `IN_PROGRESS` và điền yêu cầu cụ thể.
- Khi đã tạo PR và ghi kết quả kiểm tra, chuyển sang `REVIEW_REQUESTED`.
- Người dùng quyết định chấp nhận, yêu cầu sửa, hay đóng công việc.
- Không ghi bí mật, API key, mật khẩu, token hay dữ liệu thật của khách hàng vào tệp này.
