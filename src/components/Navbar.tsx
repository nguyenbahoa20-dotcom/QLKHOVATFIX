import React from 'react';
import { Package, Mail, RefreshCw, FileCode, AlertTriangle, Download } from 'lucide-react';
import { InventoryItem } from '../types';

interface NavbarProps {
  activeTab: 'gmail' | 'inventory' | 'history';
  setActiveTab: (tab: 'gmail' | 'inventory' | 'history') => void;
  inventory: InventoryItem[];
  onOpenPythonModal: () => void;
  onExportExcel: () => void;
  isScanning: boolean;
  onScanGmail: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  inventory,
  onOpenPythonModal,
  onExportExcel,
  isScanning,
  onScanGmail,
}) => {
  const lowStockCount = inventory.filter(
    (item) => item.currentStock <= item.minStockThreshold
  ).length;

  return (
    <header className="sticky top-0 z-30 pt-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-3xl p-3 shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xs font-semibold">
                <Package className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    Kho VAT & Gmail
                  </h1>
                  <span className="bg-blue-50 text-blue-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-blue-200">
                    Bento Grid
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    SQLite: vat_database.db
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Quản lý kho VAT mua vào/bán ra tự động từ Gmail
                </p>
              </div>
            </div>

            {/* Mobile quick action icon */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={onScanGmail}
                disabled={isScanning}
                className="p-2 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors disabled:opacity-50"
                title="Quét Gmail"
              >
                <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Center Tabs Navigation */}
          <nav className="flex items-center gap-1 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/60 w-full md:w-auto justify-center">
            <button
              onClick={() => setActiveTab('gmail')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'gmail'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>1. Đồng Bộ Gmail</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all relative ${
                activeTab === 'inventory'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>2. Kho VAT & Tồn Kho</span>
              {lowStockCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-4 text-[10px] font-extrabold text-amber-950 bg-amber-300 rounded-full px-1">
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'history'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>3. Lịch Sử Xuất/Nhập</span>
            </button>
          </nav>

          {/* Right actions */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={onScanGmail}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Đang quét...' : 'Quét Gmail'}</span>
            </button>

            <button
              onClick={onExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              title="Tải báo cáo Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden lg:inline">Xuất Excel</span>
            </button>

            <button
              onClick={onOpenPythonModal}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-400" />
              <span>Python Code</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
