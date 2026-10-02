import React, { useState, useEffect } from 'react';
import { X, FileText, Plus, Trash2, Upload, Check, ArrowDownLeft, ArrowUpRight, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Invoice, InvoiceItem, InvoiceType } from '../types';
import { parseInvoiceXml } from '../utils/xmlParser';

interface InvoiceModalProps {
  isOpen: boolean;
  defaultType: InvoiceType;
  onClose: () => void;
  onSaveInvoice: (invoice: Invoice) => void;
  onImportXmlFiles?: (files: File[]) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  defaultType,
  onClose,
  onSaveInvoice,
  onImportXmlFiles,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [type, setType] = useState<InvoiceType>(defaultType);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [symbol, setSymbol] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [partnerName, setPartnerName] = useState('');
  const [partnerTaxCode, setPartnerTaxCode] = useState('');
  const [xmlFileName, setXmlFileName] = useState<string | null>(null);
  const [xmlStatus, setXmlStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Function to completely reset form to empty / 0
  const resetForm = (newType: InvoiceType = defaultType) => {
    setType(newType);
    setInvoiceNumber('000' + Math.floor(1000 + Math.random() * 9000));
    setSymbol('C26TBA');
    setDate(new Date().toISOString().slice(0, 10));
    setPartnerName('');
    setPartnerTaxCode('');
    setXmlFileName(null);
    setXmlStatus(null);
    setItems([
      {
        id: 'item-' + Date.now(),
        sku: '',
        name: '',
        unit: 'Cái',
        quantity: 0,
        unitPrice: 0,
        vatRate: 10,
        totalAmount: 0,
      }
    ]);
  };

  // Reset form whenever modal opens or defaultType changes
  useEffect(() => {
    if (isOpen) {
      resetForm(defaultType);
    }
  }, [isOpen, defaultType]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: 'item-' + Date.now(),
        sku: '',
        name: '',
        unit: 'Cái',
        quantity: 0,
        unitPrice: 0,
        vatRate: 10,
        totalAmount: 0,
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      // Clear item values instead of deleting sole row
      setItems([{
        id: 'item-' + Date.now(),
        sku: '',
        name: '',
        unit: 'Cái',
        quantity: 0,
        unitPrice: 0,
        vatRate: 10,
        totalAmount: 0,
      }]);
      return;
    }
    setItems(items.filter((it) => it.id !== id));
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(
      items.map((it) => {
        if (it.id === id) {
          const updated = { ...it, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            const q = field === 'quantity' ? Number(value) : Number(it.quantity);
            const p = field === 'unitPrice' ? Number(value) : Number(it.unitPrice);
            updated.totalAmount = q * p;
          }
          return updated;
        }
        return it;
      })
    );
  };

  const totalBeforeTax = items.reduce((sum, item) => sum + (item.totalAmount || item.quantity * item.unitPrice), 0);
  const totalVat = items.reduce(
    (sum, item) => sum + ((item.totalAmount || item.quantity * item.unitPrice) * item.vatRate) / 100,
    0
  );
  const totalWithTax = totalBeforeTax + totalVat;

  const handleCloseModal = () => {
    resetForm(defaultType);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter(it => it.sku.trim() !== '' || it.name.trim() !== '' || it.quantity > 0);
    const finalItems = validItems.length > 0 ? validItems : items;

    const newInvoice: Invoice = {
      id: 'inv-' + Date.now(),
      invoiceNumber: invoiceNumber || '000' + Math.floor(1000 + Math.random() * 9000),
      symbol: symbol || 'C26TBA',
      date,
      type,
      partnerName: partnerName || (type === 'INBOUND' ? 'Nhà cung cấp VAT' : 'Khách hàng VAT'),
      partnerTaxCode,
      items: finalItems,
      totalBeforeTax,
      vatAmount: totalVat,
      totalWithTax,
      source: xmlFileName ? 'XML' : 'MANUAL',
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };

    onSaveInvoice(newInvoice);
    resetForm(defaultType);
    onClose();
  };

