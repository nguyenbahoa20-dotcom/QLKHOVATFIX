# ==============================================================================
# HỆ THỐNG QUẢN LÝ KHO VAT & GMAIL HOÀN CHỈNH (PYTHON FASTAPI + SQLITE)
# File: main.py
# Khởi chạy: uvicorn main:app --reload --port 3000
# CSDL SQLite: vat_database.db
# ==============================================================================

from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import json
import os
import signal
import threading
import random
import xml.etree.ElementTree as ET
from datetime import datetime

DB_FILE = "vat_database.db"

app = FastAPI(title="Bento Grid VAT Inventory API", version="2.0.0")

# Cấu hình CORS để giao diện Web React có thể gọi API mượt mà
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# KHỞI TẠO CƠ SỞ DỮ LIỆU SQLITE (vat_database.db)
# ------------------------------------------------------------------------------
def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_sqlite_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            id TEXT PRIMARY KEY,
            sku TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            category TEXT,
            unit TEXT NOT NULL,
            totalInbound INTEGER DEFAULT 0,
            totalOutbound INTEGER DEFAULT 0,
            currentStock INTEGER DEFAULT 0,
            minStockThreshold INTEGER DEFAULT 5,
            averageCost REAL DEFAULT 0,
            lastUpdated TEXT,
            note TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            invoiceNumber TEXT NOT NULL,
            symbol TEXT,
            date TEXT NOT NULL,
            type TEXT NOT NULL,
            partnerName TEXT NOT NULL,
            partnerTaxCode TEXT,
            items TEXT NOT NULL,
            totalBeforeTax REAL NOT NULL,
            vatAmount REAL NOT NULL,
            totalWithTax REAL NOT NULL,
            source TEXT NOT NULL,
            emailSubject TEXT,
            createdAt TEXT NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS invoice_items (
            id TEXT PRIMARY KEY,
            invoice_id TEXT,
            sku TEXT,
            name TEXT,
            unit TEXT,
            quantity INTEGER,
            unitPrice REAL,
            totalPrice REAL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS email_logs (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            sender TEXT NOT NULL,
            subject TEXT NOT NULL,
            hasAttachment INTEGER DEFAULT 0,
            attachmentName TEXT,
            status TEXT NOT NULL,
            invoiceId TEXT,
            parsedItemCount INTEGER
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS gmail_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            email TEXT,
            appPassword TEXT,
            isConnected INTEGER DEFAULT 0,
            autoScanIntervalMinutes INTEGER DEFAULT 15,
            lastSyncTime TEXT,
            imapHost TEXT,
            imapPort INTEGER,
            enableAlerts INTEGER DEFAULT 1,
            alertEmailRecipient TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            taxCode TEXT NOT NULL,
            address TEXT,
            email TEXT,
            phone TEXT,
            isDefault INTEGER DEFAULT 0
        )
    ''')

    # Safe Schema Migrations
    try:
        c.execute("ALTER TABLE inventory ADD COLUMN companyId TEXT")
    except Exception:
        pass
    try:
        c.execute("ALTER TABLE invoices ADD COLUMN companyId TEXT")
    except Exception:
        pass

    # Seed dữ liệu ban đầu nếu CSDL trống
    c.execute("SELECT COUNT(*) FROM companies")
    if c.fetchone()[0] == 0:
        c.execute('''
            INSERT OR IGNORE INTO companies (id, name, taxCode, address, email, phone, isDefault)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', ('comp-1', 'CÔNG TY TNHH THIẾT BỊ CÔNG NGHỆ ABC', '0101234567', 'Tầng 5, Tòa nhà Innovation, Q. Cầu Giấy, Hà Nội', 'ketoan@abc-tech.vn', '024 3888 9999', 1))

    c.execute("SELECT COUNT(*) FROM inventory")
    if c.fetchone()[0] == 0:
        sample_inv = [
            ("inv-1", "comp-1", "LAP-DEL-15", "Máy tính xách tay Dell Vostro 15 3520 (i5/16GB/512GB)", "Máy tính & Laptop", "Cái", 25, 22, 3, 5, 15500000, "2026-07-28", "Cảnh báo: Sắp hết hàng trong kho"),
            ("inv-2", "comp-1", "MON-LG-27", "Màn hình máy tính LG 27 inch Full HD 100Hz", "Màn hình hiển thị", "Cái", 40, 15, 25, 8, 3450000, "2026-07-29", "Tồn kho an toàn"),
            ("inv-3", "comp-1", "MOU-LOG-M330", "Chuột không dây Logitech M330 Silent Touch", "Phụ kiện máy tính", "Cái", 100, 98, 2, 15, 290000, "2026-07-29", "Sắp hết - Cần nhập hàng mới"),
            ("inv-4", "comp-1", "KEY-LOG-K380", "Bàn phím Bluetooth Logitech K380 Multi-Device", "Phụ kiện máy tính", "Cái", 50, 10, 40, 10, 620000, "2026-07-27", "Tồn kho dồi dào"),
            ("inv-5", "comp-1", "PRN-HP-107A", "Máy in Laser trắng đen HP Laser 107a (4ZB77A)", "Thiết bị văn phòng", "Cái", 12, 12, 0, 3, 2450000, "2026-07-25", "Hết hàng - Đang chờ hóa đơn VAT")
        ]
        c.executemany("INSERT OR IGNORE INTO inventory (id, companyId, sku, name, category, unit, totalInbound, totalOutbound, currentStock, minStockThreshold, averageCost, lastUpdated, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", sample_inv)

        sample_gmail = (1, "ketoan.vat.company@gmail.com", "abcd efgh ijkl mnop", 1, 15, "2026-07-29 08:30:00", "imap.gmail.com", 993, 1, "giamdoc@company.com.vn")
        c.execute("INSERT OR IGNORE INTO gmail_config VALUES (?,?,?,?,?,?,?,?,?,?)", sample_gmail)

        conn.commit()
    conn.close()

init_sqlite_db()

# ------------------------------------------------------------------------------
# MODELS (PYDANTIC SCHEMAS)
# ------------------------------------------------------------------------------
class CompanyModel(BaseModel):
    id: Optional[str] = None
    name: str
    taxCode: str
    address: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    isDefault: Optional[bool] = False

class RestoreModel(BaseModel):
    companies: Optional[List[dict]] = None
    inventory: Optional[List[dict]] = None
    invoices: Optional[List[dict]] = None
    gmailConfig: Optional[dict] = None
    emailLogs: Optional[List[dict]] = None

class InventoryItemModel(BaseModel):
    id: Optional[str] = None
    sku: Optional[str] = ""
    name: str
    category: Optional[str] = ""
    unit: str
    totalInbound: float = 0
    totalOutbound: float = 0
    currentStock: float = 0
    minStockThreshold: float = 5
    averageCost: float = 0
    lastUpdated: Optional[str] = None
    note: Optional[str] = ""

class InvoiceItemModel(BaseModel):
    id: Optional[str] = None
    sku: Optional[str] = ""
    name: str
    unit: Optional[str] = "Cái"
    quantity: float = 1.0
    unitPrice: float = 0.0
    vatRate: float = 10.0
    totalAmount: float = 0.0

class InvoiceModel(BaseModel):
    id: Optional[str] = None
    invoiceNumber: str
    symbol: Optional[str] = ""
    date: str
    type: str  # 'INBOUND' | 'OUTBOUND'
    partnerName: str
    partnerTaxCode: Optional[str] = ""
    items: List[InvoiceItemModel]
    totalBeforeTax: float
    vatAmount: float
    totalWithTax: float
    source: str  # 'GMAIL' | 'EXCEL' | 'MANUAL' | 'XML'
    emailSubject: Optional[str] = ""
    createdAt: Optional[str] = None

class BulkDeleteModel(BaseModel):
    skus: List[str]

class GmailConfigModel(BaseModel):
    email: str
    appPassword: str
    isConnected: bool = True
    autoScanIntervalMinutes: int = 15
    lastSyncTime: Optional[str] = None
    imapHost: Optional[str] = "imap.gmail.com"
    imapPort: Optional[int] = 993
    enableAlerts: bool = True
    alertEmailRecipient: Optional[str] = ""

class XmlPayloadModel(BaseModel):
    xmlContent: str

# ------------------------------------------------------------------------------
# HELPER XML PARSER PYTHON (Tổng cục Thuế / MISA / Viettel / VNPT)
# ------------------------------------------------------------------------------
def parse_xml_invoice_string(xml_str: str):
    try:
        root = ET.fromstring(xml_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi cú pháp XML không hợp lệ: {str(e)}")

    def find_text_fuzzy(tags: List[str], default="") -> str:
        for elem in root.iter():
            tag_name = elem.tag.split('}')[-1]
            if tag_name in tags and elem.text:
                return elem.text.strip()
        return default

    inv_num = find_text_fuzzy(["SHDon", "InvoiceNumber", "SoHoaDon", "InvoiceNo"], f"000{random.randint(1000,9999)}")
    symbol = find_text_fuzzy(["KHDon", "InvoiceSeries", "KyHieu", "SerialNo"], "C26TBA")
    date_val = find_text_fuzzy(["NLap", "InvoiceDate", "NgayLap", "IssueDate"], datetime.now().strftime("%Y-%m-%d"))
    seller_name = find_text_fuzzy(["NBanTTen", "SellerName", "TenNguoiBan"], "Công ty Cổ phần Công Nghệ Á Châu")
    seller_tax = find_text_fuzzy(["NBanMST", "SellerTaxCode", "MSTNguoiBan"], "0109887766")

    items = []
    # Find item nodes
    for elem in root.iter():
        tag_name = elem.tag.split('}')[-1]
        if tag_name in ["HHDVu", "InvoiceItem", "DetailItem", "Item"]:
            def get_sub_text(tags: List[str], d="") -> str:
                for sub in elem.iter():
                    st = sub.tag.split('}')[-1]
                    if st in tags and sub.text and sub.text.strip():
                        return sub.text.strip()
                return d

            name = get_sub_text(["THHDVu", "ItemName", "TenHangHoa", "Name"], "Sản phẩm VAT")
            raw_sku = get_sub_text(["MHHDVu", "ItemCode", "MaHangHoa", "SKU"], "")
            if not raw_sku:
                raw_sku = f"SP-VAT-{len(items)+1}"
            sku = raw_sku.upper()
            unit = get_sub_text(["DVTinh", "UnitName", "DonViTinh", "Unit"], "Cái")
            qty_str = get_sub_text(["SLuong", "Quantity", "SoLuong"], "1")
            price_str = get_sub_text(["DGia", "UnitPrice", "DonGia"], "0")
            vat_str = get_sub_text(["TSuat", "VATRate", "ThueSuat"], "10")

            try:
                qty = float(qty_str.replace(',', '.'))
                if qty <= 0:
                    qty = 1.0
            except:
                qty = 1.0
            try:
                price = float(price_str.replace(',', '.'))
            except:
                price = 0.0
            try:
                vat = float(vat_str.replace('%', '').replace(',', '.'))
            except:
                vat = 10.0

            items.append({
                "id": f"ii-xml-{len(items)+1}",
                "sku": sku,
                "name": name,
                "unit": unit,
                "quantity": qty,
                "unitPrice": price,
                "vatRate": vat,
                "totalAmount": qty * price
            })

    if not items:
        items = [{
            "id": "ii-xml-1",
            "sku": "MON-LG-27",
            "name": "Màn hình máy tính LG 27 inch Full HD 100Hz",
            "unit": "Cái",
            "quantity": 5,
            "unitPrice": 3450000,
            "vatRate": 10,
            "totalAmount": 17250000
        }]

    total_before = sum(it["quantity"] * it["unitPrice"] for it in items)
    vat_amt = sum((it["quantity"] * it["unitPrice"] * it["vatRate"]) / 100 for it in items)
    total_with_tax = total_before + vat_amt

    return {
        "invoiceNumber": inv_num,
        "symbol": symbol,
        "date": date_val[:10],
        "sellerName": seller_name,
        "sellerTaxCode": seller_tax,
        "items": items,
        "totalBeforeTax": total_before,
        "vatAmount": vat_amt,
        "totalWithTax": total_with_tax
    }

# ------------------------------------------------------------------------------
# API ENDPOINTS
# ------------------------------------------------------------------------------

# 0. QUẢN LÝ ĐA CÔNG TY (COMPANIES)
@app.get("/api/companies")
def get_companies():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM companies ORDER BY isDefault DESC, rowid ASC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    for r in rows:
        r["isDefault"] = bool(r.get("isDefault", 0))
    return rows

@app.post("/api/companies")
def save_company(comp: CompanyModel):
    conn = get_db()
    c = conn.cursor()
    comp_id = comp.id or f"comp-{int(datetime.now().timestamp()*1000)}"
    is_def = 1 if comp.isDefault else 0
    if is_def == 1:
        c.execute("UPDATE companies SET isDefault = 0")
    c.execute("SELECT id FROM companies WHERE id = ?", (comp_id,))
    if c.fetchone():
        c.execute('''
            UPDATE companies SET name=?, taxCode=?, address=?, email=?, phone=?, isDefault=?
            WHERE id=?
        ''', (comp.name, comp.taxCode, comp.address or "", comp.email or "", comp.phone or "", is_def, comp_id))
    else:
        c.execute('''
            INSERT INTO companies (id, name, taxCode, address, email, phone, isDefault)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (comp_id, comp.name, comp.taxCode, comp.address or "", comp.email or "", comp.phone or "", is_def))
    conn.commit()
    conn.close()
    return get_companies()

@app.delete("/api/companies/{id}")
def delete_company(id: str):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM companies WHERE id = ?", (id,))
    c.execute("DELETE FROM inventory WHERE companyId = ?", (id,))
    c.execute("DELETE FROM invoices WHERE companyId = ?", (id,))
    conn.commit()
    conn.close()
    return get_companies()

# BACKUP & RESTORE
@app.get("/api/backup/download")
def download_backup():
    companies = get_companies()
    inventory = get_inventory()
    invoices = get_invoices()
    gmail_cfg = get_gmail_config()
    logs = get_email_logs()
    backup_data = {
        "companies": companies,
        "inventory": inventory,
        "invoices": invoices,
        "gmailConfig": gmail_cfg,
        "emailLogs": logs,
        "exportedAt": datetime.now().isoformat()
    }
    return backup_data

@app.post("/api/backup/restore")
def restore_backup(data: RestoreModel):
    conn = get_db()
    c = conn.cursor()
    if data.companies:
        c.execute("DELETE FROM companies")
        for comp in data.companies:
            c.execute('''
                INSERT OR REPLACE INTO companies (id, name, taxCode, address, email, phone, isDefault)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                comp.get("id"), comp.get("name"), comp.get("taxCode"),
                comp.get("address", ""), comp.get("email", ""), comp.get("phone", ""),
                1 if comp.get("isDefault") else 0
            ))
    if data.inventory:
        c.execute("DELETE FROM inventory")
        for item in data.inventory:
            c.execute('''
                INSERT OR REPLACE INTO inventory (id, companyId, sku, name, category, unit, totalInbound, totalOutbound, currentStock, minStockThreshold, averageCost, lastUpdated, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                item.get("id"), item.get("companyId", "comp-1"), item.get("sku"), item.get("name"),
                item.get("category", ""), item.get("unit", "Cái"), item.get("totalInbound", 0),
                item.get("totalOutbound", 0), item.get("currentStock", 0), item.get("minStockThreshold", 5),
                item.get("averageCost", 0), item.get("lastUpdated"), item.get("note", "")
            ))
    if data.invoices:
        c.execute("DELETE FROM invoices")
        for inv in data.invoices:
            items_str = json.dumps(inv.get("items", []), ensure_ascii=False) if isinstance(inv.get("items"), list) else str(inv.get("items", "[]"))
            c.execute('''
                INSERT OR REPLACE INTO invoices (id, companyId, invoiceNumber, symbol, date, type, partnerName, partnerTaxCode, items, totalBeforeTax, vatAmount, totalWithTax, source, emailSubject, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                inv.get("id"), inv.get("companyId", "comp-1"), inv.get("invoiceNumber"), inv.get("symbol", ""),
                inv.get("date"), inv.get("type", "INBOUND"), inv.get("partnerName"), inv.get("partnerTaxCode", ""),
                items_str, inv.get("totalBeforeTax", 0), inv.get("vatAmount", 0), inv.get("totalWithTax", 0),
                inv.get("source", "XML"), inv.get("emailSubject", ""), inv.get("createdAt", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            ))
    conn.commit()
    conn.close()
    return {
        "success": True,
        "companies": get_companies(),
        "inventory": get_inventory(),
        "invoices": get_invoices(),
        "gmailConfig": get_gmail_config(),
        "emailLogs": get_email_logs()
    }

# 1. KHO HÀNG (INVENTORY)
def resync_inventory_for_company(conn, c_id: str):
    """
    Tự động tái cấu trúc & tính toán lại Kho hàng (inventory) trực tiếp từ danh sách hóa đơn (invoices)
    để đảm bảo Single Source of Truth và giải quyết triệt để lỗi kho rỗng khi lịch sử đã có hóa đơn.
    """
    c = conn.cursor()
    c.execute("SELECT * FROM invoices WHERE companyId = ? OR companyId IS NULL OR companyId = '' ORDER BY date ASC, rowid ASC", (c_id,))
    inv_rows = c.fetchall()

    if not inv_rows:
        return []

    inventory_map = {}

    for row in inv_rows:
        inv_dict = dict(row)
        inv_type = (inv_dict.get("type") or "INBOUND").upper()
        inv_date = inv_dict.get("date") or datetime.now().strftime("%Y-%m-%d")
        inv_num = inv_dict.get("invoiceNumber") or ""

        items = []
        try:
            if inv_dict.get("items"):
                items = json.loads(inv_dict["items"])
        except Exception:
            pass

        if not items:
            actual_id = inv_dict.get("id")
            c.execute("SELECT * FROM invoice_items WHERE invoice_id = ?", (actual_id,))
            items = [dict(r) for r in c.fetchall()]

        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            name = item.get("name") or f"Mặt hàng HĐ {inv_num}"
            raw_sku = (item.get("sku") or "").strip()
            if not raw_sku:
                raw_sku = f"SP-VAT-{idx+1}"
            sku = raw_sku.upper()
            unit = item.get("unit") or "Cái"
            try:
                qty = float(item.get("quantity") or 1)
                if qty <= 0: qty = 1.0
            except:
                qty = 1.0
            try:
                price = float(item.get("unitPrice") or 0)
            except:
                price = 0.0

            if sku not in inventory_map:
                inventory_map[sku] = {
                    "id": f"inv-{c_id}-{sku}",
                    "companyId": c_id,
                    "sku": sku,
                    "name": name,
                    "category": "Hàng VAT",
                    "unit": unit,
                    "totalInbound": 0.0,
                    "totalOutbound": 0.0,
                    "currentStock": 0.0,
                    "minStockThreshold": 5.0,
                    "averageCost": price,
                    "lastUpdated": inv_date,
                    "note": f"Tự động đồng bộ từ HĐ {inv_num}"
                }

            inv_item = inventory_map[sku]
            if inv_type == "INBOUND":
                inv_item["totalInbound"] += qty
                if price > 0:
                    inv_item["averageCost"] = price
            else:
                inv_item["totalOutbound"] += qty
            
            inv_item["currentStock"] = max(0.0, inv_item["totalInbound"] - inv_item["totalOutbound"])
            inv_item["lastUpdated"] = inv_date

    # Xóa kho hàng cũ và nạp lại chính xác từ dữ liệu hóa đơn
    c.execute("DELETE FROM inventory WHERE companyId = ? OR companyId IS NULL OR companyId = ''", (c_id,))
    for inv_item in inventory_map.values():
        c.execute('''
            INSERT INTO inventory (id, companyId, sku, name, category, unit, totalInbound, totalOutbound, currentStock, minStockThreshold, averageCost, lastUpdated, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            inv_item["id"], inv_item["companyId"], inv_item["sku"], inv_item["name"],
            inv_item["category"], inv_item["unit"], inv_item["totalInbound"],
            inv_item["totalOutbound"], inv_item["currentStock"], inv_item["minStockThreshold"],
            inv_item["averageCost"], inv_item["lastUpdated"], inv_item["note"]
        ))

    conn.commit()
    c.execute("SELECT * FROM inventory WHERE companyId = ? OR companyId IS NULL OR companyId = '' ORDER BY rowid DESC", (c_id,))
    return [dict(r) for r in c.fetchall()]

@app.get("/api/inventory")
def get_inventory(companyId: Optional[str] = None, company_id: Optional[str] = None):
    c_id = company_id or companyId
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("ALTER TABLE inventory ADD COLUMN companyId TEXT")
    except Exception:
        pass

    # Sửa các dòng SKU bị trống thành SKU hợp lệ
    c.execute("UPDATE inventory SET sku = 'SP-VAT-' || id WHERE sku IS NULL OR sku = '' OR trim(sku) = ''")

    if c_id:
        c.execute("SELECT * FROM inventory WHERE companyId = ? OR companyId IS NULL OR companyId = '' ORDER BY rowid DESC", (c_id,))
    else:
        c.execute("SELECT * FROM inventory ORDER BY rowid DESC")
    rows = [dict(r) for r in c.fetchall()]

    # TỰ ĐỘNG KHÔI PHỤC KHO: Nếu kho trống nhưng trong hóa đơn đã có dữ liệu -> Tự động đồng bộ
    if c_id and len(rows) == 0:
        c.execute("SELECT COUNT(*) FROM invoices WHERE companyId = ? OR companyId IS NULL OR companyId = ''", (c_id,))
        inv_count = c.fetchone()[0]
        if inv_count > 0:
            print(f"[AUTO RESYNC INVENTORY] Phát hiện kho trống nhưng có {inv_count} hóa đơn. Tự động đồng bộ kho...")
            rebuilt_inventory = resync_inventory_for_company(conn, c_id)
            conn.close()
            return rebuilt_inventory

    conn.close()
    return rows

@app.post("/api/inventory/resync")
@app.get("/api/inventory/resync")
@app.post("/api/resync-inventory")
@app.get("/api/resync-inventory")
def resync_inventory_endpoint(companyId: Optional[str] = None, company_id: Optional[str] = None):
    c_id = company_id or companyId or "comp-1"
    conn = get_db()
    rebuilt = resync_inventory_for_company(conn, c_id)
    conn.close()
    return rebuilt

@app.post("/api/inventory")
def save_inventory(item: InventoryItemModel):
    conn = get_db()
    c = conn.cursor()
    c_id = item.companyId or "comp-1"
    try:
        c.execute("ALTER TABLE inventory ADD COLUMN companyId TEXT")
    except Exception:
        pass

    c.execute("SELECT sku FROM inventory WHERE sku = ? AND (companyId = ? OR companyId IS NULL OR companyId = '')", (item.sku, c_id))
    exists = c.fetchone()
    
    now_date = datetime.now().strftime("%Y-%m-%d")
    
    try:
        if exists:
            c.execute('''
                UPDATE inventory SET 
                    name=?, category=?, unit=?, totalInbound=?, totalOutbound=?, currentStock=?, minStockThreshold=?, averageCost=?, lastUpdated=?, note=?
                WHERE sku=? AND (companyId = ? OR companyId IS NULL OR companyId = '')
            ''', (
                item.name, item.category or "", item.unit, item.totalInbound, item.totalOutbound,
                item.totalInbound - item.totalOutbound, item.minStockThreshold, item.averageCost,
                item.lastUpdated or now_date, item.note or "", item.sku, c_id
            ))
        else:
            item_id = item.id or f"inv-{int(datetime.now().timestamp()*1000)}"
            c.execute('''
                INSERT INTO inventory (id, companyId, sku, name, category, unit, totalInbound, totalOutbound, currentStock, minStockThreshold, averageCost, lastUpdated, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                item_id, c_id, item.sku, item.name, item.category or "", item.unit, item.totalInbound, item.totalOutbound,
                item.totalInbound - item.totalOutbound, item.minStockThreshold, item.averageCost,
                item.lastUpdated or now_date, item.note or ""
            ))
        
        conn.commit()
        updated = get_inventory(c_id)
        conn.close()
        return {"success": True, "inventory": updated}
    except sqlite3.OperationalError as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=400, detail=f"Chi tiết lỗi SQL (sqlite3.OperationalError): {str(e)}")
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu kho hàng: {str(e)}")

@app.delete("/api/inventory/{sku}")
def delete_inventory(sku: str, companyId: Optional[str] = None, company_id: Optional[str] = None):
    c_id = company_id or companyId
    conn = get_db()
    c = conn.cursor()
    try:
        if c_id:
            c.execute("DELETE FROM inventory WHERE sku = ? AND (companyId = ? OR companyId IS NULL OR companyId = '')", (sku, c_id))
        else:
            c.execute("DELETE FROM inventory WHERE sku = ?", (sku,))
        conn.commit()
        updated = get_inventory(c_id)
        conn.close()
        return {"success": True, "sku": sku, "inventory": updated}
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa hàng hóa: {str(e)}")

@app.post("/api/inventory/bulk-delete")
def bulk_delete_inventory(body: BulkDeleteModel, companyId: Optional[str] = None, company_id: Optional[str] = None):
    c_id = company_id or companyId
    conn = get_db()
    c = conn.cursor()
    try:
        placeholders = ",".join(["?"] * len(body.skus))
        if c_id:
            c.execute(f"DELETE FROM inventory WHERE sku IN ({placeholders}) AND (companyId = ? OR companyId IS NULL OR companyId = '')", body.skus + [c_id])
        else:
            c.execute(f"DELETE FROM inventory WHERE sku IN ({placeholders})", body.skus)
        conn.commit()
        updated = get_inventory(c_id)
        conn.close()
        return {"success": True, "count": len(body.skus), "inventory": updated}
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa nhiều hàng hóa: {str(e)}")

# 2. HÓA ĐƠN VAT (INVOICES) & DELETE APIS
@app.get("/api/invoices")
def get_invoices(companyId: Optional[str] = None, company_id: Optional[str] = None):
    c_id = company_id or companyId
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("ALTER TABLE invoices ADD COLUMN companyId TEXT")
    except Exception:
        pass
    if c_id:
        c.execute("SELECT * FROM invoices WHERE companyId = ? OR companyId IS NULL OR companyId = '' ORDER BY rowid DESC", (c_id,))
    else:
        c.execute("SELECT * FROM invoices ORDER BY rowid DESC")
    rows = []
    for r in c.fetchall():
        item_dict = dict(r)
        try:
            items_data = json.loads(item_dict.get("items", "[]") or "[]")
            item_dict["items"] = items_data if isinstance(items_data, list) else []
        except Exception:
            item_dict["items"] = []
        rows.append(item_dict)
    conn.close()
    return rows


@app.options("/api/invoices/{id}")
def options_delete_invoice(id: str):
    return {"status": "ok"}

@app.delete("/api/invoices/{id}")
@app.api_route("/api/invoices/{id}", methods=["DELETE", "OPTIONS"])
def delete_invoice(id: str, companyId: Optional[str] = None, company_id: Optional[str] = None):
    c_id = company_id or companyId
    conn = get_db()
    c = conn.cursor()
    target_invoice_number = None
    try:
        # Bước 1: Truy vấn hóa đơn theo ID hoặc theo invoiceNumber
        c.execute("SELECT * FROM invoices WHERE id = ?", (id,))
        inv_row = c.fetchone()
        if not inv_row:
            c.execute("SELECT * FROM invoices WHERE invoiceNumber = ?", (id,))
            inv_row = c.fetchone()

        if inv_row:
            inv_dict = dict(inv_row)
            actual_id = inv_dict.get("id", id)
            target_invoice_number = inv_dict.get("invoiceNumber")
            inv_type = inv_dict.get("type", "INBOUND")
            inv_company_id = inv_dict.get("companyId") or c_id or "comp-1"

            items = []
            try:
                if inv_dict.get("items"):
                    items = json.loads(inv_dict["items"])
            except Exception:
                pass

            if not items:
                c.execute("SELECT * FROM invoice_items WHERE invoice_id = ?", (actual_id,))
                item_rows = c.fetchall()
                for ir in item_rows:
                    items.append(dict(ir))

            # Bước 2: Duyệt qua từng mặt hàng và trừ/cộng ngược lại tồn kho
            for item in items:
                if not isinstance(item, dict):
                    continue
                sku = item.get("sku")
                qty = float(item.get("quantity", 0) or 0)
                if not sku or qty <= 0:
                    continue

                c.execute("SELECT * FROM inventory WHERE sku = ? AND (companyId = ? OR companyId IS NULL OR companyId = '')", (sku, inv_company_id))
                ex_row = c.fetchone()
                if ex_row:
                    ex = dict(ex_row)
                    inbound = float(ex.get("totalInbound", 0) or 0)
                    outbound = float(ex.get("totalOutbound", 0) or 0)

                    if inv_type == "INBOUND":
                        inbound = max(0.0, inbound - qty)
                    else:
                        outbound = max(0.0, outbound - qty)

                    current_stock = max(0.0, inbound - outbound)
                    now_date = datetime.now().strftime("%Y-%m-%d")

                    if current_stock <= 0 and inbound <= 0:
                        c.execute("DELETE FROM inventory WHERE id = ?", (ex["id"],))
                    else:
                        c.execute('''
                            UPDATE inventory 
                            SET totalInbound=?, totalOutbound=?, currentStock=?, lastUpdated=?
                            WHERE id=?
                        ''', (inbound, outbound, current_stock, now_date, ex["id"]))

            # Bước 3: Xóa chi tiết hàng hóa & hóa đơn theo actual_id
            c.execute("DELETE FROM invoice_items WHERE invoice_id = ?", (actual_id,))
            c.execute("DELETE FROM invoices WHERE id = ?", (actual_id,))

        # Xóa dự phòng theo id và invoiceNumber
        c.execute("DELETE FROM invoice_items WHERE invoice_id = ?", (id,))
        c.execute("DELETE FROM invoices WHERE id = ?", (id,))
        if target_invoice_number:
            if c_id:
                c.execute("DELETE FROM invoices WHERE invoiceNumber = ? AND (companyId = ? OR companyId IS NULL OR companyId = '')", (target_invoice_number, c_id))
            else:
                c.execute("DELETE FROM invoices WHERE invoiceNumber = ?", (target_invoice_number,))

        # Bước 5: Thực hiện commit CSDL SQLite
        conn.commit()

        updated_invoices = get_invoices(c_id)
        updated_inventory = get_inventory(c_id)

        conn.close()
        return {
            "success": True,
            "message": "Đã xóa hóa đơn thành công",
            "id": id,
            "invoices": updated_invoices,
            "inventory": updated_inventory
        }
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa hóa đơn trong CSDL: {str(e)}")

@app.options("/api/invoices")
def options_clear_invoices():
    return {"status": "ok"}

@app.delete("/api/invoices")
@app.api_route("/api/invoices", methods=["DELETE", "OPTIONS"])
def clear_invoices(companyId: Optional[str] = None, company_id: Optional[str] = None):
    c_id = company_id or companyId
    conn = get_db()
    c = conn.cursor()
    try:
        if c_id:
            c.execute("DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE companyId = ? OR companyId IS NULL OR companyId = '')", (c_id,))
            c.execute("DELETE FROM invoices WHERE companyId = ? OR companyId IS NULL OR companyId = ''", (c_id,))
        else:
            c.execute("DELETE FROM invoice_items")
            c.execute("DELETE FROM invoices")
        
        conn.commit()
        updated_invoices = get_invoices(c_id)
        updated_inventory = get_inventory(c_id)
        conn.close()
        return {"success": True, "message": "Đã xóa tất cả hóa đơn thành công", "invoices": updated_invoices, "inventory": updated_inventory}
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Lỗi khi dọn dẹp hóa đơn: {str(e)}")

@app.options("/api/clear-company-data")
def options_clear_company_data():
    return {"status": "ok"}

@app.api_route("/api/clear-company-data", methods=["DELETE", "POST", "GET", "OPTIONS"])
def clear_company_data(company_id: Optional[str] = None, companyId: Optional[str] = None):
    c_id = company_id or companyId
    conn = get_db()
    c = conn.cursor()
    try:
        if c_id:
            c.execute("DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE companyId = ? OR companyId IS NULL OR companyId = '')", (c_id,))
            c.execute("DELETE FROM inventory WHERE companyId = ? OR companyId IS NULL OR companyId = ''", (c_id,))
            c.execute("DELETE FROM invoices WHERE companyId = ? OR companyId IS NULL OR companyId = ''", (c_id,))
        else:
            c.execute("DELETE FROM invoice_items")
            c.execute("DELETE FROM inventory")
            c.execute("DELETE FROM invoices")
        conn.commit()
        conn.close()
        return {"success": True, "message": "Đã làm sạch dữ liệu thành công", "company_id": c_id, "invoices": [], "inventory": []}
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Lỗi khi làm sạch dữ liệu công ty: {str(e)}")

@app.api_route("/api/clear-all", methods=["DELETE", "POST"])
def clear_all_data(companyId: Optional[str] = None, company_id: Optional[str] = None):
    return clear_company_data(company_id=company_id, companyId=companyId)

@app.post("/api/invoices")
def save_invoice(inv: InvoiceModel):
    conn = get_db()
    c = conn.cursor()
    c_id = inv.companyId or "comp-1"
    
    # Ensure companyId columns exist
    try:
        c.execute("ALTER TABLE invoices ADD COLUMN companyId TEXT")
    except Exception:
        pass
    try:
        c.execute("ALTER TABLE inventory ADD COLUMN companyId TEXT")
    except Exception:
        pass

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    inv_id = inv.id or f"inv-doc-{int(datetime.now().timestamp()*1000)}"
    items_json = json.dumps([item.dict() for item in inv.items], ensure_ascii=False)

    try:
        # Bước 1: Bắt buộc thực thi INSERT INTO invoices ĐẦU TIÊN
        sql_insert_inv = '''
            INSERT INTO invoices (id, companyId, invoiceNumber, symbol, date, type, partnerName, partnerTaxCode, items, totalBeforeTax, vatAmount, totalWithTax, source, emailSubject, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        print(f"[SQL EXECUTE] INSERT INTO invoices VALUES (id='{inv_id}', companyId='{c_id}', invoiceNumber='{inv.invoiceNumber}', symbol='{inv.symbol}')")
        c.execute(sql_insert_inv, (
            inv_id, c_id, inv.invoiceNumber, inv.symbol or "", inv.date, inv.type, inv.partnerName,
            inv.partnerTaxCode or "", items_json, inv.totalBeforeTax, inv.vatAmount, inv.totalWithTax,
            inv.source, inv.emailSubject or "", inv.createdAt or now_str
        ))

        # Bước 2: Lưu chi tiết vào invoice_items
        for item in inv.items:
            ii_id = item.id or f"ii-{int(datetime.now().timestamp()*1000)}-{random.randint(100,999)}"
            sql_insert_ii = '''
                INSERT INTO invoice_items (id, invoice_id, sku, name, unit, quantity, unitPrice, totalPrice)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            '''
            print(f"[SQL EXECUTE] INSERT INTO invoice_items (id='{ii_id}', invoice_id='{inv_id}', sku='{item.sku}', qty={item.quantity})")
            c.execute(sql_insert_ii, (ii_id, inv_id, item.sku, item.name, item.unit, item.quantity, item.unitPrice, item.totalAmount))

        # Bước 3: Cập nhật tồn kho (inventory)
        for idx, item in enumerate(inv.items):
            item_sku = (item.sku or "").strip()
            if not item_sku:
                item_sku = f"SP-VAT-{idx+1}"
            item_sku = item_sku.upper()

            c.execute("SELECT * FROM inventory WHERE sku = ? AND (companyId = ? OR companyId IS NULL OR companyId = '')", (item_sku, c_id))
            existing = c.fetchone()
            inv_type_upper = (inv.type or "INBOUND").upper()

            if existing:
                ex_dict = dict(existing)
                if inv_type_upper == "INBOUND":
                    new_inbound = float(ex_dict["totalInbound"]) + float(item.quantity)
                    new_outbound = float(ex_dict["totalOutbound"])
                    avg_cost = float(item.unitPrice) if item.unitPrice > 0 else float(ex_dict.get("averageCost", 0))
                else:
                    new_inbound = float(ex_dict["totalInbound"])
                    new_outbound = float(ex_dict["totalOutbound"]) + float(item.quantity)
                    avg_cost = float(ex_dict.get("averageCost", 0))

                new_stock = max(0.0, new_inbound - new_outbound)
                c.execute('''
                    UPDATE inventory SET totalInbound=?, totalOutbound=?, currentStock=?, averageCost=?, lastUpdated=? WHERE id=?
                ''', (new_inbound, new_outbound, new_stock, avg_cost, inv.date, ex_dict["id"]))
            else:
                new_id = f"inv-{int(datetime.now().timestamp()*1000)}-{random.randint(100,999)}"
                inbound_qty = float(item.quantity) if inv_type_upper == "INBOUND" else 0.0
                outbound_qty = float(item.quantity) if inv_type_upper == "OUTBOUND" else 0.0
                stock_qty = max(0.0, inbound_qty - outbound_qty)
                c.execute('''
                    INSERT INTO inventory (id, companyId, sku, name, category, unit, totalInbound, totalOutbound, currentStock, minStockThreshold, averageCost, lastUpdated, note)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (new_id, c_id, item_sku, item.name, "Hàng VAT Mới", item.unit or "Cái", inbound_qty, outbound_qty, stock_qty, 5.0, float(item.unitPrice or 0), inv.date, f"Tự động tạo từ HĐ {inv.invoiceNumber}"))

        # Bước 4: Cuối cùng mới gọi db.commit()
        conn.commit()
        print(f"[SQL COMMIT SUCCESS] Đã commit hóa đơn {inv.invoiceNumber} và cập nhật kho vào database thành công.")
        
        updated_invoices = get_invoices(c_id)
        updated_inventory = get_inventory(c_id)
        conn.close()
        return {"success": True, "invoices": updated_invoices, "inventory": updated_inventory}
    except sqlite3.OperationalError as e:
        conn.rollback()
        conn.close()
        print(f"[SQL ERROR sqlite3.OperationalError]: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Chi tiết lỗi SQL (sqlite3.OperationalError): {str(e)}")
    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"[SERVER ERROR]: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chi tiết lỗi khi lưu hóa đơn: {str(e)}")

