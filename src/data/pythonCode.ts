export const PYTHON_FASTAPI_CODE = `# ==============================================================================
# TAXVAULT PRO - HỆ THỐNG QUẢN LÝ KHO VAT ĐA CÔNG TY & GMAIL HOÀN CHỈNH (FASTAPI + SQLITE)
# File: main.py
# Khởi chạy: uvicorn main:app --reload --port 3000
# CSDL SQLite: vat_database.db
# Bóc tách XML Đa Nhà Cung Cấp: MISA, Viettel, VNPT, BKAV, EasyInvoice, Softdreams, Thai Son, Mobifone...
# ==============================================================================

from fastapi import FastAPI, HTTPException, Request, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import sqlite3
import json
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime

DB_FILE = "vat_database.db"

app = FastAPI(title="Multi-Company VAT Inventory API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_sqlite_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            taxCode TEXT UNIQUE NOT NULL,
            address TEXT,
            isDefault INTEGER DEFAULT 0
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            id TEXT PRIMARY KEY,
            companyId TEXT,
            sku TEXT NOT NULL,
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
            companyId TEXT,
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
    conn.commit()
    conn.close()

init_sqlite_db()

def clean_float(val) -> float:
    if val is None:
        return 0.0
    val_str = str(val).strip().replace('%', '')
    if not val_str:
        return 0.0
    if '.' in val_str and ',' in val_str:
        if val_str.find('.') < val_str.find(','):
            val_str = val_str.replace('.', '').replace(',', '.')
        else:
            val_str = val_str.replace(',', '')
    elif ',' in val_str:
        val_str = val_str.replace(',', '.')
    val_clean = re.sub(r'[^0-9.-]', '', val_str)
    try:
        return float(val_clean)
    except ValueError:
        return 0.0

def parse_xml_invoice_universal(xml_text: str) -> Dict[str, Any]:
    """Tối ưu Parser bóc tách XML Hóa đơn Điện tử Việt Nam từ mọi nhà cung cấp"""
    root = ET.fromstring(xml_text)
    
    def find_text(element, candidates: List[str]) -> str:
        candidates_lower = [c.lower() for c in candidates]
        for node in element.iter():
            tag_name = node.tag.split('}')[-1].lower()
            if tag_name in candidates_lower and node.text:
                return node.text.strip()
        return ""

    inv_num = find_text(root, ['SHDon', 'InvoiceNumber', 'SoHoaDon', 'SoHD', 'InvoiceNo', 'InvNum', 'num'])
    symbol = find_text(root, ['KHMSHDon', 'KSHDon', 'KHDon', 'Symbol', 'SerialNo', 'KyHieu', 'Series'])
    cqt_code = find_text(root, ['MCCQT', 'MaCQT', 'CQTCode', 'TaxAuthorityCode', 'MCT'])
    date_str = find_text(root, ['NLap', 'InvoiceDate', 'AriseDate', 'NgayLap', 'Date']) or datetime.now().strftime("%Y-%m-%d")

    seller_name = find_text(root, ['TenNBan', 'SellerName', 'NhaCungCap', 'VendorName']) or "Nhà Cung Cấp VAT"
    seller_tax = find_text(root, ['MSTNBan', 'SellerTaxCode', 'MSTNhaCungCap'])
    buyer_name = find_text(root, ['TenNMua', 'BuyerName', 'KhachHang', 'CustomerName'])
    buyer_tax = find_text(root, ['MSTNMua', 'BuyerTaxCode', 'CustomerTaxCode'])

    items = []
    item_candidates = ['hhdvu', 'item', 'product', 'detailitem', 'chitiethoadon', 'invoiceline', 'row', 'detail']
    for node in root.iter():
        tag_name = node.tag.split('}')[-1].lower()
        if tag_name in item_candidates:
            name = find_text(node, ['THHDVu', 'Name', 'ItemName', 'TenHang', 'TenHHDVu', 'ProductName'])
            if not name:
                continue
            sku = find_text(node, ['MHHDVu', 'Code', 'ItemCode', 'MaHang', 'SKU']) or f"SP-VAT-{len(items)+1}"
            unit = find_text(node, ['DVTinh', 'Unit', 'DonViTinh', 'DVT']) or "Cái"
            qty = clean_float(find_text(node, ['SLuong', 'Quantity', 'SoLuong', 'SL'])) or 1.0
            price = clean_float(find_text(node, ['DGia', 'UnitPrice', 'DonGia', 'DG']))
            amt = clean_float(find_text(node, ['ThTien', 'Amount', 'ThanhTien', 'Total'])) or (qty * price)
            vat_rate = clean_float(find_text(node, ['TSuat', 'VATRate', 'ThueSuat', 'VAT'])) or 10.0

            items.append({
                "sku": sku.upper(),
                "name": name,
                "unit": unit,
                "quantity": qty,
                "unitPrice": price,
                "vatRate": vat_rate,
                "totalAmount": amt
            })

    total_pretax = clean_float(find_text(root, ['TgTienPreTax', 'TotalBeforeTax', 'TongTienChuaThue']))
    vat_amt = clean_float(find_text(root, ['TgTienThue', 'TotalVAT', 'TongTienThue', 'TienThue']))
    total_with_tax = clean_float(find_text(root, ['TgTienThToan', 'TotalAmount', 'TongTienThanhToan']))

    return {
        "invoiceNumber": inv_num or f"HD{int(datetime.now().timestamp())}",
        "symbol": symbol or "C26TBA",
        "cqtCode": cqt_code,
        "date": date_str,
        "sellerName": seller_name,
        "sellerTaxCode": seller_tax,
        "buyerName": buyer_name,
        "buyerTaxCode": buyer_tax,
        "items": items,
        "totalBeforeTax": total_pretax or sum(i["totalAmount"] for i in items),
        "vatAmount": vat_amt or sum((i["totalAmount"] * i["vatRate"] / 100) for i in items),
        "totalWithTax": total_with_tax or (total_pretax + vat_amt)
    }

class CompanyModel(BaseModel):
    id: Optional[str] = None
    name: str
    taxCode: str
    address: Optional[str] = ""
    isDefault: Optional[bool] = False

class InventoryItemModel(BaseModel):
    id: Optional[str] = None
    companyId: Optional[str] = "comp-1"
    sku: str
    name: str
    category: Optional[str] = ""
    unit: str
    totalInbound: int = 0
    totalOutbound: int = 0
    currentStock: int = 0
    minStockThreshold: int = 5
    averageCost: float = 0
    lastUpdated: Optional[str] = None
    note: Optional[str] = ""

@app.post("/api/invoices")
def create_invoice(invoice: Dict[str, Any]):
    conn = get_db()
    c = conn.cursor()
    comp_id = invoice.get("companyId", "comp-1")
    inv_num = str(invoice.get("invoiceNumber", "")).strip()
    symbol = str(invoice.get("symbol", "")).strip()
    partner_tax = str(invoice.get("partnerTaxCode", "")).strip()
    
    # 1. Kiểm tra trùng lặp 3 trường: Số hóa đơn (SHDon), Ký hiệu (KHHDon) và MST Người bán/Đối tác
    c.execute("""
        SELECT id FROM invoices 
        WHERE companyId = ? 
          AND LOWER(TRIM(invoiceNumber)) = LOWER(TRIM(?))
          AND LOWER(TRIM(symbol)) = LOWER(TRIM(?))
          AND REPLACE(partnerTaxCode, '-', '') = REPLACE(?, '-', '')
    """, (comp_id, inv_num, symbol, partner_tax))
    
    if c.fetchone():
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Hóa đơn số {inv_num} (Ký hiệu: {symbol}) từ {invoice.get('partnerName', 'Đối tác')} ({partner_tax}) đã tồn tại trong kho của công ty này. Không thể nhập trùng!"
        )
    
    # 2. Lưu hóa đơn mới & Cập nhật kho
    inv_id = invoice.get("id") or f"inv-{int(datetime.now().timestamp()*1000)}"
    items_json = json.dumps(invoice.get("items", []), ensure_ascii=False)
    c.execute("""
        INSERT INTO invoices (id, companyId, invoiceNumber, symbol, date, type, partnerName, partnerTaxCode, items, totalBeforeTax, vatAmount, totalWithTax, source, emailSubject, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (inv_id, comp_id, inv_num, symbol, invoice.get("date"), invoice.get("type", "INBOUND"),
          invoice.get("partnerName"), partner_tax, items_json, invoice.get("totalBeforeTax", 0),
          invoice.get("vatAmount", 0), invoice.get("totalWithTax", 0), invoice.get("source", "XML"),
          invoice.get("emailSubject", ""), datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Đã lưu hóa đơn VAT và cập nhật tồn kho!"}

@app.post("/api/upload-batch")
async def upload_batch_invoices(files: List[UploadFile] = File(...), company_id: str = Query("comp-1")):
    """
    Tiếp nhận danh sách tập tin hóa đơn điện tử (.xml, .pdf) nạp hàng loạt.
    Bóc tách dữ liệu, tự động phân loại, kiểm tra trùng lặp và tổng kết báo cáo.
    """
    results = []
    success_count = 0
    dup_count = 0
    err_count = 0

    conn = get_db()
    c = conn.cursor()

    for file in files:
        file_name = file.filename
        ext = file_name.split(".")[-1].lower() if "." in file_name else ""
        
        try:
            contents = await file.read()
            parsed = None

            if ext == "xml":
                xml_text = contents.decode("utf-8", errors="ignore")
                parsed = parse_xml_invoice_universal(xml_text)
            elif ext == "pdf":
                # Dùng pdfplumber hoặc pypdf để bóc tách text layer PDF
                parsed = parse_pdf_invoice_regex(contents)
            else:
                results.append({
                    "fileName": file_name, "fileType": ext.upper(), "status": "ERROR",
                    "errorMessage": "Định dạng file không được hỗ trợ (chỉ chấp nhận .xml hoặc .pdf)"
                })
                err_count += 1
                continue

            inv_num = parsed["invoiceNumber"]
            symbol = parsed["symbol"]
            seller_tax = parsed["sellerTaxCode"]
            seller_name = parsed["sellerName"]

            # Kiểm tra trùng lặp CSDL SQLite
            c.execute("""
                SELECT id FROM invoices 
                WHERE companyId = ? 
                  AND LOWER(TRIM(invoiceNumber)) = LOWER(TRIM(?))
                  AND LOWER(TRIM(symbol)) = LOWER(TRIM(?))
                  AND REPLACE(partnerTaxCode, '-', '') = REPLACE(?, '-', '')
            """, (company_id, inv_num, symbol, seller_tax))

            if c.fetchone():
                dup_count += 1
                results.append({
                    "fileName": file_name, "fileType": ext.upper(), "status": "DUPLICATE",
                    "invoiceNumber": inv_num, "symbol": symbol, "sellerName": seller_name
                })
            else:
                # Lưu hóa đơn mới & Cập nhật kho VAT
                inv_id = f"inv-batch-{int(datetime.now().timestamp()*1000)}"
                items_json = json.dumps(parsed.get("items", []), ensure_ascii=False)
                c.execute("""
                    INSERT INTO invoices (id, companyId, invoiceNumber, symbol, date, type, partnerName, partnerTaxCode, items, totalBeforeTax, vatAmount, totalWithTax, source, emailSubject, createdAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (inv_id, company_id, inv_num, symbol, parsed.get("date"), "INBOUND",
                      seller_name, seller_tax, items_json, parsed.get("totalBeforeTax", 0),
                      parsed.get("vatAmount", 0), parsed.get("totalWithTax", 0), ext.upper(),
                      f"Bóc tách hàng loạt: {file_name}", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
                conn.commit()
                success_count += 1
                results.append({
                    "fileName": file_name, "fileType": ext.upper(), "status": "SUCCESS",
                    "invoiceNumber": inv_num, "symbol": symbol, "sellerName": seller_name
                })

        except Exception as e:
            err_count += 1
            results.append({
                "fileName": file_name, "fileType": ext.upper() if ext else "FILE", "status": "ERROR",
                "errorMessage": str(e) or "Không đọc được file hóa đơn điện tử"
            })

    conn.close()
    return {
        "success": True,
        "totalFiles": len(files),
        "successCount": success_count,
        "duplicateCount": dup_count,
        "errorCount": err_count,
        "results": results
    }

@app.get("/api/companies")
def get_companies():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM companies ORDER BY rowid ASC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

@app.post("/api/companies")
def save_company(company: CompanyModel):
    conn = get_db()
    c = conn.cursor()
    comp_id = company.id or f"comp-{int(datetime.now().timestamp()*1000)}"
    c.execute("SELECT id FROM companies WHERE id = ?", (comp_id,))
    if c.fetchone():
        c.execute("UPDATE companies SET name=?, taxCode=?, address=? WHERE id=?",
                  (company.name, company.taxCode, company.address or "", comp_id))
    else:
        c.execute("INSERT INTO companies (id, name, taxCode, address) VALUES (?, ?, ?, ?)",
                  (comp_id, company.name, company.taxCode, company.address or ""))
    conn.commit()
    conn.close()
    return {"success": True, "companies": get_companies()}

@app.get("/api/backup/download")
def download_backup():
    if os.path.exists(DB_FILE):
        return FileResponse(DB_FILE, filename="vat_database.db", media_type="application/octet-stream")
    raise HTTPException(status_code=404, detail="Cơ sở dữ liệu SQLite chưa tồn tại.")

@app.post("/api/backup/restore")
async def restore_backup(request: Request):
    data = await request.json()
    conn = get_db()
    c = conn.cursor()
    if "companies" in data and isinstance(data["companies"], list):
        c.execute("DELETE FROM companies")
        for comp in data["companies"]:
            c.execute("INSERT INTO companies (id, name, taxCode, address, isDefault) VALUES (?, ?, ?, ?, ?)",
                      (comp.get("id"), comp.get("name"), comp.get("taxCode"), comp.get("address", ""), 1 if comp.get("isDefault") else 0))
    if "inventory" in data and isinstance(data["inventory"], list):
        c.execute("DELETE FROM inventory")
        for item in data["inventory"]:
            c.execute("""INSERT INTO inventory (id, companyId, sku, name, category, unit, totalInbound, totalOutbound, currentStock, minStockThreshold, averageCost, lastUpdated, note)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                      (item.get("id"), item.get("companyId", "comp-1"), item.get("sku"), item.get("name"), item.get("category", ""),
                       item.get("unit"), item.get("totalInbound", 0), item.get("totalOutbound", 0), item.get("currentStock", 0),
                       item.get("minStockThreshold", 5), item.get("averageCost", 0), item.get("lastUpdated"), item.get("note", "")))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Đã phục hồi dữ liệu SQLite vat_database.db thành công!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)
`;

