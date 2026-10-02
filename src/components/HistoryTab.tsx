import React, { useState } from 'react';
import { 
  History, ArrowDownLeft, ArrowUpRight, Search, FileText, Calendar, 
  Building2, ChevronDown, ChevronUp, Download, CheckCircle2, Trash2 
} from 'lucide-react';
import { Invoice } from '../types';

interface HistoryTabProps {
  invoices: Invoice[];
  onExportExcel: () => void;
  onDeleteInvoice?: (id: string) => void;
  onClearAllInvoices?: () => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ invoices, onExportExcel, onDeleteInvoice, onClearAllInvoices }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedInvoiceId(expandedInvoiceId === id ? null : id);
  };

  const safeInvoices = Array.isArray(invoices) ? invoices : [];

  const filteredInvoices = safeInvoices.filter((inv) => {
    if (!inv) return false;
    const matchesSearch =
      (inv.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.partnerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.partnerTaxCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.symbol || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (typeFilter === 'INBOUND') return inv.type === 'INBOUND';
    if (typeFilter === 'OUTBOUND') return inv.type === 'OUTBOUND';
    return true;
  });

  const totalInboundAmount = safeInvoices
    .filter((inv) => inv && inv.type === 'INBOUND')
    .reduce((sum, inv) => sum + (inv.totalWithTax || 0), 0);

  const totalOutboundAmount = safeInvoices
    .filter((inv) => inv && inv.type === 'OUTBOUND')
    .reduce((sum, inv) => sum + (inv.totalWithTax || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-1">
              Tổng Số Hóa Đơn VAT
            </p>
            <h3 className="text-3xl font-black text-white tracking-tight">
              {safeInvoices.length} <span className="text-xs font-semibold text-slate-400">chứng từ</span>
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-blue-400 border border-slate-700 flex items-center justify-center font-bold">
            <History className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
              Tổng Tiền Nhập Mua Vào (Có VAT)
            </p>
            <h3 className="text-2xl font-black text-emerald-900 tracking-tight">
              {totalInboundAmount.toLocaleString('vi-VN')} <span className="text-xs font-semibold text-slate-500">VNĐ</span>
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider mb-1">
              Tổng Tiền Xuất Bán Ra (Có VAT)
            </p>
            <h3 className="text-2xl font-black text-rose-900 tracking-tight">
              {totalOutboundAmount.toLocaleString('vi-VN')} <span className="text-xs font-semibold text-slate-500">VNĐ</span>
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bento Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Số HĐ VAT, Tên doanh nghiệp, Mã số thuế..."
            className="w-full pl-11 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                typeFilter === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({safeInvoices.length})
            </button>
            <button
              onClick={() => setTypeFilter('INBOUND')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1 ${
                typeFilter === 'INBOUND' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Nhập Mua</span>
            </button>
            <button
              onClick={() => setTypeFilter('OUTBOUND')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1 ${
                typeFilter === 'OUTBOUND' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Xuất Bán</span>
            </button>
          </div>

          <button
            onClick={onExportExcel}
            className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Xuất Excel</span>
          </button>

          {safeInvoices.length > 0 && onClearAllInvoices && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XÓA TẤT CẢ ${safeInvoices.length} hóa đơn VAT khỏi CSDL SQLite?\n\nToàn bộ chứng từ sẽ bị xóa sạch khỏi CSDL và tồn kho sẽ được cập nhật!`)) {
                  onClearAllInvoices();
                }
              }}
              className="px-3.5 py-2.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 rounded-2xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Xóa toàn bộ lịch sử hóa đơn trong SQLite"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa Tất Cả Hóa Đơn</span>
            </button>
          )}
        </div>
      </div>

      {/* Invoice Table List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium">
            Không có hóa đơn VAT nào khớp với tìm kiếm.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Thời gian nạp</th>
                  <th className="px-4 py-3.5">Loại</th>
                  <th className="px-4 py-3.5">Số HĐ</th>
                  <th className="px-4 py-3.5">Ký hiệu</th>
                  <th className="px-4 py-3.5">Đối tác</th>
                  <th className="px-4 py-3.5 text-right">Tổng tiền (VNĐ)</th>
                  <th className="px-4 py-3.5 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredInvoices.map((inv) => {
                  const isExpanded = expandedInvoiceId === inv.id;
                  const isInbound = inv.type === 'INBOUND';

                  return (
                    <React.Fragment key={inv.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-slate-600 whitespace-nowrap">
                          {inv.date}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1 ${
                              isInbound
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isInbound ? (
                              <>
                                <ArrowDownLeft className="w-3 h-3" />
                                Mua vào
                              </>
                            ) : (
                              <>
                                <ArrowUpRight className="w-3 h-3" />
                                Bán ra
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-black text-slate-900 whitespace-nowrap">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-700 whitespace-nowrap">
                          {inv.symbol || 'N/A'}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-800 line-clamp-1">{inv.partnerName}</div>
                          {inv.partnerTaxCode && (
                            <div className="text-[11px] text-slate-400 font-mono">MST: {inv.partnerTaxCode}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                          {(inv.totalWithTax || 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleExpand(inv.id)}
                              className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                              title="Xem chi tiết sản phẩm"
                            >
                              <span>Chi tiết</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                              )}
                            </button>

                            {onDeleteInvoice && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    confirm(
                                      'Bạn có chắc chắn muốn xóa hóa đơn này? Số lượng tồn kho sẽ được trừ ngược lại.'
                                    )
                                  ) {
                                    onDeleteInvoice(inv.id || inv.invoiceNumber);
                                  }
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 rounded-lg border border-rose-200 transition-all flex items-center gap-1 cursor-pointer shadow-2xs group"
                                title="Xóa hóa đơn và trừ/khôi phục lại số lượng hàng trong kho"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600 group-hover:text-white" />
                                <span>Xóa</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Invoice Expanded Item Breakdown Table */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-0 bg-slate-50/80">
                            <div className="p-5 border-t border-b border-slate-200 space-y-3">
                              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                Chi tiết sản phẩm trong Hóa Đơn Số {inv.invoiceNumber} ({(inv.items || []).length} mặt hàng)
                              </h4>

                              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-100 text-slate-700 font-semibold uppercase">
                                    <tr>
                                      <th className="px-3 py-2">STT</th>
                                      <th className="px-3 py-2">Mã SKU</th>
                                      <th className="px-3 py-2">Tên sản phẩm</th>
                                      <th className="px-3 py-2 text-center">ĐVT</th>
                                      <th className="px-3 py-2 text-right">Số lượng</th>
                                      <th className="px-3 py-2 text-right">Đơn giá (VNĐ)</th>
                                      <th className="px-3 py-2 text-right">Thành tiền</th>
                                      <th className="px-3 py-2 text-center">VAT (%)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-mono">
                                    {(Array.isArray(inv.items) ? inv.items : []).map((item, idx) => (
                                      <tr key={item.id || idx} className="hover:bg-slate-50">
                                        <td className="px-3 py-2 text-slate-400 text-center">{idx + 1}</td>
                                        <td className="px-3 py-2 font-semibold text-slate-800">{item.sku}</td>
                                        <td className="px-3 py-2 text-slate-900 font-sans">{item.name}</td>
                                        <td className="px-3 py-2 text-center font-sans">{item.unit}</td>
                                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                                          {(item.quantity || 0).toLocaleString('vi-VN', { maximumFractionDigits: 4 })}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          {(item.unitPrice || 0).toLocaleString('vi-VN', { maximumFractionDigits: 4 })}
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold">
                                          {((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString('vi-VN', { maximumFractionDigits: 4 })}
                                        </td>
                                        <td className="px-3 py-2 text-center font-bold text-blue-600">{item.vatRate ?? 8}%</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-2 font-mono">
                                <div>
                                  Trước thuế: <b>{(inv.totalBeforeTax || 0).toLocaleString('vi-VN')} VNĐ</b> | Tiền VAT: <b>{(inv.vatAmount || 0).toLocaleString('vi-VN')} VNĐ</b>
                                </div>
                                <div className="text-slate-800 font-bold font-sans">
                                  Cộng tiền thanh toán: <span className="text-blue-700 text-sm font-mono">{(inv.totalWithTax || 0).toLocaleString('vi-VN')} VNĐ</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
