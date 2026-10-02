# Quy tắc dự án QLKHOVATFIX

## Công nghệ và cấu trúc
- Giao diện dùng React, TypeScript và Vite.
- Máy chủ API dùng Express trong `server.ts`; dữ liệu SQLite được xử lý trong `src/db/sqliteServer.ts`.
- Các lời gọi API từ giao diện nằm trong `src/utils/api.ts`.
- Ứng dụng cần máy chủ Node.js để chạy API và SQLite; không xem đây là trang tĩnh thuần túy.

## Quy trình thay đổi
- Mỗi công việc mới phải làm trên branch riêng, tách từ `main`.
- Không commit trực tiếp lên `main`. Mở Pull Request để xem thay đổi và kết quả CI.
- Không tự merge Pull Request hoặc triển khai khi chưa có người dùng duyệt.
- Giữ thay đổi nhỏ, chỉ sửa phần liên quan đến yêu cầu.
- Không sửa `.github/workflows/main.yml` (quy trình triển khai) trong công việc thông thường; nêu rõ lý do nếu yêu cầu cần thay đổi nó.

## Bảo mật và dữ liệu
- Không đưa API key, mật khẩu, token, dữ liệu Gmail thật hoặc dữ liệu kho thật vào mã nguồn, log, PR hay file bàn giao.
- Lưu bí mật trong biến môi trường hoặc GitHub Secrets. Không commit file `.env`; `.env.example` chỉ chứa giá trị minh họa.
- Không thay đổi cấu trúc SQLite hoặc hợp đồng API nếu yêu cầu không nói rõ.

## Kiểm tra trước khi yêu cầu review
Dự án hiện có các lệnh:
- `bun install --frozen-lockfile` — cài đúng các gói theo `bun.lock`.
- `bun run lint` — kiểm tra TypeScript.
- `bun run build` — dựng giao diện và máy chủ.

Chạy các lệnh phù hợp, ghi rõ kết quả trong Pull Request và `AI_HANDOFF.md`. Hiện chưa có lệnh test tự động trong `package.json`; không được báo là test đã chạy nếu chưa có.

## Hoàn tất công việc
- Tóm tắt mục đích, các tệp đã sửa và kết quả kiểm tra trong PR.
- Chỉ đánh dấu công việc đã hoàn tất sau khi người dùng duyệt và merge PR.