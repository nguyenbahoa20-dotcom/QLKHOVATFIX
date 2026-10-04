import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ParsedXmlInvoice, cleanInvoicePartyName, cleanXmlFloat, generateSkuFromName } from './xmlParser';
import { InvoiceItem } from '../types';

// Bundle the matching worker with the app so PDF reading works offline and
// does not depend on a third-party CDN being reachable.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PdfTextFragment = { x: number; text: string };
type PdfTextLine = { y: number; fragments: PdfTextFragment[]; text: string };

function normalizePdfText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function extractPdfTextLines(pdfBuffer: ArrayBuffer): Promise<PdfTextLine[]> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    const allLines: PdfTextLine[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageLines: Array<{ y: number; fragments: PdfTextFragment[] }> = [];
      for (const item of textContent.items as any[]) {
        const itemText = String(item.str || '').trim();
        if (!itemText) continue;
        const x = Number(item.transform?.[4] || 0);
        const y = Number(item.transform?.[5] || 0);
        let line = pageLines.find((candidate) => Math.abs(candidate.y - y) <= 2.5);
        if (!line) {
          line = { y, fragments: [] };
          pageLines.push(line);
        }
        line.fragments.push({ x, text: itemText });
      }

      pageLines.sort((a, b) => b.y - a.y);
      for (const line of pageLines) {
        line.fragments.sort((a, b) => a.x - b.x);
        allLines.push({
          y: line.y,
          fragments: line.fragments,
          text: line.fragments.map((fragment) => fragment.text).join(' ').replace(/\s+/g, ' ').trim(),
        });
      }
    }

    return allLines;
  } catch (err: any) {
    throw new Error('Khóa đọc file PDF thất bại: ' + (err.message || 'File PDF bị hỏng hoặc không có dữ liệu text layer.'));
  }
}

/** Extract text in visual line order so PDF invoice tables remain parseable. */
export async function extractTextFromPdf(pdfBuffer: ArrayBuffer): Promise<string> {
  const lines = await extractPdfTextLines(pdfBuffer);
  return lines.map((line) => line.text).join('\n');
}

type PdfInvoiceLineItem = {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
};

