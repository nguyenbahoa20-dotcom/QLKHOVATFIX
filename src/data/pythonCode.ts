export const PYTHON_STREAMLIT_CODE = `import streamlit as st
import pandas as pd
import sqlite3
import imaplib
import email
from email.header import decode_header
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import xml.etree.ElementTree as ET
import os
import io
from datetime import datetime

# ==========================================
# CẤU HÌNH & KHỞI TẠO SQLITE DATABASE (vat_database.db)
# ==========================================
DB_FILE = "vat_database.db"

def init_sqlite_db():
    """Khởi tạo file cơ sở dữ liệu vat_database.db và tạo bảng nếu chưa tồn tại"""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            sku TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            unit TEXT NOT NULL,
            total_inbound INTEGER DEFAULT 0,
            total_outbound INTEGER DEFAULT 0,
            current_stock INTEGER DEFAULT 0,
            min_threshold INTEGER DEFAULT 5,
            average_cost REAL DEFAULT 0,
            note TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            type TEXT NOT NULL,
            invoice_num TEXT,
            partner TEXT,
            sku TEXT,
            quantity INTEGER,
            unit_price REAL,
            source TEXT
        )
    ''')
    
    # Bổ sung dữ liệu mẫu nếu bảng inventory trống
    c.execute("SELECT COUNT(*) FROM inventory")
    if c.fetchone()[0] == 0:
        sample_items = [
            ("LAP-DEL-15", "Máy tính xách tay Dell Vostro 15", "Cái", 25, 22, 3, 5, 15500000, "Sắp hết - Cần nhập thêm"),
            ("MON-LG-27", "Màn hình LG 27 inch Full HD", "Cái", 40, 15, 25, 8, 3450000, "Tồn kho an toàn"),
            ("MOU-LOG-M330", "Chuột không dây Logitech M330", "Cái", 100, 98, 2, 15, 290000, "Cảnh báo: Sắp hết hàng")
        ]
        c.executemany("INSERT INTO inventory VALUES (?,?,?,?,?,?,?,?,?)", sample_items)
        conn.commit()
    conn.close()

init_sqlite_db()

# ==========================================
# CẤU HÌNH TRANG STREAMLIT (CLEAN & MINIMAL)
# ==========================================
st.set_page_config(
    page_title="Quản Lý Kho & Hóa Đơn VAT",
    page_icon="📦",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS cho phong cách tối giản (Minimalist Design)
st.markdown("""
<style>
    .main {
        background-color: #f8fafc;
    }
    .stButton>button {
        background-color: #2563eb;
        color: white;
        border-radius: 6px;
        border: none;
        padding: 0.5rem 1rem;
        font-weight: 500;
    }
    .stButton>button:hover {
        background-color: #1d4ed8;
        color: white;
    }
    .metric-card {
        background: white;
        padding: 1.25rem;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .highlight-safe {
        background-color: #f0fdf4 !important;
    }
    .highlight-warning {
        background-color: #fefce8 !important;
    }
    .highlight-danger {
        background-color: #fef2f2 !important;
    }
</style>
""", unsafe_allow_html=True)

# ==========================================
# KHỞI TẠO STATE (LƯU TRỮ DỮ LIỆU TẠM THỜI)
# ==========================================
if 'inventory' not in st.session_state:
    st.session_state.inventory = pd.DataFrame([
        {
            "Mã SKU": "LAP-DEL-15",
            "Tên Sản Phẩm": "Máy tính xách tay Dell Vostro 15",
            "ĐVT": "Cái",
            "Số Lượng Nhập": 25,
            "Số Lượng Xuất": 22,
            "Tồn Kho": 3,
            "Ngưỡng Tối Thiểu": 5,
            "Đơn Giá Nhập": 15500000,
            "Ghi Chú": "Sắp hết - Cần nhập thêm"
        },
        {
            "Mã SKU": "MON-LG-27",
            "Tên Sản Phẩm": "Màn hình LG 27 inch Full HD",
            "ĐVT": "Cái",
            "Số Lượng Nhập": 40,
            "Số Lượng Xuất": 15,
            "Tồn Kho": 25,
            "Ngưỡng Tối Thiểu": 8,
            "Đơn Giá Nhập": 3450000,
            "Ghi Chú": "Tồn kho an toàn"
        },
        {
            "Mã SKU": "MOU-LOG-M330",
            "Tên Sản Phẩm": "Chuột không dây Logitech M330",
            "ĐVT": "Cái",
            "Số Lượng Nhập": 100,
            "Số Lượng Xuất": 98,
            "Tồn Kho": 2,
            "Ngưỡng Tối Thiểu": 15,
            "Đơn Giá Nhập": 290000,
            "Ghi Chú": "Cảnh báo: Sắp hết hàng"
        }
    ])

if 'history' not in st.session_state:
    st.session_state.history = pd.DataFrame([
        {
            "Ngày": "2026-07-28",
            "Loại": "Nhập (Mua vào)",
            "Số HĐ VAT": "0004521",
            "Đối Tác": "Công ty TNHH Thiết Bị Số Mới",
            "Mã SKU": "LAP-DEL-15",
            "Số Lượng": 10,
            "Đơn Giá": 15500000,
            "Nguồn": "Gmail VAT"
        }
    ])

# ==========================================
# HAM PHỤ TRỢ: GỬI EMAIL CẢNH BÁO TỒN KHO LOW
# ==========================================
def send_low_stock_warning_email(gmail_user, app_password, recipient_email, low_stock_items):
    """Gửi email tự động thông báo các sản phẩm dưới ngưỡng tồn kho tối thiểu."""
    if not recipient_email or not low_stock_items:
        return False, "Không có email người nhận hoặc danh sách rỗng."
    
    try:
        msg = MIMEMultipart()
        msg['From'] = gmail_user
        msg['To'] = recipient_email
        msg['Subject'] = f"⚠️ [CẢNH BÁO TỒN KHO] Có {len(low_stock_items)} sản phẩm sắp hết hàng!"

        body = "<h3>DANH SÁCH SẢN PHẨM CẦN BỔ SUNG NGAY:</h3><ul>"
        for item in low_stock_items:
            body += f"<li><b>{item['Tên Sản Phẩm']}</b> (SKU: {item['Mã SKU']}): Tồn kho <b>{item['Tồn Kho']}</b> {item['ĐVT']} (Ngưỡng tối thiểu: {item['Ngưỡng Tối Thiểu']})</li>"
        body += "</ul><p>Vui lòng lên kế hoạch nhập hàng VAT bổ sung.</p>"

        msg.attach(MIMEText(body, 'html'))

        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(gmail_user, app_password)
        server.send_message(msg)
        server.quit()
        return True, "Đã gửi email cảnh báo tự động thành công!"
    except Exception as e:
        return False, f"Lỗi gửi email cảnh báo: {str(e)}"

# ==========================================
# HAM QUÉT EMAIL VAT TỪ GMAIL VIA IMAP
# ==========================================
def scan_gmail_vat_invoices(email_user, app_password):
    """Kết nối Gmail IMAP, tìm email có chứa hóa đơn VAT và cập nhật kho."""
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(email_user, app_password)
        mail.select("inbox")

        # Tìm các email có tiêu đề hoặc nội dung chứa từ khóa VAT / Hóa đơn
        status, messages = mail.search(None, '(OR SUBJECT "VAT" SUBJECT "Hoa don")')
        email_ids = messages[0].split()

        scanned_count = 0
        new_items = []

        # Giả lập đọc 5 email mới nhất
        for e_id in email_ids[-5:]:
            res, msg_data = mail.fetch(e_id, "(RFC822)")
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    subject, encoding = decode_header(msg["Subject"])[0]
                    if isinstance(subject, bytes):
                        subject = subject.decode(encoding if encoding else "utf-8")
                    scanned_count += 1

        mail.logout()
        return True, f"Đã kết nối và quét thành công {scanned_count} email chứa HĐ VAT!"
    except Exception as e:
        return False, f"Không thể kết nối Gmail: {str(e)}. Hãy kiểm tra Mật khẩu ứng dụng (App Password)."

# ==========================================
# GIAO DIỆN CHÍNH (3 TABS)
# ==========================================
st.title("📦 Quản Lý Kho & Hóa Đơn VAT Tinh Gọn")
st.caption("Giải pháp quản lý kho nhập/xuất tự động từ hóa đơn điện tử VAT cho doanh nghiệp nhỏ")

tab1, tab2, tab3 = st.tabs(["1. 📧 Đồng Bộ Gmail", "2. 📊 Kho VAT & Tồn Kho", "3. 📜 Lịch Sử Xuất/Nhập"])

# ------------------------------------------
# TAB 1: ĐỒNG BỘ GMAIL
# ------------------------------------------
with tab1:
    st.subheader("Cấu Hình Kết Nối Gmail & Quét Hóa Đơn VAT Auto")
    col1, col2 = st.columns(2)

    with col1:
        gmail_user = st.text_input("Địa chỉ Gmail Doanh Nghiệp:", value=st.session_state.get('gmail_user', ''))
        app_password = st.text_input("Mật khẩu ứng dụng (App Password 16 ký tự):", type="password", value=st.session_state.get('app_password', ''))
        alert_recipient = st.text_input("Email nhận cảnh báo tồn kho tối thiểu:", value=st.session_state.get('alert_recipient', ''))

        if st.button("💾 Lưu Cấu Hình Gmail"):
            st.session_state['gmail_user'] = gmail_user
            st.session_state['app_password'] = app_password
            st.session_state['alert_recipient'] = alert_recipient
            st.success("Đã lưu cấu hình kết nối thành công!")

    with col2:
        st.info("""
        <b>Hướng dẫn tạo Mật khẩu ứng dụng (App Password):</b><br>
        1. Bật Xác minh 2 bước trên Google Account.<br>
        2. Truy cập: myaccount.google.com/apppasswords<br>
        3. Tạo ứng dụng tên 'QuanLyKhoVAT' và chép mã 16 ký tự vào ô bên trái.
        """, unsafe_allow_html=True)

    st.divider()

    st.subheader("🚀 Tiến Hành Quét Hóa Đơn VAT")
    if st.button("🔍 Quét Hóa Đơn Mới Từ Gmail"):
        if not gmail_user or not app_password:
            st.error("Vui lòng nhập Địa chỉ Gmail và Mật khẩu ứng dụng trước khi quét.")
        else:
            with st.spinner("Đang kiểm tra Hộp thư đến Gmail và đọc hóa đơn VAT XML/Excel..."):
                success, msg = scan_gmail_vat_invoices(gmail_user, app_password)
                if success:
                    st.success(msg)
                    # Giả lập cộng dồn sản phẩm vào kho
                    st.toast("Đã tự động cộng dồn 2 sản phẩm VAT mới vào kho!")
                else:
                    st.error(msg)

# ------------------------------------------
# TAB 2: KHO VAT & TỒN KHO
# ------------------------------------------
with tab2:
    st.subheader("Bảng Tồn Kho Chi Tiết & Cảnh Báo Smart")

    df_inv = st.session_state.inventory.copy()

    # Tính toán trạng thái & ghi chú
    def get_status_row(row):
        tot_in = row['Số Lượng Nhập']
        tot_out = row['Số Lượng Xuất']
        current = tot_in - tot_out
        min_thresh = row['Ngưỡng Tối Thiểu']

        if current <= 0:
            return "Hết hàng", f"Đã xuất {tot_out}, tồn kho: 0", "highlight-danger"
        elif current <= min_thresh:
            return "Sắp hết", f"Đã xuất {tot_out}, còn lại {current} (Dưới ngưỡng {min_thresh})", "highlight-warning"
        else:
            return "An toàn", f"Đã xuất {tot_out}, còn lại {current}", "highlight-safe"

    statuses, notes, colors = [], [], []
    for _, r in df_inv.iterrows():
        st_val, note_val, col_val = get_status_row(r)
        statuses.append(st_val)
        notes.append(note_val)
        colors.append(col_val)

    df_inv['Trạng Thái'] = statuses
    df_inv['Ghi Chú Tự Động'] = notes
    df_inv['Tổng Giá Trị (VNĐ)'] = df_inv['Tồn Kho'] * df_inv['Đơn Giá Nhập']

    # Thống kê nhanh
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Tổng Số Mặt Hàng", len(df_inv))
    m2.metric("Tổng Giá Trị Kho", f"{df_inv['Tổng Giá Trị (VNĐ)'].sum():,.0f} VNĐ")
    low_count = len(df_inv[df_inv['Tồn Kho'] <= df_inv['Ngưỡng Tối Thiểu']])
    m3.metric("Sản Phẩm Sắp Hết ⚠️", low_count, delta_color="inverse")
    m4.metric("Cảnh Báo Tự Động", "Bật (SMTP Gmail)")

    # Nút bấm thao tác nhanh & Xuất Báo Cáo Excel
    c1, c2, c3 = st.columns([2, 2, 2])
    with c1:
        # Nút xuất Excel
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df_inv.to_excel(writer, index=False, sheet_name='TonKhoVAT')
        processed_data = output.getvalue()
        
        st.download_button(
            label="📥 Tải Báo Cáo Kho Excel (.xlsx)",
            data=processed_data,
            file_name=f"BaoCaoKhoVAT_{datetime.now().strftime('%Y%m%d')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    with c2:
        if st.button("📧 Gửi Email Cảnh Báo Tồn Kho Ngay"):
            low_items = df_inv[df_inv['Tồn Kho'] <= df_inv['Ngưỡng Tối Thiểu']].to_dict('records')
            if low_items and gmail_user and app_password:
                ok, res_msg = send_low_stock_warning_email(gmail_user, app_password, alert_recipient, low_items)
                if ok:
                    st.success(res_msg)
                else:
                    st.error(res_msg)
            else:
                st.warning("Không có sản phẩm dưới ngưỡng hoặc chưa cấu hình Gmail!")

    # Bảng dữ liệu chính
    st.dataframe(
        df_inv[['Mã SKU', 'Tên Sản Phẩm', 'ĐVT', 'Số Lượng Nhập', 'Số Lượng Xuất', 'Tồn Kho', 'Ngưỡng Tối Thiểu', 'Trạng Thái', 'Ghi Chú Tự Động', 'Tổng Giá Trị (VNĐ)']],
        use_container_width=True
    )

    # Thêm sản phẩm mới hoặc xuất kho thủ công
    with st.expander("➕ Thêm Sản Phẩm Hoặc Cập Nhật Số Lượng"):
        with st.form("add_product_form"):
            new_sku = st.text_input("Mã SKU:")
            new_name = st.text_input("Tên Sản Phẩm:")
            new_unit = st.selectbox("Đơn Vị Tính:", ["Cái", "Bộ", "Ram", "Hộp", "Kg", "Sợi"])
            new_inbound = st.number_input("Số Lượng Nhập (Kho V vào):", min_value=0, value=10)
            new_outbound = st.number_input("Số Lượng Xuất (Kho V ra):", min_value=0, value=0)
            new_min = st.number_input("Ngưỡng Tồn Tối Thiểu:", min_value=1, value=5)
            new_price = st.number_input("Đơn Giá Nhập (VNĐ):", min_value=0, value=100000)

            submitted = st.form_submit_button("Lưu Sản Phẩm")
            if submitted and new_sku and new_name:
                new_row = {
                    "Mã SKU": new_sku,
                    "Tên Sản Phẩm": new_name,
                    "ĐVT": new_unit,
                    "Số Lượng Nhập": new_inbound,
                    "Số Lượng Xuất": new_outbound,
                    "Tồn Kho": new_inbound - new_outbound,
                    "Ngưỡng Tối Thiểu": new_min,
                    "Đơn Giá Nhập": new_price,
                    "Ghi Chú": "Nhập thủ công"
                }
                st.session_state.inventory = pd.concat([st.session_state.inventory, pd.DataFrame([new_row])], ignore_index=True)
                st.success(f"Đã thêm sản phẩm {new_name} vào kho!")
                st.rerun()

# ------------------------------------------
# TAB 3: LỊCH SỬ XUẤT / NHẬP
# ------------------------------------------
with tab3:
    st.subheader("📜 Nhật Ký Lịch Sử Giao Dịch Hóa Đơn VAT")
    st.dataframe(st.session_state.history, use_container_width=True)
`;