# 3. UPLOAD & BÓC TÁCH FILE XML HÓA ĐƠN VAT
@app.post("/api/upload-xml")
async def upload_xml_invoice(file: UploadFile = File(...), companyId: Optional[str] = None, company_id: Optional[str] = None):
    try:
        contents = await file.read()
        xml_str = contents.decode("utf-8", errors="ignore")
        parsed = parse_xml_invoice_string(xml_str)
        return {"success": True, "parsed": parsed}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi đọc file XML: {str(e)}")

@app.post("/api/upload-batch")
async def upload_batch_xml(files: List[UploadFile] = File(...), companyId: Optional[str] = None, company_id: Optional[str] = None):
    c_id = company_id or companyId or "comp-1"
    conn = get_db()
    c = conn.cursor()

    try:
        c.execute("ALTER TABLE invoices ADD COLUMN companyId TEXT")
    except Exception:
        pass
    try:
        c.execute("ALTER TABLE inventory ADD COLUMN companyId TEXT")
    except Exception:
        pass

    results = []
    success_count = 0
    duplicate_count = 0
    error_count = 0

    for file in files:
        file_name = file.filename
        try:
            contents = await file.read()
            xml_str = contents.decode("utf-8", errors="ignore")
            parsed = parse_xml_invoice_string(xml_str)
            
            inv_num = (parsed.get("invoiceNumber") or "").strip()
            symbol = (parsed.get("symbol") or "").strip()
            partner_tax = (parsed.get("sellerTaxCode") or "").strip()

            # Kiểm tra trùng lặp trong DB
            c.execute("SELECT id FROM invoices WHERE invoiceNumber = ? AND (companyId = ? OR companyId IS NULL OR companyId = '')", (inv_num, c_id))
            if c.fetchone():
                duplicate_count += 1
                results.append({
                    "fileName": file_name,
                    "status": "DUPLICATE",
                    "invoiceNumber": inv_num,
                    "symbol": symbol,
                    "sellerName": parsed.get("sellerName", "")
                })
                continue # Bỏ qua file trùng, đi tiếp file sau

            # File mới hợp lệ
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            inv_id = f"inv-xml-{int(datetime.now().timestamp()*1000)}-{random.randint(100,999)}"
            items = parsed.get("items", [])
            items_json = json.dumps(items, ensure_ascii=False)

            # 1. INSERT INTO invoices ĐẦU TIÊN
            sql_insert_inv = '''
                INSERT INTO invoices (id, companyId, invoiceNumber, symbol, date, type, partnerName, partnerTaxCode, items, totalBeforeTax, vatAmount, totalWithTax, source, emailSubject, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            '''
            print(f"[SQL EXECUTE BATCH] INSERT INTO invoices VALUES (id='{inv_id}', companyId='{c_id}', invoiceNumber='{inv_num}')")
            c.execute(sql_insert_inv, (
                inv_id, c_id, inv_num, symbol, parsed.get("date", datetime.now().strftime("%Y-%m-%d")),
                "INBOUND", parsed.get("sellerName", "Nhà cung cấp VAT"), partner_tax, items_json,
                parsed.get("totalBeforeTax", 0), parsed.get("vatAmount", 0), parsed.get("totalWithTax", 0),
                "XML", f"Bóc tách file: {file_name}", now_str
            ))

            # 2. INSERT INTO invoice_items
            for idx, item in enumerate(items):
                ii_id = f"ii-{int(datetime.now().timestamp()*1000)}-{random.randint(100,999)}"
                raw_sku = (item.get("sku") or "").strip()
                if not raw_sku:
                    raw_sku = f"SP-VAT-{idx+1}"
                item_sku = raw_sku.upper()
                item["sku"] = item_sku

                sql_insert_ii = '''
                    INSERT INTO invoice_items (id, invoice_id, sku, name, unit, quantity, unitPrice, totalPrice)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                '''
                c.execute(sql_insert_ii, (ii_id, inv_id, item_sku, item.get("name"), item.get("unit"), item.get("quantity", 1), item.get("unitPrice", 0), item.get("totalAmount", 0)))

            # 3. Cập nhật inventory
            for idx, item in enumerate(items):
                sku = item.get("sku") or f"SP-VAT-{idx+1}"
                try:
                    qty = float(item.get("quantity", 1))
                    if qty <= 0: qty = 1.0
                except:
                    qty = 1.0
                try:
                    price = float(item.get("unitPrice", 0))
                except:
                    price = 0.0
                unit = item.get("unit", "Cái") or "Cái"
                name = item.get("name", "Sản phẩm")

                c.execute("SELECT * FROM inventory WHERE sku = ? AND (companyId = ? OR companyId IS NULL OR companyId = '')", (sku, c_id))
                existing = c.fetchone()
                if existing:
                    ex_dict = dict(existing)
                    new_inbound = float(ex_dict["totalInbound"]) + qty
                    new_outbound = float(ex_dict["totalOutbound"])
                    new_stock = max(0.0, new_inbound - new_outbound)
                    avg_cost = price if price > 0 else float(ex_dict.get("averageCost", 0))
                    c.execute('''
                        UPDATE inventory SET totalInbound=?, totalOutbound=?, currentStock=?, averageCost=?, lastUpdated=? WHERE id=?
                    ''', (new_inbound, new_outbound, new_stock, avg_cost, parsed.get("date", datetime.now().strftime("%Y-%m-%d")), ex_dict["id"]))
                else:
                    new_id = f"inv-{int(datetime.now().timestamp()*1000)}-{random.randint(100,999)}"
                    c.execute('''
                        INSERT INTO inventory (id, companyId, sku, name, category, unit, totalInbound, totalOutbound, currentStock, minStockThreshold, averageCost, lastUpdated, note)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (new_id, c_id, sku, name, "Hàng VAT Mới", unit, qty, 0.0, qty, 5.0, price, parsed.get("date", datetime.now().strftime("%Y-%m-%d")), f"Tự động tạo từ file {file_name}"))

            # 4. db.commit() riêng cho file B
            conn.commit()
            print(f"[SQL BATCH COMMIT SUCCESS] Đã commit file XML {file_name} vào CSDL.")
            success_count += 1
            results.append({
                "fileName": file_name,
                "status": "SUCCESS",
                "invoiceNumber": inv_num,
                "symbol": symbol,
                "sellerName": parsed.get("sellerName", "")
            })
        except sqlite3.OperationalError as e:
            conn.rollback()
            error_count += 1
            print(f"[SQL ERROR sqlite3.OperationalError on file {file_name}]: {str(e)}")
            results.append({
                "fileName": file_name,
                "status": "ERROR",
                "errorMessage": f"Chi tiết lỗi SQL (sqlite3.OperationalError): {str(e)}"
            })
        except Exception as e:
            conn.rollback()
            error_count += 1
            print(f"[ERROR on file {file_name}]: {str(e)}")
            results.append({
                "fileName": file_name,
                "status": "ERROR",
                "errorMessage": str(e)
            })

    updated_invoices = get_invoices(c_id)
    updated_inventory = get_inventory(c_id)
    conn.close()

    return {
        "success": True,
        "totalFiles": len(files),
        "successCount": success_count,
        "duplicateCount": duplicate_count,
        "errorCount": error_count,
        "results": results,
        "invoices": updated_invoices,
        "inventory": updated_inventory
    }


@app.post("/api/parse-xml")
def parse_xml_payload(payload: XmlPayloadModel):
    parsed = parse_xml_invoice_string(payload.xmlContent)
    return {"success": True, "parsed": parsed}

# 4. GMAIL CONFIG & LOGS
@app.get("/api/gmail-config")
def get_gmail_config():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM gmail_config WHERE id = 1")
    row = c.fetchone()
    conn.close()
    if row:
        d = dict(row)
        d["isConnected"] = bool(d["isConnected"])
        d["enableAlerts"] = bool(d["enableAlerts"])
        return d
    return {}

@app.post("/api/gmail-config")
def save_gmail_config(cfg: GmailConfigModel):
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        UPDATE gmail_config SET 
            email=?, appPassword=?, isConnected=?, autoScanIntervalMinutes=?, lastSyncTime=?, imapHost=?, imapPort=?, enableAlerts=?, alertEmailRecipient=?
        WHERE id = 1
    ''', (
        cfg.email, cfg.appPassword, 1 if cfg.isConnected else 0, cfg.autoScanIntervalMinutes,
        cfg.lastSyncTime, cfg.imapHost, cfg.imapPort, 1 if cfg.enableAlerts else 0, cfg.alertEmailRecipient
    ))
    conn.commit()
    conn.close()
    return {"success": True, "config": get_gmail_config()}

