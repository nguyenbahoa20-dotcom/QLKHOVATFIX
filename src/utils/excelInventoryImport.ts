import * as XLSX from 'xlsx';

export interface ExcelInventoryRow {
  sourceRow: number;
  sku: string;
  name: string;
  unit: string;
  closingQuantity: number;
  closingValue: number;
  averageCost: number;
}

export interface ExcelInventoryParseResult {
  sheetName: string;
  period: string;
  rows: ExcelInventoryRow[];
  skippedRows: number;
  warnings: string[];
}

const normalizeHeader = (value: unknown) =>
  String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[Đđ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function findInventoryHeader(rows: unknown[][]) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 30); rowIndex += 1) {
    const top = rows[rowIndex] || [];
    const lower = rows[rowIndex + 1] || [];
    const skuColumn = top.findIndex((cell) => normalizeHeader(cell) === 'ma hang');
    const nameColumn = top.findIndex((cell) => normalizeHeader(cell) === 'ten hang');
    const unitColumn = top.findIndex((cell) => normalizeHeader(cell) === 'dvt' || normalizeHeader(cell).includes('don vi tinh'));
    const closingColumn = top.findIndex((cell) => normalizeHeader(cell).includes('cuoi ky'));
    if (skuColumn < 0 || nameColumn < 0 || unitColumn < 0 || closingColumn < 0) continue;

    const quantityColumn = lower.findIndex((cell, index) => index >= closingColumn && normalizeHeader(cell) === 'so luong');
    const valueColumn = lower.findIndex((cell, index) => index >= closingColumn && normalizeHeader(cell) === 'gia tri');
    if (quantityColumn >= 0 && valueColumn >= 0) {
      return { rowIndex, skuColumn, nameColumn, unitColumn, quantityColumn, valueColumn };
    }
  }
  return null;
}

export async function parseExcelInventoryFile(file: File): Promise<ExcelInventoryParseResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
    const header = findInventoryHeader(rows);
    if (!header) continue;

    const periodCell = rows.slice(0, header.rowIndex).flat().find((cell) => typeof cell === 'string' && /thang\s+\d{1,2}\s+nam\s+\d{4}/i.test(normalizeHeader(cell)));
    const period = periodCell ? String(periodCell).trim() : 'Không ghi kỳ';
    const dataStart = header.rowIndex + 2;
    const parsedRows: ExcelInventoryRow[] = [];
    const warnings: string[] = [];
    let skippedRows = 0;
    const seenSkus = new Set<string>();

    for (let index = dataStart; index < rows.length; index += 1) {
      const row = rows[index] || [];
      const sku = String(row[header.skuColumn] ?? '').trim();
      const name = String(row[header.nameColumn] ?? '').trim();
      const unit = String(row[header.unitColumn] ?? '').trim();
      if (!sku && !name) continue;
      if (!sku || !name || !unit || /^(tong cong|so dong\s*=|tong so)/i.test(normalizeHeader(sku))) {
        skippedRows += 1;
        continue;
      }
      const quantity = parseNumber(row[header.quantityColumn]);
      const value = parseNumber(row[header.valueColumn]);
      if (quantity === null || value === null) {
        skippedRows += 1;
        warnings.push(`Dòng ${index + 1}: số lượng hoặc giá trị cuối kỳ không phải số hợp lệ.`);
        continue;
      }
      const normalizedSku = sku.toLocaleLowerCase('vi-VN');
      if (seenSkus.has(normalizedSku)) {
        skippedRows += 1;
        warnings.push(`Dòng ${index + 1}: mã hàng “${sku}” bị lặp trong file; chỉ giữ dòng đầu tiên.`);
        continue;
      }
      seenSkus.add(normalizedSku);
      if (quantity === 0 && value !== 0) warnings.push(`Dòng ${index + 1}: tồn số lượng bằng 0 nhưng giá trị khác 0; đơn giá vốn tạm để 0.`);
      parsedRows.push({
        sourceRow: index + 1,
        sku,
        name,
        unit,
        closingQuantity: quantity,
        closingValue: value,
        averageCost: quantity === 0 ? 0 : value / quantity,
      });
    }
    return { sheetName, period, rows: parsedRows, skippedRows, warnings };
  }
  throw new Error('Không tìm thấy bảng tồn kho có các cột Mã hàng, Tên hàng, ĐVT và Cuối kỳ (Số lượng, Giá trị).');
}
