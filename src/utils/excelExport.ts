import * as XLSX from 'xlsx';
import { InventoryItem, Invoice } from '../types';

export function exportInventoryToExcel(inventory: InventoryItem[], invoices: Invoice[]) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet Tồn Kho Chi Tiết
  const inventoryData = inventory.map((item, idx) => ({
    'STT': idx + 1,
    'Mã SKU': item.sku,
    'Tên Sản Phẩm': item.name,
    'Danh Mục': item.category,
    'Đơn Vị Tính': item.unit,
    'Tổng Nhập (Kho V vào)': item.totalInbound,
    'Tổng Xuất (Kho V ra)': item.totalOutbound,
    'Tồn Kho Hiện Tại': item.currentStock,
    'Ngưỡng Tồn Tối Thiểu': item.minStockThreshold,
    'Đơn Giá Nhập TB (VNĐ)': item.averageCost,
    'Tổng Giá Trị Tồn (VNĐ)': item.currentStock * item.averageCost,
    'Trạng Thái Tồn Kho': item.currentStock <= 0 
      ? 'Hết hàng' 
      : item.currentStock <= item.minStockThreshold 
        ? 'Sắp hết (Dưới ngưỡng)' 
        : 'An toàn',
    'Ghi Chú': item.note || `Đã xuất ${item.totalOutbound}, còn lại ${item.currentStock}`
  }));

  const wsInventory = XLSX.utils.json_to_sheet(inventoryData);

  // Styling / Column Widths for Sheet 1
  wsInventory['!cols'] = [
    { wch: 6 },  // STT
    { wch: 16 }, // SKU
    { wch: 45 }, // Name
    { wch: 18 }, // Category
    { wch: 12 }, // Unit
    { wch: 18 }, // Total In
    { wch: 18 }, // Total Out
    { wch: 18 }, // Current Stock
    { wch: 20 }, // Min threshold
    { wch: 22 }, // Avg cost
    { wch: 24 }, // Total Value
    { wch: 22 }, // Status
    { wch: 35 }, // Note
  ];

  XLSX.utils.book_append_sheet(wb, wsInventory, 'Báo Cáo Tồn Kho VAT');

  // 2. Sheet Lịch Sử Hóa Đơn Nhập/Xuất
  const invoiceData: Array<Record<string, string | number>> = [];
  invoices.forEach((inv) => {
    inv.items.forEach((item) => {
      invoiceData.push({
        'Loại Hóa Đơn': inv.type === 'INBOUND' ? 'Nhập kho (Mua vào)' : 'Xuất kho (Bán ra)',
        'Số HĐ VAT': inv.invoiceNumber,
        'Ký Hiệu': inv.symbol,
        'Ngày HĐ': inv.date,
        'Đối Tác (Mua/Bán)': inv.partnerName,
        'Mã Số Thuế': inv.partnerTaxCode,
        'Mã SKU': item.sku,
        'Tên Sản Phẩm': item.name,
        'ĐVT': item.unit,
        'Số Lượng': item.quantity,
        'Đơn Giá (VNĐ)': item.unitPrice,
        'Thành Tiền Trước Thuế': item.quantity * item.unitPrice,
        'Thuế Suất VAT (%)': item.vatRate,
        'Tiền Thuế VAT': (item.quantity * item.unitPrice * item.vatRate) / 100,
        'Tổng Cộng (Cả Thuế)': (item.quantity * item.unitPrice) * (1 + item.vatRate / 100),
        'Nguồn Nhập': inv.source
      });
    });
  });

  const wsInvoices = XLSX.utils.json_to_sheet(invoiceData);
  wsInvoices['!cols'] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 35 },
    { wch: 16 },
    { wch: 16 },
    { wch: 40 },
    { wch: 10 },
    { wch: 12 },
    { wch: 18 },
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 12 }
  ];

  XLSX.utils.book_append_sheet(wb, wsInvoices, 'Lịch Sử Hóa Đơn VAT');

  // Export file
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Bao_Cao_Kho_VAT_${dateStr}.xlsx`);
}