function extractPdfLineItems(lines: PdfTextLine[]): PdfInvoiceLineItem[] {
  const isNameHeader = (value: string) => /ten\s*hang\s*hoa|goods\s*and\s*services/.test(normalizePdfText(value));
  const headerIndex = lines.findIndex((line) => isNameHeader(line.text));
  if (headerIndex < 0) return [];

  // Invoice templates often put the column title and its English translation
  // on separate visual lines. Keep the block short so totals/footer text cannot
  // be mistaken for column headers.
  const headerLines = lines.slice(headerIndex, headerIndex + 4);
  const findHeader = (pattern: RegExp): PdfTextFragment | undefined => {
    const singleMatches = headerLines
      .flatMap((line) => line.fragments)
      .filter((fragment) => pattern.test(normalizePdfText(fragment.text)))
      .sort((a, b) => a.x - b.x);
    if (singleMatches.length) return singleMatches[0];

    const matches: PdfTextFragment[] = [];
    for (const line of headerLines) {
      const fragments = [...line.fragments].sort((a, b) => a.x - b.x);
      for (let start = 0; start < fragments.length; start++) {
        for (let end = start + 1; end <= Math.min(fragments.length, start + 6); end++) {
          const text = fragments.slice(start, end).map((fragment) => fragment.text).join(' ');
          if (pattern.test(normalizePdfText(text))) {
            matches.push(fragments[start]);
            break;
          }
        }
      }
    }
    return matches.sort((a, b) => a.x - b.x)[0];
  };

  const nameHeader = findHeader(/^(?:ten\s*hang\s*hoa|goods\s*and\s*services)/);
  if (!nameHeader) return [];

  const sttHeader = findHeader(/^(?:stt|\(no\))/);
  const unitHeader = findHeader(/^(?:dvt|don\s*vi\s*tinh|unit\b)/);
  const quantityHeader = findHeader(/^(?:so\s*luong|quantity\b)/);
  const priceHeader = findHeader(/^(?:don\s*gia|unit\s*price|price\b)/);
  const amountHeader = findHeader(/^(?:thanh\s*tien|amount\b)/);

  // Table headers are often centered, while item text is left-aligned at the
  // start of its cell. Use the STT column to find the left edge and leave room
  // before the next column so the unit (e.g. "Chiếc") is not read as the name.
  const nameColumnStart = sttHeader ? sttHeader.x + 26 : nameHeader.x - 12;
  const nameColumnEnd = unitHeader ? unitHeader.x - 18 : Number.POSITIVE_INFINITY;
  const quantityStart = unitHeader && quantityHeader ? (unitHeader.x + quantityHeader.x) / 2 : Number.NaN;
  const priceStart = quantityHeader && priceHeader ? (quantityHeader.x + priceHeader.x) / 2 : Number.NaN;
  const amountStart = priceHeader && amountHeader ? (priceHeader.x + amountHeader.x) / 2 : Number.NaN;
  const hasNumericColumns = [quantityStart, priceStart, amountStart].every(Number.isFinite);

  let currentRow: PdfInvoiceLineItem | null = null;
  const rows: PdfInvoiceLineItem[] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const normalizedLine = normalizePdfText(line.text);
    if (/cong\s*tien\s*hang|tien\s*thue|tong\s*cong\s*tien|total\s*amount/.test(normalizedLine)) break;

    const rowNumber = line.fragments.some((fragment) => {
      const isInNumberColumn = sttHeader ? fragment.x < sttHeader.x + 26 : fragment.x < nameColumnStart;
      // Ignore the explanatory column legend "(1) (2) ..." under the header.
      return isInNumberColumn && /^\d{1,3}[.)]?$/.test(fragment.text.trim());
    });
    if (rowNumber) {
      currentRow = { name: '', unit: '', quantity: 0, unitPrice: 0, totalAmount: 0 };
      rows.push(currentRow);
    }
    if (!currentRow) continue;

    for (const fragment of line.fragments) {
      const value = fragment.text.trim();
      if (!value) continue;

      // Item names are left-aligned, but may wrap onto more than one visual line.
      if (fragment.x >= nameColumnStart && fragment.x < nameColumnEnd - 2) {
        if (!/^\(?\d+\)?[.)]?$/.test(value)) currentRow.name += `${currentRow.name ? ' ' : ''}${value}`;
        continue;
      }

      const number = cleanXmlFloat(value);
      const isNumber = /^[+-]?[\d.,]+$/.test(value);
      if (isNumber && hasNumericColumns) {
        if (fragment.x >= quantityStart && fragment.x < priceStart && currentRow.quantity === 0) {
          currentRow.quantity = number;
        } else if (fragment.x >= priceStart && fragment.x < amountStart && currentRow.unitPrice === 0) {
          currentRow.unitPrice = number;
        } else if (fragment.x >= amountStart) {
          currentRow.totalAmount = number;
        }
      } else if (
        unitHeader && hasNumericColumns &&
        fragment.x >= nameColumnEnd - 2 && fragment.x < quantityStart && !isNumber && !/^\(?\d+\)?[.)]?$/.test(value)
      ) {
        currentRow.unit = value;
      }
    }
  }

  return rows
    .map((row) => ({ ...row, name: row.name.replace(/\s+/g, ' ').trim() }))
    .filter((row) => {
      const normalized = normalizePdfText(row.name);
      return row.name && !/^(?:ten hang hoa|goods and services|\(?\d+\)?)$/.test(normalized);
    });
}

/**
 * Regex parser for Vietnamese e-Invoices in PDF format (MISA, VNPT, Viettel, BKAV, Fast, etc.)
 */