  // Real File Upload Parser for XML & PDF VAT e-invoices (Supports Single and Multi-File Selection)
  const processSelectedFiles = async (rawFiles: File[]) => {
    const validFiles = Array.from(rawFiles || []).filter((f) => {
      const lower = f.name.toLowerCase();
      return lower.endsWith('.xml') || lower.endsWith('.pdf');
    });

    if (validFiles.length === 0) return;

    // IF MULTIPLE FILES (> 1): Send all files to batch processing, close single invoice modal, and display batch summary
    if (validFiles.length > 1) {
      if (onImportXmlFiles) {
        onClose();
        onImportXmlFiles(validFiles);
      }
      return;
    }

    // IF 1 FILE (validFiles.length === 1): Populate data into single invoice detail form for user verification
    const file = validFiles[0];
    if (file) {
      setXmlFileName(file.name);
      setXmlStatus(null);
      const isPdf = file.name.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const { parsePdfInvoice } = await import('../utils/pdfParser');
          const parsed = await parsePdfInvoice(arrayBuffer);

          if (parsed.invoiceNumber) setInvoiceNumber(parsed.invoiceNumber);
          if (parsed.symbol) setSymbol(parsed.symbol);
          if (parsed.date) setDate(parsed.date);
          if (parsed.sellerName) setPartnerName(parsed.sellerName);
          if (parsed.sellerTaxCode) setPartnerTaxCode(parsed.sellerTaxCode);
          if (parsed.items && parsed.items.length > 0) setItems(parsed.items);

          setXmlStatus({
            type: 'success',
            message: `Đã bóc tách thành công Hóa đơn PDF Số ${parsed.invoiceNumber} từ file ${file.name}.`
          });
        } catch (err: any) {
          setXmlStatus({
            type: 'error',
            message: `Lỗi đọc file PDF: ${err.message || 'File PDF không có text layer hoặc không hợp lệ'}`
          });
        }
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const xmlContent = event.target?.result as string;
            const parsed = parseInvoiceXml(xmlContent);

            if (parsed.invoiceNumber) setInvoiceNumber(parsed.invoiceNumber);
            if (parsed.symbol) setSymbol(parsed.symbol);
            if (parsed.date) setDate(parsed.date);
            if (parsed.sellerName && parsed.sellerName !== 'Nhà Cung Cấp VAT') {
              setPartnerName(parsed.sellerName);
            }
            if (parsed.sellerTaxCode) setPartnerTaxCode(parsed.sellerTaxCode);

            if (parsed.items && parsed.items.length > 0) {
              setItems(parsed.items);
            }

            setXmlStatus({
              type: 'success',
              message: `Đã bóc tách thành công Hóa đơn VAT Số ${parsed.invoiceNumber} từ file ${file.name} (${parsed.items.length} mặt hàng).`
            });
          } catch (err: any) {
            setXmlStatus({
              type: 'error',
              message: `Lỗi khi đọc file XML Hóa Đơn: ${err.message || 'File XML không hợp lệ'}`
            });
          }
        };
        reader.readAsText(file, 'utf-8');
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []) as File[];
    if (rawFiles.length > 0) {
      processSelectedFiles(rawFiles);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const rawFiles = Array.from(e.dataTransfer.files || []) as File[];
    if (rawFiles.length > 0) {
      processSelectedFiles(rawFiles);
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
                  ? 'Tự động bóc tách XML/PDF và cộng dồn số lượng tồn kho SQLite'
                  : 'Tự động trừ số lượng sản phẩm tương ứng khỏi tồn kho SQLite'}
              </p>
            </div>
          </div>

          <button
            onClick={handleCloseModal}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* File upload drag drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.tagName !== 'INPUT' && target.tagName !== 'BUTTON') {
                fileInputRef.current?.click();
              }
            }}
            className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-blue-500 bg-blue-100/60 scale-[1.01]'
                : 'border-blue-200 hover:border-blue-400 bg-blue-50/40'
            }`}
          >
            <div className="flex flex-col items-center justify-center gap-2">
              <Upload className="w-6 h-6 text-blue-600" />
              <div className="text-xs text-slate-700 font-medium">
                Tải lên hoặc Kéo & Thả file <b>XML / PDF Hóa Đơn Điện Tử VAT</b> (Chọn 1 hoặc Nhiều file cùng lúc)
              </div>
              {xmlFileName && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 rounded-full text-xs font-bold border border-emerald-300">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Đã đọc: {xmlFileName}</span>
                </div>
              )}
              {xmlStatus && (
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    xmlStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}
                >
                  {xmlStatus.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  )}
                  <span>{xmlStatus.message}</span>
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors inline-flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>Chọn File XML / PDF Hóa Đơn VAT</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xml,.pdf"
                onChange={handleFileInputChange}
                className="hidden"
              />
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
                placeholder="VD: C26TBA"
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
                placeholder="VD: 0001234"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono font-bold text-blue-700"
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
                placeholder={type === 'INBOUND' ? 'Nhập tên nhà cung cấp' : 'Nhập tên khách mua hàng'}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-medium"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mã Số Thuế Đối Tác</label>
              <input
                type="text"
                value={partnerTaxCode}
                onChange={(e) => setPartnerTaxCode(e.target.value)}
                placeholder="VD: 0109887766"
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>

          {/* Line items list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Danh Sách Sản Phẩm Chi Tiết Từ Hóa Đơn ({items.length} Mặt hàng)
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
                    <th className="px-3 py-2 w-28 text-right">Số Lượng</th>
                    <th className="px-3 py-2 w-36 text-right">Đơn Giá (VNĐ)</th>
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
                          placeholder="MÃ SKU"
                          onChange={(e) => handleItemChange(item.id, 'sku', e.target.value.toUpperCase())}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold"
                        />
                      </td>

                      <td className="px-2 py-2 font-sans">
                        <input
                          type="text"
                          value={item.name}
                          placeholder="Tên sản phẩm"
                          onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-medium"
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
                          step="any"
                          min="0"
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded text-xs text-right font-bold"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.unitPrice === 0 ? '' : item.unitPrice}
                          onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          placeholder="0"
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

                      <td className="px-3 py-2 text-right font-bold text-slate-800 font-mono">
                        {(item.quantity * item.unitPrice).toLocaleString('vi-VN', { maximumFractionDigits: 4 })}
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
              <div>Tiền trước thuế: <b>{totalBeforeTax.toLocaleString('vi-VN', { maximumFractionDigits: 4 })} VNĐ</b></div>
              <div>Tiền thuế VAT: <b>{totalVat.toLocaleString('vi-VN', { maximumFractionDigits: 4 })} VNĐ</b></div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 font-sans block">Tổng Cộng Thanh Toán (Có VAT):</span>
              <span className="text-xl font-black text-emerald-400">
                {totalWithTax.toLocaleString('vi-VN', { maximumFractionDigits: 4 })} VNĐ
              </span>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              * Tự động lưu vào vat_database.db & cộng trừ kho tức thì.
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCloseModal}
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

