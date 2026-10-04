export type InvoiceType = 'INBOUND' | 'OUTBOUND'; // INBOUND = Mua vào (Nhập), OUTBOUND = Bán ra (Xuất)

export interface AppUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  taxCode: string;
  address?: string;
  isDefault?: boolean;
}

export interface InvoiceItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  vatRate: number; // e.g. 8 or 10 (%)
  totalAmount: number;
}

export interface Invoice {
  id: string;
  companyId?: string; // ID công ty sở hữu hóa đơn này
  invoiceNumber: string; // Số hóa đơn VAT (e.g. 0001234)
  symbol: string; // Ký hiệu hóa đơn (e.g. C24TBA)
  date: string; // YYYY-MM-DD
  type: InvoiceType;
  partnerName: string; // Tên công ty người bán (Nhập) hoặc người mua (Xuất)
  partnerTaxCode: string; // Mã số thuế
  partnerAddress?: string; // Địa chỉ người bán/người mua
  buyerName?: string;
  buyerTaxCode?: string;
  items: InvoiceItem[];
  totalBeforeTax: number;
  vatAmount: number;
  totalWithTax: number;
  source: 'GMAIL' | 'EXCEL' | 'XML' | 'MANUAL' | 'PDF';
  emailSubject?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  companyId?: string; // ID công ty sở hữu mặt hàng này
  sku: string; // Mã sản phẩm
  name: string; // Tên sản phẩm
  category: string; // Danh mục
  unit: string; // Đơn vị tính (Cái, Bộ, Hộp, Kg...)
  totalInbound: number; // Số lượng nhập (Kho V vào)
  totalOutbound: number; // Số lượng đã xuất (Bán V ra)
  currentStock: number; // Tồn kho còn lại (Inbound - Outbound)
  minStockThreshold: number; // Mức tồn kho tối thiểu để cảnh báo
  averageCost: number; // Đơn giá nhập trung bình (VNĐ)
  lastUpdated: string;
  note?: string; // Ghi chú bổ sung
}

export interface GmailConfig {
  email: string;
  appPassword?: string;
  isConnected: boolean;
  autoScanIntervalMinutes: number;
  lastSyncTime?: string;
  imapHost: string;
  imapPort: number;
  enableAlerts: boolean;
  alertEmailRecipient: string;
}

export interface EmailLog {
  id: string;
  timestamp: string;
  sender: string;
  subject: string;
  hasAttachment: boolean;
  attachmentName?: string;
  status: 'SUCCESS' | 'NO_VAT_FOUND' | 'ERROR';
  invoiceId?: string;
  parsedItemCount?: number;
}

export interface StockAlert {
  id: string;
  sku: string;
  productName: string;
  currentStock: number;
  minStockThreshold: number;
  createdAt: string;
  sentStatus: 'PENDING' | 'SENT' | 'FAILED';
}
