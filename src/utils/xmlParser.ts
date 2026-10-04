import { InvoiceItem } from '../types';

export interface ParsedXmlInvoice {
  invoiceNumber: string;
  symbol: string;
  cqtCode: string;
  date: string;
  sellerName: string;
  sellerTaxCode: string;
  sellerAddress?: string;
  buyerName: string;
  buyerTaxCode: string;
  buyerAddress?: string;
  productNamesExtracted?: boolean;
  items: InvoiceItem[];
  totalBeforeTax: number;
  vatAmount: number;
  totalWithTax: number;
}

/** Remove a role label accidentally included in a party name, such as "(Seller): ACME". */
export function cleanInvoicePartyName(value: string): string {
  return (value || '')
    .normalize('NFKC')
    .replace(/^\s*\(?\s*(?:seller|buyer)\s*\)?\s*:\s*/i, '')
    .replace(/^\s*(?:tên\s*đơn\s*vị(?:\s*\([^)]*\))?|company(?:'s\s*name)?|seller(?:'s\s*name)?|buyer(?:'s\s*name)?)\s*:\s*/i, '')
    .trim();
}

/**
 * Clean and parse floating point number from XML string (handling Vietnamese comma/dot format like 190.740,67)
 */
export function cleanXmlFloat(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).trim();
  if (!str) return 0;

  // Remove percentage signs or currency symbols
  str = str.replace(/%/g, '').trim();

  if (str.includes('.') && str.includes(',')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      // 190.740,67 -> dot is thousand separator, comma is decimal
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // 190,740.67 -> comma is thousand separator, dot is decimal
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // 190740,67 -> comma is decimal
    str = str.replace(',', '.');
  }
  str = str.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Universal tag locator that matches local name ignoring XML namespaces (e.g. n0:SHDon, inv:InvoiceNo)
 */
function getTagTextUniversal(parent: Element | Document, tagCandidates: string[]): string {
  const candidates = tagCandidates.map((t) => t.toLowerCase());

  // 1. Try getElementsByTagName with candidates
  for (const candidate of tagCandidates) {
    const elements = parent.getElementsByTagName(candidate);
    if (elements.length > 0 && elements[0].textContent) {
      const text = elements[0].textContent.trim();
      if (text) return text;
    }
  }

  // 2. Iterate all child elements matching localName ignoring namespace
  const allElements = parent.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase();
    if (candidates.includes(localName) && el.textContent) {
      const text = el.textContent.trim();
      if (text) return text;
    }
  }

  return '';
}

/**
 * Search all sub-elements by local tag names
 */
function getElementsUniversal(parent: Element | Document, tagCandidates: string[]): Element[] {
  const candidates = tagCandidates.map((t) => t.toLowerCase());
  const matched: Element[] = [];

  const allElements = parent.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    const localName = (el.localName || el.tagName.split(':').pop() || '').toLowerCase();
    if (candidates.includes(localName)) {
      matched.push(el);
    }
  }
  return matched;
}

/**
 * Generate a clean SKU if none is provided in the XML
 */
export function generateSkuFromName(name: string, index: number): string {
  if (!name) return `SP-VAT-${index + 1}`;

  // Create acronym from Vietnamese or ASCII words
  const words = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/);

  if (words.length >= 2) {
    const acronym = words
      .slice(0, 4)
      .map((w) => w.toUpperCase().slice(0, 3))
      .join('-');
    return acronym;
  }

  return words[0] ? words[0].toUpperCase().slice(0, 8) : `SP-VAT-${index + 1}`;
}

/**
 * Parse Vietnamese e-Invoice XML (Multi-vendor support: GDT / MISA / Viettel / VNPT / BKAV / EasyInvoice / Softdreams / Thai Son / CyberBill / Mobifone)
 */
