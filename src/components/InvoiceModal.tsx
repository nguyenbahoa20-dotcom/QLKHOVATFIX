import React, { useState } from 'react';
import { X, FileText, Plus, Trash2, Upload, Check, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Invoice, InvoiceItem, InvoiceType } from '../types';

interface InvoiceModalProps {
  isOpen: boolean;
  defaultType: InvoiceType;
  onClose: () => void;
  onSaveInvoice: (invoice: Invoice) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  defaultType,
  onClose,
  onSaveInvoice,
}) => {
  const [type, setType] = useState<InvoiceType>(defaultType);
  const [invoiceNumber, setInvoiceNumber] = useState('000' + Math.floor(1000 + Math.random() * 9000));
  const [symbol, setSymbol] = useState('C24TBA');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [partnerName, setPartnerName] = useState('Công ty TNHH Công Nghệ Sài Gòn');
  const [partnerTaxCode, setPartnerTaxCode] = useState('0312345678');

  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: 'item-1',
      sku: 'MON-LG-27',
      name: 'Màn hình máy tính LG 27 inch Full HD 100Hz',
      unit: 'Cái',
      quantity: 5,
      unitPrice: 3450000,
      vatRate: 10,
      totalAmount: 17250000,
    }
  ]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: 'item-' + Date.now(),
        sku: 'MOU-LOG-M330',
        name: 'Chuột không dây Logitech M330 Silent',
        unit: 'Cái',
        quantity: 10,
        unitPrice: 290000,
        vatRate: 10,
        totalAmount: 2900000,
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((it) => it.id !== id));
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(
      items.map((it) => {
        if (it.id === id) {
          const updated = { ...it, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updated.totalAmount = Number(updated.quantity) * Number(updated.unitPrice);
          }
          return updated;
        }
        return it;
      })
    );
  };

  const totalBeforeTax = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalVat = items.reduce(
    (sum, item) => sum + (item.quantity * item.unitPrice * item.vatRate) / 100,
    0
  );
  const totalWithTax = totalBeforeTax + totalVat;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newInvoice: Invoice = {
      id: 'inv-' + Date.now(),
      invoiceNumber,
      symbol,
      date,
      type,
      partnerName,
      partnerTaxCode,
      items,
      totalBeforeTax,
      vatAmount: totalVat,
      totalWithTax,
      source: 'XML',
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };

    onSaveInvoice(newInvoice);
    onClose();
  };

  // Simulated File Upload Parse (XML/Excel)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Simulate reading XML e-invoice
      alert(`Đã nhận file ${file.name}. Đang tự động bóc tách dữ liệu VAT...`);
      setItems([
        {
          id: 'item-parsed-1',
          sku: 'LAP-DEL-15',
          name: 'Máy tính xách tay Dell Vostro 15 (i5/16GB/512GB)',
          unit: 'Cái',
          quantity: 12,
          unitPrice: 15500000,
          vatRate: 10,
          totalAmount: 186000000,
        },
        {
          id: 'item-parsed-2',
          sku: 'PAP-A4-70GSM',
          name: 'Giấy in Double A Khổ A4 Định lượng 70gsm',
          unit: 'Ram',
          quantity: 50,
          unitPrice: 75000,
          vatRate: 8,
          totalAmount: 3750000,
        }
      ]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200/80 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white ${
                type === 'INBOUND' ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              {type === 'INBOUND' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                {type === 'INBOUND' ? 'Tải Hóa Đơn VAT Mua Vào (Nhập Kho)' : 'Tải Hóa Đơn VAT Bán Ra (Xuất Kho)'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {type === 'INBOUND'
                  ? 'Tự động cộng dồn số lượng sản phẩm vào kho VAT'
                  : 'Tự động trừ số lượng sản phẩm tương ứng khỏi kho VAT'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* File upload drag drop zone */}
          <div className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/40 rounded-2xl p-4 text-center transition-colors">
            <div className="flex flex-col items-center justify-center gap-2">
              <Upload className="w-6 h-6 text-blue-600" />
              <div className="text-xs text-slate-700 font-medium">
                Kéo thả hoặc tải lên file <b>XML / Excel Hóa Đơn Điện Tử VAT</b>
              </div>
              <label className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs transition-colors">
                <span>Chọn File XML/Excel</span>
                <input
                  type="file"
                  accept=".xml,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Form invoice metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Loại Hóa Đơn</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as InvoiceType)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold"
              >
                <option value="INBOUND">Nhập Kho (Mua vào)</option>
                <option value="OUTBOUND">Xuất Kho (Bán ra)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mẫu/Ký Hiệu</label>
              <input
                type="text"
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Số Hóa Đơn VAT</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày Xuất Hóa Đơn</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {type === 'INBOUND' ? 'Tên Công Ty Bán Hàng (Người Bán)' : 'Tên Công Ty Mua Hàng (Người Mua)'}
              </label>
              <input
                type="text"
                required
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mã Số Thuế Đối Tác</label>
              <input
                type="text"
                required
                value={partnerTaxCode}
                onChange={(e) => setPartnerTaxCode(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>

          {/* Line items list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Danh Sách Sản Phẩm Trong Hóa Đơn
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Thêm Dòng</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase">
                  <tr>
                    <th className="px-3 py-2">Mã SKU</th>
                    <th className="px-3 py-2">Tên Sản Phẩm</th>
                    <th className="px-3 py-2 w-20">ĐVT</th>
                    <th className="px-3 py-2 w-24 text-right">Số Lượng</th>
                    <th className="px-3 py-2 w-32 text-right">Đơn Giá (VNĐ)</th>
                    <th className="px-3 py-2 w-20 text-center">VAT %</th>
                    <th className="px-3 py-2 w-36 text-right">Thành Tiền</th>
                    <th className="px-3 py-2 w-10 text-center">Xóa</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 font-mono">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.sku}
                          onChange={(e) => handleItemChange(item.id, 'sku', e.target.value.toUpperCase())}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold"
                        />
                      </td>

                      <td className="px-2 py-2 font-sans">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-center"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(item.id, 'quantity', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded text-xs text-right font-bold"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(item.id, 'unitPrice', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-right"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <select
                          value={item.vatRate}
                          onChange={(e) => handleItemChange(item.id, 'vatRate', Number(e.target.value))}
                          className="w-full px-1 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-center font-bold text-blue-600"
                        >
                          <option value={8}>8%</option>
                          <option value={10}>10%</option>
                          <option value={0}>0%</option>
                        </select>
                      </td>

                      <td className="px-3 py-2 text-right font-bold text-slate-800">
                        {(item.quantity * item.unitPrice).toLocaleString('vi-VN')}
                      </td>

                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-4 font-mono">
            <div className="text-xs space-y-1">
              <div>Tiền trước thuế: <b>{totalBeforeTax.toLocaleString('vi-VN')} VNĐ</b></div>
              <div>Tiền thuế VAT: <b>{totalVat.toLocaleString('vi-VN')} VNĐ</b></div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 font-sans block">Tổng Cộng Thanh Toán (Có VAT):</span>
              <span className="text-xl font-black text-emerald-400">
                {totalWithTax.toLocaleString('vi-VN')} VNĐ
              </span>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              * Hệ thống sẽ tự động cập nhật số lượng tồn kho tương ứng khi lưu.
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Hủy
              </button>

              <button
                type="submit"
                className={`px-5 py-2 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs ${
                  type === 'INBOUND' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>
                  {type === 'INBOUND' ? 'Xác Nhận Nhập Kho VAT' : 'Xác Nhận Xuất Kho VAT'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