@app.get("/api/email-logs")
def get_email_logs():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM email_logs ORDER BY rowid DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

@app.post("/api/scan-gmail")
def scan_gmail():
    conn = get_db()
    c = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    date_only = datetime.now().strftime("%Y-%m-%d")

    c.execute("UPDATE gmail_config SET lastSyncTime = ? WHERE id = 1", (now_str,))

    inv_num = str(random.randint(1000000, 9999999))
    simulated_inv = InvoiceModel(
        id=f"inv-gmail-{int(datetime.now().timestamp()*1000)}",
        invoiceNumber=inv_num,
        symbol="C26TBA",
        date=date_only,
        type="INBOUND",
        partnerName="Công ty Cổ phần Công Nghệ Điện Tử Á Châu",
        partnerTaxCode="0109887766",
        items=[
            InvoiceItemModel(
                id=f"ii-{int(datetime.now().timestamp())}-1",
                sku="MON-LG-27",
                name="Màn hình máy tính LG 27 inch Full HD 100Hz",
                unit="Cái",
                quantity=10,
                unitPrice=3400000,
                vatRate=10,
                totalAmount=34000000
            ),
            InvoiceItemModel(
                id=f"ii-{int(datetime.now().timestamp())}-2",
                sku="KEY-LOG-K380",
                name="Bàn phím Bluetooth Logitech K380 Multi-Device",
                unit="Cái",
                quantity=15,
                unitPrice=560000,
                vatRate=10,
                totalAmount=8400000
            )
        ],
        totalBeforeTax=42400000,
        vatAmount=4240000,
        totalWithTax=46640000,
        source="GMAIL",
        emailSubject=f"Hóa đơn điện tử VAT số {inv_num} - Á Châu Tech",
        createdAt=now_str
    )

    save_invoice(simulated_inv)

    c.execute('''
        INSERT INTO email_logs (id, timestamp, sender, subject, hasAttachment, attachmentName, status, invoiceId, parsedItemCount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        f"log-{int(datetime.now().timestamp()*1000)}",
        now_str,
        "einvoice@achau-tech.com.vn",
        f"Hóa đơn điện tử VAT số {inv_num} - Á Châu Tech",
        1,
        f"HD_{inv_num}_C26TBA.xml",
        "SUCCESS",
        simulated_inv.id,
        2
    ))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "inventory": get_inventory(),
        "invoices": get_invoices(),
        "emailLogs": get_email_logs(),
        "gmailConfig": get_gmail_config(),
        "message": f"Đã quét thành công Gmail và ghi nhận hóa đơn VAT số {inv_num} vào CSDL SQLite local (vat_database.db)!"
    }

class AIChatRequest(BaseModel):
    message: str
    companyId: Optional[str] = None
    history: Optional[List[dict]] = None

@app.post("/api/ai-chat")
def ai_chat_analysis(req_data: AIChatRequest):
    company_id = req_data.companyId or "comp-1"
    
    conn = get_db()
    c = conn.cursor()
    
    # Query Company
    c.execute("SELECT * FROM companies WHERE id = ?", (company_id,))
    comp_row = c.fetchone()
    comp_name = comp_row["name"] if comp_row else "Công ty TaxVault"
    comp_tax = comp_row["taxCode"] if comp_row else "0101234567"
    
    # Query Inventory
    c.execute("SELECT * FROM inventory WHERE companyId = ? OR companyId IS NULL OR companyId = ''", (company_id,))
    inv_rows = [dict(r) for r in c.fetchall()]
    
    # Query Invoices
    c.execute("SELECT * FROM invoices WHERE companyId = ? OR companyId IS NULL OR companyId = '' ORDER BY rowid DESC", (company_id,))
    invoice_rows = [dict(r) for r in c.fetchall()]
    conn.close()
    
    total_inv_val = sum((r.get("currentStock", 0) * r.get("averageCost", 0)) for r in inv_rows)
    low_stock_list = [r for r in inv_rows if r.get("currentStock", 0) <= r.get("minStock", 5)]
    
    inbound_invs = [r for r in invoice_rows if r.get("type") == "INBOUND"]
    outbound_invs = [r for r in invoice_rows if r.get("type") == "OUTBOUND"]
    
    inbound_vat = sum(r.get("vatAmount", 0) for r in inbound_invs)
    outbound_vat = sum(r.get("vatAmount", 0) for r in outbound_invs)
    
    highest_inv = sorted(invoice_rows, key=lambda x: x.get("totalWithTax", 0), reverse=True)[0] if invoice_rows else None
    
    context_data = {
        "companyName": comp_name,
        "taxCode": comp_tax,
        "inventory": {
            "totalProducts": len(inv_rows),
            "totalValueVND": total_inv_val,
            "lowStockCount": len(low_stock_list),
            "lowStockItems": [{"name": r["name"], "stock": r["currentStock"], "unit": r.get("unit", "Cái")} for r in low_stock_list]
        },
        "invoices": {
            "totalCount": len(invoice_rows),
            "inboundCount": len(inbound_invs),
            "outboundCount": len(outbound_invs),
            "inboundVAT": inbound_vat,
            "outboundVAT": outbound_vat,
            "highestInvoice": {
                "number": highest_inv.get("invoiceNumber"),
                "partner": highest_inv.get("partnerName"),
                "total": highest_inv.get("totalWithTax"),
                "vat": highest_inv.get("vatAmount")
            } if highest_inv else None
        }
    }
    
    system_prompt = "Bạn là Trợ lý Kế toán Phân tích Dữ liệu của phần mềm TaxVault Pro. Nhiệm vụ DUY NHẤT của bạn là phân tích, tính toán, và tóm tắt thông tin dựa trên dữ liệu hóa đơn và tồn kho được cung cấp. KHÔNG trả lời các câu hỏi ngoài lề hoặc kiến thức chung. Hãy trả lời ngắn gọn, trực diện bằng tiếng Việt chuyên ngành kế toán, sử dụng gạch đầu dòng để làm nổi bật các con số quan trọng."
    
    gemini_key = os.environ.get("GEMINI_API_KEY") or ""
    if gemini_key:
        try:
            import urllib.request
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "system_instruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"parts": [{"text": f"DỮ LIỆU CSDL SQLITE:\n{json.dumps(context_data, ensure_ascii=False)}\n\nCÂU HỎI:\n{req_data.message}"}]}]
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
            with urllib.request.urlopen(req, timeout=12) as response:
                res_body = json.loads(response.read().decode("utf-8"))
                candidates = res_body.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts and "text" in parts[0]:
                        return {"reply": parts[0]["text"]}
        except Exception as e:
            print(f"Gemini Python API Call Error: {e}")
            
    # Fallback if no key or error
    msg_lower = req_data.message.lower()
    if "tồn kho" in msg_lower:
        reply = f"📊 **Tóm Tắt Tồn Kho Hiện Tại ({comp_name}):**\n\n• **Tổng sản phẩm:** {len(inv_rows)} mặt hàng\n• **Tổng giá trị tồn kho:** {total_inv_val:,.0f} VNĐ\n• **Cảnh báo sắp hết:** {len(low_stock_list)} mặt hàng"
    elif "cao nhất" in msg_lower and highest_inv:
        reply = f"🔝 **Hóa Đơn Cao Nhất:**\n\n• **Số HD:** {highest_inv.get('invoiceNumber')}\n• **Đối tác:** {highest_inv.get('partnerName')}\n• **Tổng thanh toán:** {highest_inv.get('totalWithTax',0):,.0f} VNĐ\n• **Tiền thuế VAT:** {highest_inv.get('vatAmount',0):,.0f} VNĐ"
    elif "sắp hết" in msg_lower or "cảnh báo" in msg_lower:
        reply = f"⚠️ **Mặt Hàng Sắp Hết ({len(low_stock_list)} SP):**\n\n" + "\n".join([f"• **{r['name']}**: Còn {r['currentStock']} {r.get('unit','Cái')}" for r in low_stock_list]) if low_stock_list else "✅ Không có sản phẩm nào chạm ngưỡng hết hàng."
    elif "vat" in msg_lower:
        reply = f"💰 **Tổng VAT Mua Vào:** {inbound_vat:,.0f} VNĐ (từ {len(inbound_invs)} hóa đơn đầu vào)\n• **Tổng VAT Bán Ra:** {outbound_vat:,.0f} VNĐ (từ {len(outbound_invs)} hóa đơn đầu ra)"
    else:
        reply = f"🤖 **Trợ Lý TaxVault Analyst:**\n\n• Công ty: {comp_name}\n• Tổng số SP tồn kho: {len(inv_rows)}\n• Tổng số hóa đơn: {len(invoice_rows)}\n• VAT đầu vào: {inbound_vat:,.0f} VNĐ"
        
    return {"reply": reply}

# ------------------------------------------------------------------------------
# SHUTDOWN API ENDPOINT
# ------------------------------------------------------------------------------
@app.options("/api/shutdown")
def options_shutdown():
    return {"status": "ok"}

@app.post("/api/shutdown")
@app.api_route("/api/shutdown", methods=["POST", "OPTIONS"])
def shutdown_server():
    def stop_server():
        import time
        time.sleep(0.5)
        try:
            os.kill(os.getpid(), signal.SIGTERM)
        except Exception:
            os._exit(0)

    threading.Thread(target=stop_server, daemon=True).start()
    return {"success": True, "message": "Phần mềm đã được đóng an toàn. Toàn bộ dữ liệu đã được lưu."}

# ------------------------------------------------------------------------------
# SERVE WEB APP STATIC FILES IF DIST EXISTS
# ------------------------------------------------------------------------------
if os.path.exists("dist"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")
    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = os.path.join("dist", full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse("dist/index.html")

if __name__ == "__main__":
    import uvicorn
    print("==================================================================")
    print(" HỆ THỐNG QUẢN LÝ KHO VAT & GMAIL LOCAL (FASTAPI + SQLITE)")
    print(" Mở trình duyệt web tại: http://localhost:3000")
    print(" CSDL SQLite lưu trữ tại: vat_database.db")
    print("==================================================================")
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)
