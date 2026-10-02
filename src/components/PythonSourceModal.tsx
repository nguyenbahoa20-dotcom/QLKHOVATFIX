import React, { useState } from 'react';
import { X, Copy, Check, Download, Terminal, FileCode, Play, Database } from 'lucide-react';
import { PYTHON_FASTAPI_CODE, BAT_RUNNER_CODE, PYTHON_STREAMLIT_CODE } from '../data/pythonCode';

interface PythonSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonSourceModal: React.FC<PythonSourceModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'fastapi' | 'bat' | 'streamlit'>('fastapi');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const getActiveCode = () => {
    if (activeTab === 'fastapi') return PYTHON_FASTAPI_CODE;
    if (activeTab === 'bat') return BAT_RUNNER_CODE;
    return PYTHON_STREAMLIT_CODE;
  };

  const getActiveFilename = () => {
    if (activeTab === 'fastapi') return 'main.py';
    if (activeTab === 'bat') return 'chay_phan_mem.bat';
    return 'app_streamlit.py';
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadFile = () => {
    const filename = getActiveFilename();
    const isBat = filename.endsWith('.bat');
    const blob = new Blob([getActiveCode()], { 
      type: isBat ? 'text/plain;charset=utf-8' : 'text/x-python;charset=utf-8' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200/80 w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Dark Top Section: Header + Distinct Separated Tab Bar */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex flex-col gap-4 shrink-0">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold shrink-0 shadow-xs">
                <FileCode className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold tracking-tight truncate">
                  Mã Nguồn Python Backend & File Khởi Chạy Local (.bat)
                </h3>
                <p className="text-xs text-slate-300 font-medium truncate">
                  Tích hợp SQLite (vat_database.db), FastAPI REST Backend & File Nhấp Đúp Chạy Ngay
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

          {/* Separated Tab Switcher Container */}
          <div className="bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700/60 flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('fastapi')}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'fastapi'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/70'
              }`}
            >
              <Database className="w-4 h-4 text-blue-200" />
              <span>1. Python Backend (main.py)</span>
            </button>

            <button
              onClick={() => setActiveTab('bat')}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'bat'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/70'
              }`}
            >
              <Play className="w-4 h-4 text-emerald-200" />
              <span>2. File Chạy Nhấp Đúp (chay_phan_mem.bat)</span>
            </button>

            <button
              onClick={() => setActiveTab('streamlit')}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'streamlit'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/70'
              }`}
            >
              <Terminal className="w-4 h-4 text-amber-200" />
              <span>3. Mã Nguồn Streamlit (app.py)</span>
            </button>
          </div>
        </div>

        {/* Instructions Banner */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs shrink-0">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Terminal className="w-4 h-4 text-blue-600" />
              <span>Cài đặt thư viện Python local:</span>
            </div>
            <pre className="p-2 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] overflow-x-auto select-all">
              pip install fastapi uvicorn pydantic
            </pre>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Play className="w-4 h-4 text-emerald-600" />
              <span>Cách chạy phần mềm trên máy tính:</span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
              Nhấp đúp chuột vào file <b>chay_phan_mem.bat</b>. Hệ thống sẽ tự động khởi động server Python FastAPI, kết nối CSDL SQLite <b>vat_database.db</b> và mở giao diện Web Bento Grid tại <b>http://localhost:3000</b>.
            </p>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-600 font-medium">
            Đang hiển thị file: <code className="bg-slate-100 px-2 py-0.5 rounded font-mono font-bold text-slate-900">{getActiveFilename()}</code>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Đã sao chép!' : 'Sao chép Nội dung'}</span>
            </button>

            <button
              onClick={handleDownloadFile}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải file {getActiveFilename()}</span>
            </button>
          </div>
        </div>

        {/* Code View Area */}
        <div className="p-4 bg-slate-950 overflow-auto flex-1 min-h-0 font-mono text-xs text-slate-200 leading-relaxed select-all">
          <pre>{getActiveCode()}</pre>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Database className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              Tệp cơ sở dữ liệu SQLite <b>vat_database.db</b> sẽ tự động tạo và cập nhật ngay trong thư mục chứa file script.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
