import * as XLSX from 'xlsx';
import { Company, InventoryItem, Invoice } from '../types';

export function exportInventoryToExcel(inventory: InventoryItem[], invoices: Invoice[], company?: Company) {
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

  // Column Widths
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

  const sheet1Name = company ? `Kho_${company.taxCode.slice(0, 10)}` : 'Báo Cáo Tồn Kho VAT';
  XLSX.utils.book_append_sheet(wb, wsInventory, sheet1Name);

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
        'Địa Chỉ Đối Tác': inv.partnerAddress || '',
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
    { wch: 40 },
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
  const companyPrefix = company ? `${company.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)}_` : '';
  XLSX.writeFile(wb, `Bao_Cao_Kho_VAT_${companyPrefix}${dateStr}.xlsx`);
}

/**
 * Export HTKK Standard VAT Declaration Sheet (Bảng Kê VAT Mua Vào & Bán Ra Chuẩn HTKK)
 */
export function exportHTKKVATToExcel(invoices: Invoice[], company?: Company) {
  const wb = XLSX.utils.book_new();

  const inboundInvoices = invoices.filter((i) => i.type === 'INBOUND');
  const outboundInvoices = invoices.filter((i) => i.type === 'OUTBOUND');

  // --- SHEET 1: BẢNG KÊ MUA VÀO (01-2/GTGT) ---
  let inboundSumPreTax = 0;
  let inboundSumVat = 0;

  const inboundRows: Array<Record<string, string | number>> = [];

  inboundInvoices.forEach((inv, idx) => {
    inboundSumPreTax += inv.totalBeforeTax;
    inboundSumVat += inv.vatAmount;

    // Default average VAT rate from items
    const avgVat = inv.items.length > 0 ? inv.items[0].vatRate : 10;

    inboundRows.push({
      'STT': idx + 1,
      'Mẫu số & Ký hiệu HĐ': inv.symbol || 'C26TBA',
      'Số hóa đơn': inv.invoiceNumber,
      'Ngày, tháng, năm lập HĐ': inv.date,
      'Tên người bán': inv.partnerName,
      'Mã số thuế người bán': inv.partnerTaxCode || '',
      'Địa chỉ người bán': inv.partnerAddress || '',
      'Doanh số mua chưa có thuế GTGT (VNĐ)': inv.totalBeforeTax,
      'Thuế suất VAT (%)': `${avgVat}%`,
      'Tiền thuế GTGT (VNĐ)': inv.vatAmount,
      'Ghi chú': `Nhập từ ${inv.source}`
    });
  });

  // Add Grand Total row for HTKK
  inboundRows.push({
    'STT': '',
    'Mẫu số & Ký hiệu HĐ': '',
    'Số hóa đơn': '',
    'Ngày, tháng, năm lập HĐ': '',
    'Tên người bán': 'TỔNG CỘNG BẢNG KÊ MUA VÀO',
    'Mã số thuế người bán': '',
    'Địa chỉ người bán': '',
    'Doanh số mua chưa có thuế GTGT (VNĐ)': inboundSumPreTax,
    'Thuế suất VAT (%)': '',
    'Tiền thuế GTGT (VNĐ)': inboundSumVat,
    'Ghi chú': 'Sử dụng để kê khai HTKK (Tờ khai 01-2/GTGT)'
  });

  const wsInbound = XLSX.utils.json_to_sheet(inboundRows);
  wsInbound['!cols'] = [
    { wch: 6 },  // STT
    { wch: 22 }, // Mau/Ky Hieu
    { wch: 16 }, // So HD
    { wch: 18 }, // Ngay lap
    { wch: 42 }, // Ten nguoi ban
    { wch: 20 }, // MST
    { wch: 42 }, // Dia chi
    { wch: 32 }, // Pretax
    { wch: 16 }, // Thue suat
    { wch: 24 }, // Vat amount
    { wch: 30 }, // Ghi chu
  ];

  XLSX.utils.book_append_sheet(wb, wsInbound, 'Bảng Kê Mua Vào (01-2 GTGT)');

  // --- SHEET 2: BẢNG KÊ BÁN RA (01-1/GTGT) ---
  let outboundSumPreTax = 0;
  let outboundSumVat = 0;

  const outboundRows: Array<Record<string, string | number>> = [];

  outboundInvoices.forEach((inv, idx) => {
    outboundSumPreTax += inv.totalBeforeTax;
    outboundSumVat += inv.vatAmount;

    const avgVat = inv.items.length > 0 ? inv.items[0].vatRate : 10;

    outboundRows.push({
      'STT': idx + 1,
      'Mẫu số & Ký hiệu HĐ': inv.symbol || 'C26TBA',
      'Số hóa đơn': inv.invoiceNumber,
      'Ngày, tháng, năm lập HĐ': inv.date,
      'Tên người mua': inv.partnerName,
      'Mã số thuế người mua': inv.partnerTaxCode || '',
      'Địa chỉ người mua': inv.partnerAddress || '',
      'Doanh thu bán chưa có thuế GTGT (VNĐ)': inv.totalBeforeTax,
      'Thuế suất VAT (%)': `${avgVat}%`,
      'Tiền thuế GTGT (VNĐ)': inv.vatAmount,
      'Ghi chú': `Xuất bán (${inv.source})`
    });
  });

  // Add Grand Total row for HTKK
  outboundRows.push({
    'STT': '',
    'Mẫu số & Ký hiệu HĐ': '',
    'Số hóa đơn': '',
    'Ngày, tháng, năm lập HĐ': '',
    'Tên người mua': 'TỔNG CỘNG BẢNG KÊ BÁN RA',
    'Mã số thuế người mua': '',
    'Địa chỉ người mua': '',
    'Doanh thu bán chưa có thuế GTGT (VNĐ)': outboundSumPreTax,
    'Thuế suất VAT (%)': '',
    'Tiền thuế GTGT (VNĐ)': outboundSumVat,
    'Ghi chú': 'Sử dụng để kê khai HTKK (Tờ khai 01-1/GTGT)'
  });

  const wsOutbound = XLSX.utils.json_to_sheet(outboundRows);
  wsOutbound['!cols'] = [
    { wch: 6 },  // STT
    { wch: 22 }, // Mau/Ky Hieu
    { wch: 16 }, // So HD
    { wch: 18 }, // Ngay lap
    { wch: 42 }, // Ten nguoi mua
    { wch: 20 }, // MST
    { wch: 42 }, // Dia chi
    { wch: 32 }, // Pretax
    { wch: 16 }, // Thue suat
    { wch: 24 }, // Vat amount
    { wch: 30 }, // Ghi chu
  ];

  XLSX.utils.book_append_sheet(wb, wsOutbound, 'Bảng Kê Bán Ra (01-1 GTGT)');

  // Download File
  const dateStr = new Date().toISOString().slice(0, 10);
  const companyTax = company ? `_MST_${company.taxCode}` : '';
  XLSX.writeFile(wb, `Bang_Ke_VAT_HTKK${companyTax}_${dateStr}.xlsx`);
}