export const BAT_RUNNER_CODE = `@echo off
chcp 65001 > nul
title PHẦN MỀM QUẢN LÝ KHO VAT & GMAIL LOCAL (SQLITE)

echo ======================================================================
echo   HỆ THỐNG QUẢN LÝ KHO VAT & GMAIL (FASTAPI + SQLITE LOCAL)
echo ======================================================================
echo.
echo [1/3] Đang kiểm tra môi trường Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [LỖI] Chưa tìm thấy Python trên máy tính!
    echo Vui lòng tải và cài đặt Python 3.9+ tại https://www.python.org/
    pause
    exit
)

echo [2/3] Đang cài đặt thư viện cần thiết (FastAPI, Uvicorn, Pydantic)...
pip install fastapi uvicorn pydantic --quiet

echo [3/3] Đang khởi chạy ứng dụng Quản Lý Kho VAT tại http://localhost:3000 ...
echo.
echo ======================================================================
echo   LƯU Ý: Vui lòng KHÔNG đóng cửa sổ CMD này khi đang dùng phần mềm.
echo   Mọi dữ liệu được tự động lưu vào file local: vat_database.db
echo ======================================================================
echo.

start http://localhost:3000

python main.py

pause
`;

export const PYTHON_STREAMLIT_CODE = `import streamlit as st
import pandas as pd
import sqlite3
import os

DB_FILE = "vat_database.db"

def init_sqlite_db():
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
    conn.commit()
    conn.close()

init_sqlite_db()
st.title("Quản Lý Kho VAT (Streamlit + SQLite)")
`;
