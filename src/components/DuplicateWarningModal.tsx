import React from 'react';
import { ShieldAlert, X, AlertTriangle, FileText, Building2, Ban, RefreshCw } from 'lucide-react';

export interface DuplicateInvoiceInfo {
  invoiceNumber: string;
  symbol: string;
  partnerName: string;
  partnerTaxCode: string;
  companyName?: string;
  fileName?: string;
  invoiceId?: string;
}

interface DuplicateWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOverwrite?: () => void;
  duplicateInfo: DuplicateInvoiceInfo | null;
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  isOpen,
  onClose,
  onOverwrite,
  duplicateInfo,
}) => {
  if (!isOpen || !duplicateInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-rose-200 w-full max-w-lg flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header Alert Banner */}
        <div className="bg-rose-900 text-white p-5 border-b border-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <ShieldAlert className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight text-white">
                Cảnh Báo: Hóa Đơn VAT Đã Tồn Tại
              </h3>
              <p className="text-xs text-rose-200 font-medium">
                Phát hiện trùng lặp dữ liệu trong kho VAT
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-rose-300 hover:text-white hover:bg-rose-800 transition-colors cursor-pointer"
            title="Đóng Hộp Thoại"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-slate-800 text-xs sm:text-sm">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-extrabold text-rose-950 text-xs sm:text-sm leading-snug">
                Hóa đơn số <span className="font-black text-rose-700">{duplicateInfo.invoiceNumber}</span> (Ký hiệu: <span className="font-black text-rose-700">{duplicateInfo.symbol || 'C26TBA'}</span>) từ <span className="font-black text-rose-950">{duplicateInfo.partnerName || 'Đối tác VAT'}</span> {duplicateInfo.partnerTaxCode ? `(MST: ${duplicateInfo.partnerTaxCode})` : ''} đã tồn tại trong kho của công ty này.
              </p>
              <p className="text-xs text-rose-800 font-medium pt-1">
                Nếu bạn muốn cập nhật/nạp lại danh mục mặt hàng từ XML này vào Kho VAT, hãy chọn nút <b>"Ghi Đè & Cập Nhật Lại Kho"</b> bên dưới.
              </p>
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                Số Hóa Đơn & Ký Hiệu:
              </span>
              <span className="font-extrabold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                {duplicateInfo.invoiceNumber} / {duplicateInfo.symbol || 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />
                Người Bán (Nhà Cung Cấp):
              </span>
              <span className="font-bold text-slate-800 text-right max-w-[200px] truncate">
                {duplicateInfo.partnerName}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-semibold">Mã Số Thuế (MST):</span>
              <span className="font-bold text-slate-800">{duplicateInfo.partnerTaxCode || 'N/A'}</span>
            </div>

            {duplicateInfo.companyName && (
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500 font-semibold">Thuộc Kho Công Ty:</span>
                <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  {duplicateInfo.companyName}
                </span>
              </div>
            )}
          </div>

          {/* Safety badge */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-bold">
            <Ban className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Toàn bộ tồn kho và lịch sử hóa đơn giữ nguyên trừ khi bạn bấm Ghi Đè.</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Đóng & Bỏ Qua
          </button>

          {onOverwrite && (
            <button
              onClick={() => {
                onOverwrite();
                onClose();
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Ghi Đè & Cập Nhật Lại Kho</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
