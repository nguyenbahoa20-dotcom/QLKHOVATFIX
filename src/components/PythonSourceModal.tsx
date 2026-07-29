import React, { useState } from 'react';
import { X, Copy, Check, Download, Terminal, Info, FileCode, ShieldAlert } from 'lucide-react';
import { PYTHON_STREAMLIT_CODE } from '../data/pythonCode';

interface PythonSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonSourceModal: React.FC<PythonSourceModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(PYTHON_STREAMLIT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPyFile = () => {
    const blob = new Blob([PYTHON_STREAMLIT_CODE], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'app.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200/80 w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold">
              <FileCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                Mã Nguồn Python Streamlit Hoàn Chỉnh
              </h3>
              <p className="text-xs text-slate-300 font-medium">
                Chạy độc lập trên máy tính cá nhân hoặc máy chủ doanh nghiệp
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions banner */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Terminal className="w-4 h-4 text-blue-600" />
              <span>1. Hướng dẫn cài đặt thư viện Python:</span>
            </div>
            <pre className="p-2 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] overflow-x-auto select-all">
              pip install streamlit pandas openpyxl imap-tools
            </pre>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Terminal className="w-4 h-4 text-emerald-600" />
              <span>2. Lệnh khởi chạy ứng dụng:</span>
            </div>
            <pre className="p-2 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] overflow-x-auto select-all">
              streamlit run app.py
            </pre>
          </div>
        </div>

        {/* Actions bar */}
        <div className="px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 font-medium">
            File mã nguồn: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800">app.py</code> (Giao diện Streamlit, Gmail IMAP, Pandas & Cảnh báo Email)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Đã sao chép!' : 'Sao chép Mã'}</span>
            </button>

            <button
              onClick={handleDownloadPyFile}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Tải file app.py</span>
            </button>
          </div>
        </div>

        {/* Code View Area */}
        <div className="p-4 bg-slate-950 overflow-y-auto flex-1 font-mono text-xs text-slate-200 leading-relaxed select-all">
          <pre>{PYTHON_STREAMLIT_CODE}</pre>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>
              Cấu hình Mật khẩu ứng dụng Gmail (App Password 16 ký tự) tại <b>myaccount.google.com/apppasswords</b> để kích hoạt tính năng quét Mail tự động.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
