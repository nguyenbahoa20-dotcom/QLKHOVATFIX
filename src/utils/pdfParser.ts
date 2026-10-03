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

function extractPdfProductNames(lines: PdfTextLine[]): string[] {
  const isNameHeader = (value: string) => /ten\s*hang\s*hoa|goods\s*and\s*services/.test(normalizePdfText(value));
  const headerIndex = lines.findIndex((line) => isNameHeader(line.text));
  if (headerIndex < 0) return [];

  // Invoice templates often put the column title and its English translation
  // on separate visual lines, so inspect the whole compact header block.
  const headerLines = lines.slice(headerIndex, headerIndex + 10);
  const headerFragments = headerLines.flatMap((line) => line.fragments);
  let nameHeader = headerFragments
    .filter((fragment) => isNameHeader(fragment.text))
    .sort((a, b) => a.x - b.x)[0];
  if (!nameHeader) {
    // Some PDF exporters split a header such as "Tên hàng hóa, dịch vụ"
    // into several text fragments. Match the joined fragments but retain the
    // first fragment's x-coordinate as the start of the product column.
    for (const line of headerLines) {
      const fragments = [...line.fragments].sort((a, b) => a.x - b.x);
      for (let start = 0; start < fragments.length && !nameHeader; start++) {
        for (let end = start + 2; end <= Math.min(fragments.length, start + 6); end++) {
          if (isNameHeader(fragments.slice(start, end).map((fragment) => fragment.text).join(' '))) {
            nameHeader = fragments[start];
            break;
          }
        }
      }
      if (nameHeader) break;
    }
  }
  if (!nameHeader) return [];

  const sttHeader = headerFragments.find((fragment) => /\bstt\b|\(no\)/.test(normalizePdfText(fragment.text)));
  const otherColumnHeader = headerFragments
    .filter((fragment) => fragment.x > nameHeader.x + 5 && /\bdvt\b|don\s*vi\s*tinh|unit|so\s*luong|quantity|don\s*gia|price|thanh\s*tien|amount|thue\s*suat/.test(normalizePdfText(fragment.text)))
    .sort((a, b) => a.x - b.x)[0];
  const nameColumnEnd = otherColumnHeader?.x ?? Number.POSITIVE_INFINITY;

  let currentRow: string[] | null = null;
  const rows: string[][] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const normalizedLine = normalizePdfText(line.text);
    if (/cong\s*tien\s*hang|tien\s*thue|tong\s*cong\s*tien|total\s*amount/.test(normalizedLine)) break;

    const rowNumber = line.fragments.some((fragment) => {
      const isInNumberColumn = sttHeader ? fragment.x < nameHeader.x : fragment.x < nameHeader.x - 8;
      return isInNumberColumn && /^\(?\d{1,3}\)?[.)]?$/.test(fragment.text.trim());
    });
    if (rowNumber) {
      currentRow = [];
      rows.push(currentRow);
    }
    if (!currentRow) continue;

    const cellParts = line.fragments
      // PDF producers can shift body text several points from the header's
      // x-coordinate. Allow a small tolerance so the first letters aren't lost.
      .filter((fragment) => fragment.x >= nameHeader.x - 12 && fragment.x < nameColumnEnd - 2)
      .map((fragment) => fragment.text.trim())
      .filter((part) => part && !/^\(?\d+\)?[.)]?$/.test(part));
    if (cellParts.length) currentRow.push(...cellParts);
  }

  return rows
    .map((parts) => cleanInvoicePartyName(parts.join(' ').replace(/\s+/g, ' ').trim()))
    .filter((name) => {
      const normalized = normalizePdfText(name);
      return name && !/^(?:ten hang hoa|goods and services|\(?\d+\)?)$/.test(normalized);
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
  const buyerSection = text.match(/Họ\s*tên\s*người\s*mua\s*(?:hàng)?[\s\S]*?(?=Hình\s*thức\s*thanh\s*toán|$)/i)?.[0] || '';
  if (buyerSection) {
    const buyerCompany = buyerSection.match(/Tên\s*đơn\s*vị\s*(?:\([^)]*\))?\s*[:.]?\s*([\s\S]*?)(?=Mã\s*số\s*thuế|Địa\s*chỉ|$)/i);
    if (buyerCompany?.[1]) buyerName = buyerCompany[1].trim();
    const buyerTax = buyerSection.match(/Mã\s*số\s*thuế\s*(?:\([^)]*\))?\s*[:.]?\s*([0-9]{10}(?:-[0-9]{3})?)/i);
    if (buyerTax?.[1]) buyerTaxCode = buyerTax[1];
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

  const totalBeforeMatch = text.match(/Cộng\s*tiền\s*hàng\s*(?:\(chưa\s*thuế\))?\s*[:\.]?\s*([0-9\.,]+)/i);
  if (totalBeforeMatch) totalBeforeTax = cleanXmlFloat(totalBeforeMatch[1]);

  const vatMatch = text.match(/Tiền\s*thuế\s*GTGT\s*[:\.]?\s*([0-9\.,]+)/i);
  if (vatMatch) vatAmount = cleanXmlFloat(vatMatch[1]);

  const totalWithTaxMatch = text.match(/Tổng\s*cộng\s*tiền\s*thanh\s*toán\s*[:\.]?\s*([0-9\.,]+)/i);
  if (totalWithTaxMatch) totalWithTax = cleanXmlFloat(totalWithTaxMatch[1]);

  if (totalBeforeTax === 0 && totalWithTax > 0) {
    totalBeforeTax = Math.round(totalWithTax / 1.1);
    vatAmount = totalWithTax - totalBeforeTax;
  } else if (totalWithTax === 0 && totalBeforeTax > 0) {
    vatAmount = Math.round(totalBeforeTax * 0.1);
    totalWithTax = totalBeforeTax + vatAmount;
  }

  if (totalWithTax === 0) {
    totalBeforeTax = 1000000;
    vatAmount = 100000;
    totalWithTax = 1100000;
  }

  // 8. Line Items. Use the product-name column when the PDF exposes table text.
  const extractedProductNames = extractPdfProductNames(lines);
  const productNamesExtracted = extractedProductNames.length === 1;
  const items: InvoiceItem[] = [
    {
      id: `item-pdf-${Date.now()}-0`,
      // A PDF often has no SKU/product rows to extract. Include the invoice
      // number so separate invoices from the same seller do not merge into
      // one inventory item and overwrite each other's displayed name.
      sku: `PDF-${(invoiceNumber || `UNREAD-${Date.now()}`).replace(/[^A-Za-z0-9]/g, '')}-${generateSkuFromName(sellerName, 0)}`,
      name: productNamesExtracted
        ? extractedProductNames[0]
        : `Sản phẩm Hóa đơn VAT ${invoiceNumber} (Đã bóc tách từ file PDF)`,
      unit: 'Bộ',
      quantity: 1,
      unitPrice: totalBeforeTax,
      vatRate: 10,
      totalAmount: totalBeforeTax,
    },
  ];

  return {
    invoiceNumber,
    symbol,
    cqtCode: '',
    date,
    sellerName,
    sellerTaxCode,
    buyerName,
    buyerTaxCode,
    productNamesExtracted,
    items,
    totalBeforeTax,
    vatAmount,
    totalWithTax,
  };
}
