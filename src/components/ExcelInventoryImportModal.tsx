import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { InventoryItem } from '../types';
import { ExcelInventoryParseResult, parseExcelInventoryFile } from '../utils/excelInventoryImport';

interface ExcelInventoryImportModalProps {
  inventory: InventoryItem[];
  companyId: string;
  onClose: () => void;
  onImport: (items: InventoryItem[]) => Promise<void>;
}

const normalizeSku = (sku: string) => sku.trim().toLocaleLowerCase('vi-VN');

export const ExcelInventoryImportModal: React.FC<ExcelInventoryImportModalProps> = ({ inventory, companyId, onClose, onImport }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ExcelInventoryParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update'>('skip');
  const [isImporting, setIsImporting] = useState(false);

  const existingBySku = useMemo(() => new Map(inventory.map((item) => [normalizeSku(item.sku), item])), [inventory]);
  const duplicateRows = useMemo(() => parsed?.rows.filter((row) => existingBySku.has(normalizeSku(row.sku))) ?? [], [parsed, existingBySku]);
  const importableRows = useMemo(
    () => parsed?.rows.filter((row) => duplicateMode === 'update' || !existingBySku.has(normalizeSku(row.sku))) ?? [],
    [parsed, duplicateMode, existingBySku],
  );

  const handleFile = async (file?: File) => {
    if (!file) return;
    setParsed(null);
    setFileName(file.name);
    setFileError('');
    try {
      setParsed(await parseExcelInventoryFile(file));
    } catch (error: any) {
      setFileError(error?.message || 'Không đọc được file Excel này.');
    }
  };

  const makeItems = (): InventoryItem[] => {
    if (!parsed) return [];
    const importedAt = new Date().toISOString().slice(0, 10);
    return importableRows.map((row, index) => {
      const existing = existingBySku.get(normalizeSku(row.sku));
      return {
        id: existing?.id || `excel-${Date.now()}-${index}`,
        companyId,
        sku: existing?.sku || row.sku,
        name: row.name,
        category: existing?.category || '',
        unit: row.unit,
        totalInbound: row.closingQuantity,
        totalOutbound: 0,
        currentStock: row.closingQuantity,
        minStockThreshold: existing?.minStockThreshold ?? 5,
        averageCost: row.averageCost,
        lastUpdated: importedAt,
        note: existing?.note || `Tồn kho chốt kỳ ${parsed.period}; nhập từ Excel`,
      };
    });
  };

  const confirmImport = async () => {
    if (!parsed || importableRows.length === 0) return;
    setIsImporting(true);
    try {
      await onImport(makeItems());
      onClose();
    } catch (error: any) {
      setFileError(error?.message || 'Không thể lưu dữ liệu vào kho.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="excel-import-title">
      <div className="bg-white w-full max-w-4xl max-h-[94vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">
        <div className="px-5 sm:px-7 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><FileSpreadsheet className="w-5 h-5" /></div>
            <div>
              <h2 id="excel-import-title" className="font-black text-slate-900">Nhập tồn kho từ Excel</h2>
              <p className="text-xs text-slate-500">Hỗ trợ bảng có cột Mã hàng, Tên hàng, ĐVT và số liệu Cuối kỳ</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isImporting} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 sm:p-7 overflow-y-auto space-y-5">
          <div className="rounded-2xl border border-dashed border-blue-300 bg-blue-50/50 p-5 text-center">
            <Upload className="w-7 h-7 mx-auto text-blue-600 mb-2" />
            <p className="text-sm font-semibold text-slate-800">Chọn file Excel kho hàng (.xlsx, .xls)</p>
            <p className="text-xs text-slate-500 mt-1">File được đọc trong ứng dụng; chỉ lưu dữ liệu sau khi bạn xác nhận.</p>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => { void handleFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
            <button onClick={() => inputRef.current?.click()} disabled={isImporting} className="mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50">Chọn file Excel</button>
            {fileName && <p className="mt-2 text-xs text-slate-600">{fileName}</p>}
          </div>

          {fileError && <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm p-3">{fileError}</div>}

          {parsed && <>
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-3 text-amber-950">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
              <div className="text-sm">
                <p className="font-bold">Đây là số tồn chốt kỳ {parsed.period}.</p>
                <p className="text-xs mt-1">Nhập sẽ thay số tồn theo file và đặt tổng nhập bằng tồn chốt kỳ, tổng xuất bằng 0. File không có lịch sử hóa đơn; đồng bộ lại từ hóa đơn sau này có thể tính lại số tồn.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-black text-slate-900">{parsed.rows.length}</div><div className="text-[11px] text-slate-500">Dòng hợp lệ</div></div>
              <div className="rounded-xl bg-emerald-50 p-3"><div className="text-xl font-black text-emerald-700">{importableRows.length}</div><div className="text-[11px] text-slate-500">Sẽ nhập</div></div>
              <div className="rounded-xl bg-amber-50 p-3"><div className="text-xl font-black text-amber-700">{duplicateRows.length}</div><div className="text-[11px] text-slate-500">Mã đã có trong kho</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-black text-slate-700">{parsed.skippedRows}</div><div className="text-[11px] text-slate-500">Dòng bỏ qua</div></div>
            </div>

            {duplicateRows.length > 0 && <fieldset className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <legend className="px-1 text-sm font-bold text-slate-800">Xử lý mã hàng đã có</legend>
              <label className="flex gap-3 items-start text-sm cursor-pointer">
                <input type="radio" name="duplicateMode" checked={duplicateMode === 'skip'} onChange={() => setDuplicateMode('skip')} className="mt-1" />
                <span><strong>Bỏ qua mã trùng</strong><span className="block text-xs text-slate-500">Giữ nguyên mặt hàng đang có trong kho.</span></span>
              </label>
              <label className="flex gap-3 items-start text-sm cursor-pointer">
                <input type="radio" name="duplicateMode" checked={duplicateMode === 'update'} onChange={() => setDuplicateMode('update')} className="mt-1" />
                <span><strong>Cập nhật theo file</strong><span className="block text-xs text-slate-500">Thay tên, đơn vị, số tồn và giá vốn của mã trùng; giữ danh mục và ngưỡng cảnh báo.</span></span>
              </label>
            </fieldset>}

            {parsed.warnings.length > 0 && <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900"><p className="font-bold mb-1">Cần lưu ý</p>{parsed.warnings.slice(0, 5).map((warning) => <p key={warning}>{warning}</p>)}{parsed.warnings.length > 5 && <p>…và {parsed.warnings.length - 5} cảnh báo khác.</p>}</div>}

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2">Mã hàng</th><th className="px-3 py-2">Tên hàng</th><th className="px-3 py-2">ĐVT</th><th className="px-3 py-2 text-right">Tồn cuối kỳ</th><th className="px-3 py-2 text-right">Giá trị</th><th className="px-3 py-2">Trạng thái</th></tr></thead>
                <tbody>{parsed.rows.slice(0, 10).map((row) => {
                  const duplicate = existingBySku.has(normalizeSku(row.sku));
                  return <tr key={`${row.sourceRow}-${row.sku}`} className="border-t border-slate-100"><td className="px-3 py-2 font-semibold">{row.sku}</td><td className="px-3 py-2 min-w-56">{row.name}</td><td className="px-3 py-2">{row.unit}</td><td className="px-3 py-2 text-right">{row.closingQuantity.toLocaleString('vi-VN')}</td><td className="px-3 py-2 text-right">{row.closingValue.toLocaleString('vi-VN')}</td><td className="px-3 py-2">{duplicate ? <span className="text-amber-700">Mã đã có</span> : <span className="text-emerald-700">Mới</span>}</td></tr>;
                })}</tbody>
              </table>
              {parsed.rows.length > 10 && <p className="px-3 py-2 bg-slate-50 text-xs text-slate-500">Đang xem 10 dòng đầu trong tổng số {parsed.rows.length} dòng.</p>}
            </div>
          </>}
        </div>

        <div className="px-5 sm:px-7 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <p className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500"><CheckCircle2 className="w-4 h-4 text-emerald-600" />Không tạo hóa đơn hoặc lịch sử nhập/xuất</p>
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} disabled={isImporting} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200">Hủy</button>
            <button onClick={() => void confirmImport()} disabled={!parsed || importableRows.length === 0 || isImporting} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
              {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}{isImporting ? 'Đang nhập…' : `Xác nhận nhập ${importableRows.length} mặt hàng`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
