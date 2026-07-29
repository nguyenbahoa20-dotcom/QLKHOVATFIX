import React, { useState } from 'react';
import { 
  History, ArrowDownLeft, ArrowUpRight, Search, FileText, Calendar, 
  Building2, ChevronDown, ChevronUp, Download, CheckCircle2 
} from 'lucide-react';
import { Invoice } from '../types';

interface HistoryTabProps {
  invoices: Invoice[];
  onExportExcel: () => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ invoices, onExportExcel }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedInvoiceId(expandedInvoiceId === id ? null : id);
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.partnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.partnerTaxCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.symbol.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (typeFilter === 'INBOUND') return inv.type === 'INBOUND';
    if (typeFilter === 'OUTBOUND') return inv.type === 'OUTBOUND';
    return true;
  });

  const totalInboundAmount = invoices
    .filter((inv) => inv.type === 'INBOUND')
    .reduce((sum, inv) => sum + inv.totalWithTax, 0);

  const totalOutboundAmount = invoices
    .filter((inv) => inv.type === 'OUTBOUND')
    .reduce((sum, inv) => sum + inv.totalWithTax, 0);

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
              {invoices.length} <span className="text-xs font-semibold text-slate-400">chứng từ</span>
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
              Tất cả ({invoices.length})
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
        </div>
      </div>

      {/* Invoice Bento Cards */}
      <div className="space-y-4">
        {filteredInvoices.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-500 font-medium">
            Không có hóa đơn VAT nào khớp với tìm kiếm.
          </div>
        ) : (
          filteredInvoices.map((inv) => {
            const isExpanded = expandedInvoiceId === inv.id;
            const isInbound = inv.type === 'INBOUND';

            return (
              <div
                key={inv.id}
                className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md hover:border-slate-300 transition-all"
              >
                {/* Invoice Card Header */}
                <div
                  onClick={() => toggleExpand(inv.id)}
                  className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold ${
                        isInbound
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {isInbound ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            isInbound
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isInbound ? 'Hóa Đơn Mua Vào (Nhập)' : 'Hóa Đơn Bán Ra (Xuất)'}
                        </span>

                        <span className="font-mono text-sm font-extrabold text-slate-900">
                          Mẫu: {inv.symbol} - Số: {inv.invoiceNumber}
                        </span>

                        <span className="text-xs text-slate-400 font-mono">
                          ({inv.date})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-800">{inv.partnerName}</span>
                        <span className="text-slate-400">| MST: {inv.partnerTaxCode}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-right">
                      <p className="text-[11px] text-slate-500 font-medium">Tổng tiền có VAT</p>
                      <p className="text-base font-extrabold text-slate-900 font-mono">
                        {inv.totalWithTax.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500">VNĐ</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 text-[10px] font-medium bg-slate-100 text-slate-600 rounded border border-slate-200">
                        Nguồn: {inv.source}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Invoice Expanded Item Breakdown Table */}
                {isExpanded && (
                  <div className="bg-slate-50/80 border-t border-slate-200 p-5 space-y-3">
                    <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Chi tiết sản phẩm trong hóa đơn ({inv.items.length} mặt hàng)
                    </h4>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
                          {inv.items.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-400 text-center">{idx + 1}</td>
                              <td className="px-3 py-2 font-semibold text-slate-800">{item.sku}</td>
                              <td className="px-3 py-2 text-slate-900 font-sans">{item.name}</td>
                              <td className="px-3 py-2 text-center font-sans">{item.unit}</td>
                              <td className="px-3 py-2 text-right font-bold text-slate-900">{item.quantity}</td>
                              <td className="px-3 py-2 text-right">{item.unitPrice.toLocaleString('vi-VN')}</td>
                              <td className="px-3 py-2 text-right font-semibold">
                                {(item.quantity * item.unitPrice).toLocaleString('vi-VN')}
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-blue-600">{item.vatRate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-2 font-mono">
                      <div>
                        Trước thuế: <b>{inv.totalBeforeTax.toLocaleString('vi-VN')} VNĐ</b> | Tiền VAT: <b>{inv.vatAmount.toLocaleString('vi-VN')} VNĐ</b>
                      </div>
                      <div className="text-slate-800 font-bold font-sans">
                        Cộng tiền thanh toán: <span className="text-blue-700 text-sm font-mono">{inv.totalWithTax.toLocaleString('vi-VN')} VNĐ</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
