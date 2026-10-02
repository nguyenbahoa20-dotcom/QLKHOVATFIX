import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, FileText, X, ArrowRight, ShieldCheck, FileCode } from 'lucide-react';

export interface FileProcessingResult {
  fileName: string;
  fileType: 'XML' | 'PDF';
  status: 'SUCCESS' | 'DUPLICATE' | 'ERROR';
  invoiceNumber?: string;
  symbol?: string;
  sellerName?: string;
  errorMessage?: string;
}

export interface UploadBatchSummary {
  totalFiles: number;
  successCount: number;
  duplicateCount: number;
  errorCount: number;
  results: FileProcessingResult[];
}

interface UploadSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewInventory: () => void;
  summary: UploadBatchSummary | null;
}

export const UploadSummaryModal: React.FC<UploadSummaryModalProps> = ({
  isOpen,
  onClose,
  onViewInventory,
  summary,
}) => {
  if (!isOpen || !summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200/80 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold tracking-tight truncate text-white">
                Kết Quả Nạp Hàng Loạt Hóa Đơn Điện Tử (.XML & .PDF)
              </h3>
              <p className="text-xs text-slate-300 font-medium truncate">
                Tự động bóc tách & lọc bỏ hóa đơn bị trùng lặp trong CSDL VAT
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Đóng Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Metric Cards */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tổng file xử lý</div>
            <div className="text-xl font-black text-slate-900 mt-1">{summary.totalFiles} <span className="text-xs font-normal text-slate-500">file</span></div>
          </div>

          <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200/80 shadow-xs">
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
               Thành công
            </div>
            <div className="text-xl font-black text-emerald-700 mt-1">{summary.successCount} <span className="text-xs font-normal text-emerald-600">HĐ mới</span></div>
          </div>

          <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/80 shadow-xs">
            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
               Bỏ qua (Trùng)
            </div>
            <div className="text-xl font-black text-amber-700 mt-1">{summary.duplicateCount} <span className="text-xs font-normal text-amber-600">file</span></div>
          </div>

          <div className="bg-rose-50/80 p-3.5 rounded-2xl border border-rose-200/80 shadow-xs">
            <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
               Lỗi / Không đọc
            </div>
            <div className="text-xl font-black text-rose-700 mt-1">{summary.errorCount} <span className="text-xs font-normal text-rose-600">file</span></div>
          </div>
        </div>

        {/* Detailed File Results List */}
        <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-2.5">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
            Chi tiết trạng thái từng file ({summary.results.length}):
          </h4>

          {summary.results.map((res, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 text-xs transition-colors ${
                res.status === 'SUCCESS'
                  ? 'bg-emerald-50/40 border-emerald-200/80'
                  : res.status === 'DUPLICATE'
                  ? 'bg-amber-50/40 border-amber-200/80'
                  : 'bg-rose-50/40 border-rose-200/80'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0">
                  {res.status === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  {res.status === 'DUPLICATE' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                  {res.status === 'ERROR' && <XCircle className="w-4 h-4 text-rose-600" />}
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 truncate max-w-[280px]" title={res.fileName}>
                      {res.fileName}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      res.fileType === 'XML' ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {res.fileType}
                    </span>
                  </div>

                  {res.status === 'SUCCESS' && (
                    <p className="text-emerald-800 font-medium">
                      Đã bóc tách & nhập kho: Số HĐ <b className="text-emerald-950">{res.invoiceNumber}</b> (Ký hiệu: {res.symbol || 'N/A'}) - {res.sellerName}
                    </p>
                  )}

                  {res.status === 'DUPLICATE' && (
                    <p className="text-amber-800 font-medium">
                      Bỏ qua do đã tồn tại trong CSDL: Hóa đơn số <b className="text-amber-950">{res.invoiceNumber}</b> (Ký hiệu: {res.symbol || 'N/A'})
                    </p>
                  )}

                  {res.status === 'ERROR' && (
                    <p className="text-rose-700 font-semibold">
                      Lỗi: {res.errorMessage || 'File không đọc được hoặc không phải hóa đơn điện tử hợp lệ.'}
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  res.status === 'SUCCESS'
                    ? 'bg-emerald-600 text-white'
                    : res.status === 'DUPLICATE'
                    ? 'bg-amber-500 text-white'
                    : 'bg-rose-600 text-white'
                }`}>
                  {res.status === 'SUCCESS' ? 'Thành Công' : res.status === 'DUPLICATE' ? 'Đã Trùng' : 'Lỗi File'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <FileCode className="w-4 h-4 text-blue-600" />
            <span>Tất cả hóa đơn hợp lệ đã được lưu tự động vào CSDL SQLite <b>vat_database.db</b>.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <button
              onClick={() => {
                onClose();
                onViewInventory();
              }}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <span>Đóng & Xem Kho VAT</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
