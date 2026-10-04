# Bàn giao công việc cho AI

Tệp này là mẫu ghi chú chung để người dùng, Gemini và ChatGPT nhìn cùng yêu cầu. Nó không tự gửi tin nhắn giữa các AI; người dùng cập nhật nội dung và cung cấp PR/link cần xem.

## Trạng thái
IN_PROGRESS

## Cập nhật công việc 2026-10-04
- Việc cần làm hiện tại: Thêm luồng nhập ảnh chụp tồn kho từ Excel, có xem trước, xác nhận và xử lý mã SKU trùng.
- Thay đổi: thêm parser cho bảng tồn kho hai hàng tiêu đề; thêm modal xem trước; thêm API nhập hàng loạt có xác thực Admin và giao dịch SQLite; ghi hướng dẫn dùng trong README.
- Giới hạn dữ liệu: file Excel tồn cuối kỳ không có lịch sử hóa đơn. Import đặt tồn chốt kỳ làm số dư hàng hóa hiện tại (totalInbound bằng số tồn, totalOutbound bằng 0); không tạo invoice. Chạy resync hóa đơn sau này sẽ tính lại tồn theo dữ liệu hóa đơn.
- Kiểm tra: `npm run lint` thành công tại thư mục chạy cũ. `npm run build` bị sandbox chặn esbuild đọc thư mục cha khi nạp `vite.config.ts`; chưa xác nhận được bản build. Thử gọi parser với file Excel thật bị Node dừng trước khi chạy mã do `uv_os_get_passwd returned ENOMEM`. Không có test tự động trong package.json.
- Git: thư mục làm việc được cung cấp không có thư mục `.git`, nên chưa thể tạo branch riêng hoặc PR theo quy ước dự án.

### Sửa lỗi xác nhận nhập Excel
- Lỗi người dùng chụp: endpoint nhập hàng loạt trả HTML (giao diện cũ đang chạy máy chủ không có route mới).
- Cách xử lý: client phát hiện phản hồi không phải JSON thì dùng endpoint lưu mặt hàng cũ theo lô 12; sau lỗi sẽ tải lại tồn kho để phần xem trước phản ánh các dòng đã kịp lưu. Cần kiểm tra lại trong ứng dụng đang chạy; không ghi thử vào cơ sở dữ liệu của người dùng.
- Kiểm tra mới nhất: `npm run lint` thành công tại thư mục chạy cũ. Không thể gọi parser độc lập hoặc build giao diện trong sandbox do lỗi môi trường Node/esbuild đã nêu.

### Bổ sung địa chỉ đối tác trên hóa đơn
- Thêm ô địa chỉ người mua cho hóa đơn xuất kho (và địa chỉ người bán cho hóa đơn nhập), lưu vào SQLite với migration tự thêm cột cho DB cũ; backup/restore và báo cáo Excel cũng giữ địa chỉ.
- XML/PDF được đọc địa chỉ người mua khi có trường phù hợp. Cần khởi động lại máy chủ để migration và lưu trường mới có hiệu lực.
- Kiểm tra: `npm run lint` thành công tại thư mục chạy cũ. Chưa chạy lại build; lần build trước bị sandbox chặn esbuild đọc thư mục cha.

## Yêu cầu
- Việc cần làm: Phát hành gói Windows tự chạy, có Node.js portable, tự cài thư viện lần đầu và khởi động bằng VBS.
- Tiêu chí hoàn thành: Không cần cài Node.js hệ thống; VBS đợi máy chủ sẵn sàng trước khi mở trình duyệt; ZIP không chứa dữ liệu kho, tệp `.env`, `node_modules` hay cache cài đặt.
- Giới hạn hoặc điều cần giữ nguyên: Không đưa bí mật hoặc dữ liệu thật lên GitHub hay ZIP; cần Internet lần đầu để tải thư viện ứng dụng nếu chưa được cài sẵn.

## Tham chiếu
- Branch: `deploy/render-persistent-auth`
- Pull Request: https://github.com/nguyenbahoa20-dotcom/QLKHOVATFIX/pull/3
- Tệp hoặc màn hình liên quan: `TaxVaultPro.vbs`, `chay_phan_mem.bat`, `start_servers.bat`, `package-lock.json`, `README.md`

## Kết quả thực hiện
- Tóm tắt thay đổi: Đồng bộ lại màn hình đăng nhập/tạo Admin và quản lý User; thêm bảng user và `invoice_items` nếu DB cũ thiếu; cải thiện nhận diện bên mua khi nhập hóa đơn, kiểm tra trùng và lỗi PDF/XML; bỏ số hóa đơn tự sinh. Thêm Node.js portable v24.21.0 vào gói Windows; VBS dùng launcher PowerShell, chờ server sẵn sàng và chỉ mở một cửa sổ trình duyệt; thêm BOM UTF-8 để Windows PowerShell đọc đúng dấu tiếng Việt; BAT hiện lỗi khởi động; GitHub Actions có workflow tạo ZIP portable.
- Tệp đã sửa: `src/App.tsx`, `src/types.ts`, `src/db/sqliteServer.ts`, `src/utils/api.ts`, `src/utils/pdfParser.ts`, `src/utils/xmlParser.ts`, các màn hình công ty/kho/hóa đơn/Gmail, `src/components/AuthGate.tsx`, `src/components/UserManagementModal.tsx`, `src/vite-env.d.ts`, `TaxVaultPro.ps1`, `TaxVaultPro.vbs`, `chay_phan_mem.bat`, `.gitignore`, `README.md`, `AI_HANDOFF.md`, `.github/workflows/package-windows.yml`; thêm `package-lock.json`.
- Kiểm tra đã chạy và kết quả: Node portable trả phiên bản v24.21.0; Windows PowerShell phân tích launcher có BOM UTF-8 thành công; `npm run lint` thành công với dependency đã có. GitHub Actions CI #39 thành công, gồm TypeScript và build qua bun.lock. `npm ci` cục bộ bị mạng npm ngắt giữa chừng; `npm run build` cục bộ bị sandbox chặn esbuild đọc thư mục cha. Gói ZIP portable đã tạo và kiểm tra không chứa DB, `.env` hoặc `node_modules`; workflow tạo ZIP trên GitHub chưa được chạy thủ công. Chưa chạy đầy đủ máy chủ/VBS trong sandbox này vì Node báo lỗi hệ thống `uv_os_get_passwd` (cả Node đi kèm hệ thống và Node portable); cần xác nhận trên máy Windows sạch. Không có test tự động trong package.json.

## Việc tiếp theo
- Người/AI nhận việc: Người dùng xem thay đổi trên Pull Request rồi chấp nhận hoặc yêu cầu sửa.
- Câu hỏi còn mở: Chạy thử workflow tạo ZIP và VBS trên máy Windows sạch. AI Studio chưa được đồng bộ qua giao diện của nó trong phiên này.

## Quy ước cập nhật
- Khi bắt đầu, chuyển trạng thái sang `IN_PROGRESS` và điền yêu cầu cụ thể.
- Khi đã tạo PR và ghi kết quả kiểm tra, chuyển sang `REVIEW_REQUESTED`.
- Người dùng quyết định chấp nhận, yêu cầu sửa, hay đóng công việc.
- Không ghi bí mật, API key, mật khẩu, token hay dữ liệu thật của khách hàng vào tệp này.
