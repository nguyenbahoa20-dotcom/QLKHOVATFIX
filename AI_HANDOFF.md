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
- Tóm tắt thay đổi: Đồng bộ lại màn hình đăng nhập/tạo Admin và quản lý User; thêm bảng user và `invoice_items` nếu DB cũ thiếu; cải thiện nhận diện bên mua khi nhập hóa đơn, kiểm tra trùng và lỗi PDF/XML; bỏ số hóa đơn tự sinh. Thêm Node.js portable v24.21.0 vào gói Windows; VBS dùng launcher PowerShell, chờ server sẵn sàng và chỉ mở một cửa sổ trình duyệt; BAT hiện lỗi khởi động; GitHub Actions có workflow tạo ZIP portable.
- Tệp đã sửa: `src/App.tsx`, `src/types.ts`, `src/db/sqliteServer.ts`, `src/utils/api.ts`, `src/utils/pdfParser.ts`, `src/utils/xmlParser.ts`, các màn hình công ty/kho/hóa đơn/Gmail, `src/components/AuthGate.tsx`, `src/components/UserManagementModal.tsx`, `src/vite-env.d.ts`, `KhoiDongApp.ps1`, `KhoiDongApp.vbs`, `chay_phan_mem.bat`, `.gitignore`, `README.md`, `AI_HANDOFF.md`, `.github/workflows/package-windows.yml`; thêm `package-lock.json`.
- Kiểm tra đã chạy và kết quả: Node portable chạy được; `npm run lint` thành công với dependency đã có. GitHub Actions CI #36 thành công, gồm TypeScript và build qua bun.lock. `npm ci` cục bộ bị mạng npm ngắt giữa chừng; `npm run build` cục bộ bị sandbox chặn esbuild đọc thư mục cha. Gói ZIP portable đã tạo và kiểm tra không chứa DB, `.env` hoặc `node_modules`; workflow tạo ZIP trên GitHub chưa được chạy thủ công. Chưa thử VBS trên máy Windows sạch; không có test tự động trong package.json.

## Việc tiếp theo
- Người/AI nhận việc: Người dùng xem thay đổi trên Pull Request rồi chấp nhận hoặc yêu cầu sửa.
- Câu hỏi còn mở: Chạy thử workflow tạo ZIP và VBS trên máy Windows sạch. AI Studio chưa được đồng bộ qua giao diện của nó trong phiên này.

## Quy ước cập nhật
- Khi bắt đầu, chuyển trạng thái sang `IN_PROGRESS` và điền yêu cầu cụ thể.
- Khi đã tạo PR và ghi kết quả kiểm tra, chuyển sang `REVIEW_REQUESTED`.
- Người dùng quyết định chấp nhận, yêu cầu sửa, hay đóng công việc.
- Không ghi bí mật, API key, mật khẩu, token hay dữ liệu thật của khách hàng vào tệp này.