export function parseInvoiceXml(xmlContent: string): ParsedXmlInvoice {
  if (!xmlContent || typeof xmlContent !== 'string') {
    throw new Error('Dữ liệu XML trống hoặc không hợp lệ.');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

  // Check for XML parsing error
  const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('File XML không đúng định dạng cấu trúc XML.');
  }

  // 1. Extract Invoice Number
  let invoiceNumber = getTagTextUniversal(xmlDoc, [
    'SHDon', 'InvoiceNumber', 'SoHoaDon', 'SoHD', 'num', 'InvoiceNo', 
    'so_hd', 'InvoiceNum', 'InvNum', 'SOHDON', 'Invoiceno', 'InvNo', 'InvoiceNumberStr'
  ]);
  if (!invoiceNumber) {
    const match = xmlContent.match(/<(?:[a-zA-Z0-9_-]+:)?(?:SHDon|InvoiceNumber|SoHoaDon|SoHD|InvoiceNo|InvNo)>([^<]+)<\//i);
    invoiceNumber = match ? match[1].trim() : '';
  }
  if (!invoiceNumber) {
    throw new Error('Không tìm thấy số hóa đơn trong file XML. Không thể lưu hóa đơn để tránh phát sinh tồn kho trùng.');
  }

  // 2. Extract Symbol / Serial
  let symbol = getTagTextUniversal(xmlDoc, [
    'KHMSHDon', 'KSHDon', 'KHDon', 'Symbol', 'SerialNo', 'KyHieu', 'KH', 
    'Pattern', 'Serial', 'InvoicePattern', 'InvoiceSeries', 'Series', 'KHMHD'
  ]);
  if (!symbol) {
    const match = xmlContent.match(/<(?:[a-zA-Z0-9_-]+:)?(?:KHMSHDon|KSHDon|KHDon|Symbol|KyHieu|Series)>([^<]+)<\//i);
    symbol = match ? match[1].trim() : 'C26TBA';
  }

  // 3. Extract Tax Authority Code (Mã CQT)
  let cqtCode = getTagTextUniversal(xmlDoc, [
    'MCCQT', 'MaCQT', 'CQTCode', 'TaxAuthorityCode', 'MCT', 'MaCuaCoQuanThue'
  ]);
  if (!cqtCode) {
    const match = xmlContent.match(/<(?:[a-zA-Z0-9_-]+:)?(?:MCCQT|MaCQT|CQTCode)>([^<]+)<\//i);
    cqtCode = match ? match[1].trim() : '';
  }

  // 4. Extract Date
  let dateRaw = getTagTextUniversal(xmlDoc, [
    'NLap', 'InvoiceDate', 'AriseDate', 'NgayLap', 'Date', 'CreatedDate', 'IssueDate', 'NLapHD', 'SignedDate', 'ApproveDate'
  ]);
  let date = new Date().toISOString().slice(0, 10);
  if (dateRaw) {
    if (dateRaw.includes('/')) {
      const parts = dateRaw.split('/');
      if (parts.length === 3) {
        date = `${parts[2].trim()}-${parts[1].trim().padStart(2, '0')}-${parts[0].trim().padStart(2, '0')}`;
      }
    } else if (dateRaw.length >= 10) {
      date = dateRaw.slice(0, 10);
    }
  }

  // 5. Extract Seller (Supplier) Info
  let sellerName = '';
  let sellerTaxCode = '';
  let sellerAddress = '';
  const sellerNodes = getElementsUniversal(xmlDoc, ['NBan', 'Seller', 'Supplier', 'Vendor', 'NhaCungCap', 'SellerInfo', 'CoQuanBan', 'BenBan']);
  if (sellerNodes.length > 0) {
    const seller = sellerNodes[0];
    sellerName = getTagTextUniversal(seller, ['Ten', 'TenNBan', 'Name', 'SellerName', 'CompName', 'NhaCungCap']);
    sellerTaxCode = getTagTextUniversal(seller, ['MST', 'MSTNBan', 'TaxCode', 'SellerTaxCode', 'CompTaxCode']);
    sellerAddress = getTagTextUniversal(seller, ['DChi', 'DiaChi', 'Address', 'SellerAddress', 'SupplierAddress']);
  }
  if (!sellerName) {
    sellerName = getTagTextUniversal(xmlDoc, ['TenNBan', 'SellerName', 'NhaCungCap', 'TenNhaCungCap', 'VendorName']);
  }
  if (!sellerTaxCode) {
    sellerTaxCode = getTagTextUniversal(xmlDoc, ['MSTNBan', 'SellerTaxCode', 'MSTNhaCungCap', 'SupplierTaxCode']);
  }
  if (!sellerAddress) {
    sellerAddress = getTagTextUniversal(xmlDoc, ['DChiNBan', 'DiaChiNguoiBan', 'SellerAddress', 'SupplierAddress']);
  }
  if (!sellerName) sellerName = 'Nhà Cung Cấp VAT';

  // 6. Extract Buyer Info
  let buyerName = '';
  let buyerTaxCode = '';
  let buyerAddress = '';
  const buyerNodes = getElementsUniversal(xmlDoc, ['NMua', 'Buyer', 'Customer', 'KhachHang', 'BuyerInfo', 'CoQuanMua', 'BenMua']);
  if (buyerNodes.length > 0) {
    const buyer = buyerNodes[0];
    buyerName = getTagTextUniversal(buyer, ['Ten', 'TenNMua', 'Name', 'BuyerName', 'CusName', 'KhachHang']);
    buyerTaxCode = getTagTextUniversal(buyer, ['MST', 'MSTNMua', 'TaxCode', 'BuyerTaxCode', 'CusTaxCode']);
    buyerAddress = getTagTextUniversal(buyer, ['DChi', 'DiaChi', 'Address', 'BuyerAddress', 'CusAddress']);
  }
  if (!buyerName) {
    buyerName = getTagTextUniversal(xmlDoc, ['TenNMua', 'BuyerName', 'KhachHang', 'CustomerName']);
  }
  if (!buyerTaxCode) {
    buyerTaxCode = getTagTextUniversal(xmlDoc, ['MSTNMua', 'BuyerTaxCode', 'CustomerTaxCode']);
  }
  if (!buyerAddress) {
    buyerAddress = getTagTextUniversal(xmlDoc, ['DChiNMua', 'DiaChiNguoiMua', 'BuyerAddress', 'CustomerAddress']);
  }
  sellerName = cleanInvoicePartyName(sellerName);
  buyerName = cleanInvoicePartyName(buyerName);

  // 7. Extract Line Items
  const items: InvoiceItem[] = [];
  const itemElements = getElementsUniversal(xmlDoc, [
    'HHDVu', 'Item', 'Product', 'DetailItem', 'ChiTietHoaDon', 'InvoiceLine', 
    'HĐnHang', 'GoodsService', 'ProductItem', 'Row', 'Detail', 'Line'
  ]);

  itemElements.forEach((el, index) => {
    const name = getTagTextUniversal(el, [
      'THHDVu', 'Name', 'ItemName', 'TenHang', 'TenHHDVu', 'ProductName', 'GoodsName', 'Description', 'Ten'
    ]);
    if (!name) return; // skip empty lines

    let sku = getTagTextUniversal(el, [
      'MHHDVu', 'Code', 'ItemCode', 'MaHang', 'MaHHDVu', 'SKU', 'ProductCode', 'GoodsCode'
    ]);
    if (!sku) {
      sku = generateSkuFromName(name, index);
    }

    const unit = getTagTextUniversal(el, [
      'DVTinh', 'Unit', 'DonViTinh', 'DVT', 'UnitName', 'UOM'
    ]) || 'Cái';

    const qtyStr = getTagTextUniversal(el, [
      'SLuong', 'Quantity', 'SoLuong', 'SL', 'Qty', 'Volume'
    ]);
    const quantity = cleanXmlFloat(qtyStr) || 1;

    const priceStr = getTagTextUniversal(el, [
      'DGia', 'UnitPrice', 'DonGia', 'DG', 'Price'
    ]);
    const unitPrice = cleanXmlFloat(priceStr);

    const amountStr = getTagTextUniversal(el, [
      'ThTien', 'Amount', 'ThanhTien', 'ThTienNT', 'Total', 'AmountBeforeTax', 'Val', 'TotalAmount'
    ]);
    let totalAmount = cleanXmlFloat(amountStr);
    if (totalAmount === 0 && unitPrice > 0) {
      totalAmount = quantity * unitPrice;
    }

    const vatStr = getTagTextUniversal(el, [
      'TSuat', 'VATRate', 'ThueSuat', 'VAT', 'TaxRate', 'Rate', 'Percentage'
    ]);
    let vatRate = 10;
    if (vatStr) {
      const num = cleanXmlFloat(vatStr);
      if (!isNaN(num)) vatRate = num;
    }

    items.push({
      id: `item-xml-${Date.now()}-${index}`,
      sku: sku.toUpperCase(),
      name,
      unit,
      quantity,
      unitPrice,
      vatRate,
      totalAmount,
    });
  });

  // Fallback if no line items parsed
  if (items.length === 0) {
    items.push({
      id: `item-xml-${Date.now()}-0`,
      sku: 'VAT-ITEM-01',
      name: 'Mặt hàng theo Hóa Đơn VAT ' + invoiceNumber,
      unit: 'Gói',
      quantity: 1,
      unitPrice: 1000000,
      vatRate: 10,
      totalAmount: 1000000,
    });
  }

  // 8. Summary Totals
  let totalBeforeTax = cleanXmlFloat(
    getTagTextUniversal(xmlDoc, [
      'TgTienPreTax', 'TotalBeforeTax', 'TongTienChuaThue', 'TongTienTruocThue', 'TgTienChuaThue', 'TgTCThue', 'TotalAmountWithoutVAT'
    ])
  );
  let vatAmount = cleanXmlFloat(
    getTagTextUniversal(xmlDoc, [
      'TgTienThue', 'TotalVAT', 'TongTienThue', 'TienThue', 'TgThue', 'VATAmount'
    ])
  );
  let totalWithTax = cleanXmlFloat(
    getTagTextUniversal(xmlDoc, [
      'TgTienThToan', 'TotalAmount', 'TongTienThanhToan', 'TongTien', 'TgTTSo', 'TotalAmountWithVAT'
    ])
  );

  if (totalBeforeTax === 0) {
    totalBeforeTax = items.reduce((sum, i) => sum + (i.totalAmount || i.quantity * i.unitPrice), 0);
  }
  if (vatAmount === 0) {
    vatAmount = items.reduce((sum, i) => sum + ((i.totalAmount || i.quantity * i.unitPrice) * i.vatRate) / 100, 0);
  }
  if (totalWithTax === 0) {
    totalWithTax = totalBeforeTax + vatAmount;
  }

  return {
    invoiceNumber,
    symbol,
    cqtCode,
    date,
    sellerName,
    sellerTaxCode,
    sellerAddress,
    buyerName,
    buyerTaxCode,
    buyerAddress,
    items,
    totalBeforeTax,
    vatAmount,
    totalWithTax,
  };
}
