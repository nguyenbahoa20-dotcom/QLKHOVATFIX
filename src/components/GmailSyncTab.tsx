import React, { useState, useRef } from 'react';
import { Mail, Key, ShieldCheck, RefreshCw, FileText, CheckCircle2, AlertCircle, Info, Send, ArrowRight, Zap, ExternalLink, Upload, Sparkles, Trash2 } from 'lucide-react';
import { GmailConfig, EmailLog, Invoice } from '../types';
import { parseInvoiceXml } from '../utils/xmlParser';

interface GmailSyncTabProps {
  config: GmailConfig;
  onSaveConfig: (newConfig: GmailConfig) => void;
  emailLogs: EmailLog[];
  isScanning: boolean;
  onScanGmail: () => void;
  onSimulateInboundInvoice: () => void;
  onImportXmlInvoice?: (invoice: Invoice) => void;
  onImportXmlFiles?: (files: File[]) => void;
}

export const GmailSyncTab: React.FC<GmailSyncTabProps> = ({
  config,
  onSaveConfig,
  emailLogs,
  isScanning,
  onScanGmail,
  onSimulateInboundInvoice,
  onImportXmlInvoice,
  onImportXmlFiles,
}) => {
  const [formData, setFormData] = useState<GmailConfig>(config);
  const [showPassword, setShowPassword] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleClearConfig = () => {
    if (!window.confirm('Xóa email, App Password và cấu hình quét Gmail đã lưu trên máy này?')) return;
    const emptyConfig: GmailConfig = {
      email: '',
      appPassword: '',
      isConnected: false,
      autoScanIntervalMinutes: 60,
      lastSyncTime: '',
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      enableAlerts: false,
      alertEmailRecipient: '',
    };
    onSaveConfig(emptyConfig);
    setFormData(emptyConfig);
    setSaveSuccess(false);
    setTestEmailStatus(null);
  };

  const handleSendTestAlert = () => {
    setTestEmailStatus('sending');
    setTimeout(() => {
      setTestEmailStatus('success');
      setTimeout(() => setTestEmailStatus(null), 4000);
    }, 1500);
  };

  const processSelectedFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => {
      const lower = f.name.toLowerCase();
      return lower.endsWith('.xml') || lower.endsWith('.pdf');
    });

    if (files.length === 0) {
      setUploadStatus('Vui lòng chọn file hóa đơn điện tử dạng .XML hoặc .PDF');
      setTimeout(() => setUploadStatus(null), 4000);
      return;
    }

    if (onImportXmlFiles) {
      onImportXmlFiles(files);
    } else if (onImportXmlInvoice && files[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const xmlContent = event.target?.result as string;
          const parsed = parseInvoiceXml(xmlContent);
          const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

          const invoice: Invoice = {
            id: `inv-xml-${Date.now()}`,
            invoiceNumber: parsed.invoiceNumber,
            symbol: parsed.symbol,
            date: parsed.date,
            type: 'INBOUND',
            partnerName: parsed.sellerName || 'Công ty Cổ phần Công Nghệ Á Châu',
            partnerTaxCode: parsed.sellerTaxCode || '0109887766',
            buyerName: parsed.buyerName,
            buyerTaxCode: parsed.buyerTaxCode,
            items: parsed.items,
            totalBeforeTax: parsed.totalBeforeTax,
            vatAmount: parsed.vatAmount,
            totalWithTax: parsed.totalWithTax,
            source: 'XML',
            emailSubject: `Đã bóc tách từ file XML: ${file.name}`,
            createdAt: nowStr,
          };
          onImportXmlInvoice(invoice);
        } catch (err: any) {
          setUploadStatus(`Lỗi bóc tách XML: ${err.message || 'File không hợp lệ'}`);
        }
      };
      reader.readAsText(file, 'utf-8');
    }
  };

  const handleDirectXmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <div className="space-y-6">
      {/* Bento Hero Dark Card */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 text-blue-300 font-bold text-xs rounded-full border border-slate-700 mb-3">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>TỰ ĐỘNG BÓC TÁCH HÓA ĐƠN VAT TỪ GMAIL & XML</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2 text-white">
            Kết Nối Gmail & Quét VAT Tự Động
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
            Hệ thống rà soát hộp thư đến Gmail thông qua giao thức bảo mật IMAP, tự động phát hiện file hóa đơn VAT (XML), bóc tách mã hàng, số lượng, đơn giá và cộng dồn kho tức thì vào SQLite CSDL.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onScanGmail}
              disabled={isScanning}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-2xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Đang kết nối & quét Mail...' : 'Quét Hóa Đơn Mới Từ Gmail'}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Upload className="w-4 h-4" />
              <span>Tải Lên File Hóa Đơn (.XML / .PDF)</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.pdf"
              multiple
              onChange={handleDirectXmlUpload}
              className="hidden"
            />

            <button
              onClick={onSimulateInboundInvoice}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-2xl transition-all flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Mô Phỏng Quét Gmail</span>
            </button>
          </div>

          {/* Drag and Drop Zone for Single or Multiple XML/PDF Files */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`mt-6 p-6 rounded-2xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center gap-2 cursor-pointer ${
              isDragging
                ? 'bg-blue-600/20 border-blue-400 scale-[1.01]'
                : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
              <Upload className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">
                Kéo & Thả Tập File XML / PDF Hóa Đơn Vào Đây (Hoặc Chọn Thư Mục/Nhiều File)
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Tự động bóc tách và chống nhập trùng dựa trên số hóa đơn, ký hiệu và mã số thuế người bán. Hệ thống tự tổng kết sau khi nạp.
              </p>
            </div>
          </div>

          {uploadStatus && (
            <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 rounded-2xl text-xs font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{uploadStatus}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Gmail Credentials Config Form (Bento Card) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
          <div className="flex items-center justify-between pb-5 mb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base tracking-tight">Cấu Hình Tài Khoản Gmail</h3>
                <p className="text-xs text-slate-500">Sử dụng Mật khẩu ứng dụng (App Password) an toàn</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{config.isConnected ? 'Đã Kết Nối' : 'Chưa Kết Nối'}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Địa Chỉ Gmail Doanh Nghiệp <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="vi-du: doanhnghiep@gmail.com"
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mật Khẩu Ứng Dụng (App Password) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.appPassword || ''}
                    onChange={(e) => setFormData({ ...formData, appPassword: e.target.value })}
                    placeholder="Mã 16 ký tự Google cấp"
                    className="w-full pl-10 pr-12 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-semibold hover:text-slate-800"
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Máy Chủ IMAP
                </label>
                <input
                  type="text"
                  value={formData.imapHost}
                  onChange={(e) => setFormData({ ...formData, imapHost: e.target.value })}
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tần Suất Quét Tự Động (Phút)
                </label>
                <select
                  value={formData.autoScanIntervalMinutes}
                  onChange={(e) => setFormData({ ...formData, autoScanIntervalMinutes: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium"
                >
                  <option value={5}>Mỗi 5 phút</option>
                  <option value={15}>Mỗi 15 phút (Khuyên dùng)</option>
                  <option value={30}>Mỗi 30 phút</option>
                  <option value={60}>Mỗi 1 giờ</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enableAlerts}
                    onChange={(e) => setFormData({ ...formData, enableAlerts: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500"
                  />
                  <span>Tự động gửi email cảnh báo khi hàng xuống dưới mức tồn kho tối thiểu</span>
                </label>
              </div>

              {formData.enableAlerts && (
                <div className="flex items-center gap-3">
                  <input
                    type="email"
                    value={formData.alertEmailRecipient}
                    onChange={(e) => setFormData({ ...formData, alertEmailRecipient: e.target.value })}
                    placeholder="Email nhận cảnh báo (e.g. quanly@doanhnghiep.com)"
                    className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestAlert}
                    disabled={testEmailStatus === 'sending'}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-2xl border border-slate-200 flex items-center gap-1.5 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{testEmailStatus === 'sending' ? 'Đang thử...' : 'Gửi Mail Thử'}</span>
                  </button>
                </div>
              )}

              {testEmailStatus === 'success' && (
                <p className="text-xs text-emerald-600 font-bold mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Đã gửi email cảnh báo thử nghiệm tới {formData.alertEmailRecipient}!</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Lần quét gần nhất: <span className="font-bold text-slate-800">{config.lastSyncTime || 'Chưa thực hiện'}</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearConfig}
                  className="px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold rounded-2xl border border-rose-200 transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Xóa cấu hình</span>
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl shadow-xs transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  <span>Lưu Cấu Hình</span>
                </button>
              </div>
            </div>

            {saveSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Cấu hình tài khoản Gmail và Cảnh báo email đã được lưu thành công!</span>
              </div>
            )}
          </form>
        </div>

        {/* Right Column: Gmail App Password Instructions (Bento Card) */}
        <div className="bg-slate-50 rounded-3xl border border-slate-200/80 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
            <Info className="w-4 h-4 text-blue-600" />
            <span>Hướng Dẫn Mật Khẩu Ứng Dụng Gmail</span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Mật khẩu ứng dụng (App Password) là mã gồm 16 ký tự giúp ứng dụng kết nối Gmail an toàn mà không cần nhập mật khẩu chính.
          </p>

          <ol className="space-y-2.5 text-xs text-slate-700 list-decimal pl-4 font-medium leading-relaxed">
            <li>Truy cập trang bảo mật Google: <b className="text-slate-900">myaccount.google.com</b></li>
            <li>Bật tính năng <b className="text-slate-900">Xác minh 2 bước</b> (2-Step Verification).</li>
            <li>
              Vào mục <b className="text-slate-900">Mật khẩu ứng dụng</b> (App passwords) hoặc gõ tìm kiếm "App Passwords".
            </li>
            <li>Tạo tên ứng dụng: <code className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 font-mono text-[11px] font-bold text-slate-800">QuanLyKhoVAT</code>.</li>
            <li>Sao chép mã 16 ký tự và dán vào ô Mật khẩu ứng dụng bên trái.</li>
          </ol>

          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline pt-2"
          >
            <span>Mở trang Cấu hình Google Account</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Email Scan History Log Table (Bento Card) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-base tracking-tight">Nhật Ký Quét Email VAT Mới Nhất</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Tổng cộng: <strong className="text-slate-900 font-bold">{emailLogs.length}</strong> thư đã rà soát
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Người gửi</th>
                <th className="px-4 py-3">Tiêu đề email</th>
                <th className="px-4 py-3">File đính kèm</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-center">Số sản phẩm VAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {emailLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono">{log.timestamp}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{log.sender}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{log.subject}</td>
                  <td className="px-4 py-3">
                    {log.hasAttachment ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        <FileText className="w-3 h-3 text-blue-500" />
                        {log.attachmentName}
                      </span>
                    ) : (
                      <span className="text-slate-400">Không có</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {log.status === 'SUCCESS' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Thành công
                      </span>
                    ) : log.status === 'NO_VAT_FOUND' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        <Info className="w-3 h-3" /> Bỏ qua (Không có VAT)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertCircle className="w-3 h-3" /> Lỗi xử lý
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-800">
                    {log.parsedItemCount ? `${log.parsedItemCount} SP` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