export async function parsePdfInvoice(pdfBuffer: ArrayBuffer): Promise<ParsedXmlInvoice> {
  const lines = await extractPdfTextLines(pdfBuffer);
  const text = lines.map((line) => line.text).join('\n');

  if (!text || text.trim().length < 10) {
    throw new Error('File PDF scan hình ảnh hoặc không chứa dữ liệu văn bản text layer.');
  }

  // 1. Invoice Number (Số hóa đơn / Số HĐ)
  let invoiceNumber = '';
  const invNumMatches = [
    /Số\s*(?:hóa\s*đơn|HĐ)?\s*[:\.]?\s*0*([1-9][0-9]*)/i,
    /Số\s*[:\.]?\s*0*([1-9][0-9]*)/i,
    /No\.\s*[:\.]?\s*0*([1-9][0-9]*)/i,
    /Invoice\s*No\s*[:\.]?\s*0*([1-9][0-9]*)/i,
    /SHDon\s*[:\.]?\s*0*([1-9][0-9]*)/i,
  ];
  for (const reg of invNumMatches) {
    const match = text.match(reg);
    if (match && match[1]) {
      invoiceNumber = match[1].trim().padStart(7, '0');
      break;
    }
  }
  if (!invoiceNumber) {
    const fallbackMatch = text.match(/\b([0-9]{7,8})\b/);
    if (fallbackMatch) invoiceNumber = fallbackMatch[1];
  }
  // 2. Symbol / Serial (Ký hiệu / KHHDon)
  let symbol = '';
  const symbolMatches = [
    /Ký\s*hiệu\s*[:\.]?\s*([C123456789][A-Z0-9]{5,7})/i,
    /KHHDon\s*[:\.]?\s*([C123456789][A-Z0-9]{5,7})/i,
    /Serial\s*[:\.]?\s*([C123456789][A-Z0-9]{5,7})/i,
    /Ký\s*hiệu\s*[:\.]?\s*([A-Z0-9\/]{4,10})/i,
  ];
  for (const reg of symbolMatches) {
    const match = text.match(reg);
    if (match && match[1]) {
      symbol = match[1].trim().toUpperCase();
      break;
    }
  }
  if (!symbol) symbol = 'C26TBA';

  // 3. Tax Codes (Mã số thuế)
  const taxCodeRegex = /Mã\s*số\s*thuế\s*(?:\(Tax\s*code\))?\s*[:\.]?\s*([0-9]{10}(?:-[0-9]{3})?)/gi;
  const foundTaxCodes: string[] = [];
  let tMatch;
  while ((tMatch = taxCodeRegex.exec(text)) !== null) {
    foundTaxCodes.push(tMatch[1]);
  }

  let sellerTaxCode = foundTaxCodes[0] || '';
  let buyerTaxCode = foundTaxCodes[1] || '';

  // 4. Seller Name (Tên đơn vị bán)
  let sellerName = '';
  const sellerMatches = [
    /Đơn\s*vị\s*bán\s*(?:hàng)?\s*[:\.]?\s*([^\n\r]+)/i,
    /Tên\s*người\s*bán\s*[:\.]?\s*([^\n\r]+)/i,
    /Bên\s*bán\s*[:\.]?\s*([^\n\r]+)/i,
    /Company\s*[:\.]?\s*([^\n\r]+)/i,
  ];
  for (const reg of sellerMatches) {
    const match = text.match(reg);
    if (match && match[1]) {
      sellerName = match[1].trim().split(/Mã số thuế|Địa chỉ|Điện thoại/i)[0].trim();
      break;
    }
  }
  if (!sellerName) sellerName = 'Đơn vị Bán VAT (PDF)';

  // 5. Buyer Name
  let buyerName = '';
  let buyerAddress = '';
  const buyerSection = text.match(/Họ\s*tên\s*người\s*mua\s*(?:hàng)?[\s\S]*?(?=Hình\s*thức\s*thanh\s*toán|$)/i)?.[0] || '';
  if (buyerSection) {
    const buyerCompany = buyerSection.match(/Tên\s*đơn\s*vị\s*(?:\([^)]*\))?\s*[:.]?\s*([\s\S]*?)(?=Mã\s*số\s*thuế|Địa\s*chỉ|$)/i);
    if (buyerCompany?.[1]) buyerName = buyerCompany[1].trim();
    const buyerTax = buyerSection.match(/Mã\s*số\s*thuế\s*(?:\([^)]*\))?\s*[:.]?\s*([0-9]{10}(?:-[0-9]{3})?)/i);
    if (buyerTax?.[1]) buyerTaxCode = buyerTax[1];
    const buyerAddressMatch = buyerSection.match(/Địa\s*chỉ\s*(?:\([^)]*\))?\s*[:.]?\s*([\s\S]*?)(?=Mã\s*số\s*thuế|Điện\s*thoại|Hình\s*thức|$)/i);
    if (buyerAddressMatch?.[1]) buyerAddress = buyerAddressMatch[1].replace(/\s+/g, ' ').trim();
  }
  if (!buyerName) {
    const buyerMatches = [
      /Họ\s*tên\s*người\s*mua\s*(?:hàng)?\s*[:\.]?\s*([^\n\r]+)/i,
      /Bên\s*mua\s*[:\.]?\s*([^\n\r]+)/i,
    ];
    for (const reg of buyerMatches) {
      const match = buyerSection ? buyerSection.match(reg) : text.match(reg);
      if (match && match[1]) {
        buyerName = match[1].trim().split(/Mã số thuế|Địa chỉ/i)[0].trim();
        break;
      }
    }
  }
  sellerName = cleanInvoicePartyName(sellerName);
  buyerName = cleanInvoicePartyName(buyerName);

  // 6. Date (Ngày ... tháng ... năm ...)
  let date = new Date().toISOString().slice(0, 10);
  const dateMatch = text.match(/Ngày\s*([0-9]{1,2})\s*tháng\s*([0-9]{1,2})\s*năm\s*([0-9]{4})/i);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3];
    date = `${year}-${month}-${day}`;
  } else {
    const shortDateMatch = text.match(/([0-9]{2})\/([0-9]{2})\/([0-9]{4})/);
    if (shortDateMatch) {
      date = `${shortDateMatch[3]}-${shortDateMatch[2]}-${shortDateMatch[1]}`;
    }
  }

  // 7. Totals (Tổng tiền)
  let totalBeforeTax = 0;
  let vatAmount = 0;
  let totalWithTax = 0;
  let vatRate = 10;

  const vatRateMatch = text.match(/(?:Thuế\s*suất\s*GTGT|VAT\s*rate)\s*(?:\([^)]*\))?\s*[:\.]?\s*([0-9]+(?:[\.,][0-9]+)?)\s*%?/i);
  if (vatRateMatch) vatRate = cleanXmlFloat(vatRateMatch[1]);

  const totalBeforeMatch = text.match(/Cộng\s*tiền\s*hàng\s*(?:\([^)]*\))?\s*[:\.]?\s*([0-9][0-9\.,]*)/i);
  if (totalBeforeMatch) totalBeforeTax = cleanXmlFloat(totalBeforeMatch[1]);

  const vatMatch = text.match(/Tiền\s*thuế\s*GTGT\s*(?:\([^)]*\))?\s*[:\.]?\s*([0-9][0-9\.,]*)/i);
  if (vatMatch) vatAmount = cleanXmlFloat(vatMatch[1]);

  const totalWithTaxMatch = text.match(/Tổng\s*cộng\s*tiền\s*thanh\s*toán\s*(?:\([^)]*\))?\s*[:\.]?\s*([0-9][0-9\.,]*)/i);
  if (totalWithTaxMatch) totalWithTax = cleanXmlFloat(totalWithTaxMatch[1]);

  if (totalBeforeTax === 0 && totalWithTax > 0) {
    totalBeforeTax = vatAmount > 0 ? totalWithTax - vatAmount : Math.round(totalWithTax / (1 + vatRate / 100));
    if (vatAmount === 0) vatAmount = totalWithTax - totalBeforeTax;
  } else if (totalWithTax === 0 && totalBeforeTax > 0) {
    if (vatAmount === 0) vatAmount = Math.round(totalBeforeTax * vatRate / 100);
    totalWithTax = totalBeforeTax + vatAmount;
  }

  // 8. Line Items. Extract the actual row cells when the PDF exposes a table.
  const extractedLineItems = extractPdfLineItems(lines);
  const productNamesExtracted = extractedLineItems.length > 0;
  const skuPrefix = `PDF-${(invoiceNumber || `UNREAD-${Date.now()}`).replace(/[^A-Za-z0-9]/g, '')}`;
  const items: InvoiceItem[] = productNamesExtracted
    ? extractedLineItems.map((row, index) => {
      const quantity = row.quantity > 0 ? row.quantity : 1;
      const unitPrice = row.unitPrice > 0
        ? row.unitPrice
        : row.totalAmount > 0
          ? row.totalAmount / quantity
          : totalBeforeTax;
      return {
        id: `item-pdf-${Date.now()}-${index}`,
        sku: `${skuPrefix}-${generateSkuFromName(row.name, index)}`,
        name: row.name,
        unit: row.unit || 'Bộ',
        quantity,
        unitPrice,
        vatRate,
        totalAmount: row.totalAmount > 0 ? row.totalAmount : quantity * unitPrice,
      };
    })
    : [{
      id: `item-pdf-${Date.now()}-0`,
      sku: `${skuPrefix}-${generateSkuFromName(sellerName, 0)}`,
      name: `Sản phẩm Hóa đơn VAT ${invoiceNumber} (Đã bóc tách từ file PDF)`,
      unit: 'Bộ',
      quantity: 1,
      unitPrice: totalBeforeTax,
      vatRate,
      totalAmount: totalBeforeTax,
    }];

  return {
    invoiceNumber,
    symbol,
    cqtCode: '',
    date,
    sellerName,
    sellerTaxCode,
    buyerName,
    buyerTaxCode,
    buyerAddress,
    productNamesExtracted,
    items,
    totalBeforeTax,
    vatAmount,
    totalWithTax,
  };
}
