import React, { useRef } from 'react';
import { ShieldCheck, Package, Mail, RefreshCw, Download, Database, Upload, FileSpreadsheet, Trash2, Power, Users, LogOut } from 'lucide-react';
import { AppUser, Company, InventoryItem } from '../types';
import { CompanySwitcher } from './CompanySwitcher';

interface NavbarProps {
  activeTab: 'gmail' | 'inventory' | 'history';
  setActiveTab: (tab: 'gmail' | 'inventory' | 'history') => void;
  inventory: InventoryItem[];
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onOpenAddCompanyModal: () => void;
  onOpenManageCompanyModal: () => void;
  onExportExcel: () => void;
  onExportHTKK: () => void;
  onDownloadBackup: () => void;
  onRestoreBackupFile: (file: File) => void;
  isScanning: boolean;
  onScanGmail: () => void;
  onResetAllData?: () => void;
  onShutdownApp?: () => void;
  user: AppUser;
  onLogout: () => void;
  onManageUsers: () => void;
  isAdmin: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  inventory,
  companies,
  selectedCompanyId,
  onSelectCompany,
  onOpenAddCompanyModal,
  onOpenManageCompanyModal,
  onExportExcel,
  onExportHTKK,
  onDownloadBackup,
  onRestoreBackupFile,
  isScanning,
  onScanGmail,
  onResetAllData,
  onShutdownApp,
  user,
  onLogout,
  onManageUsers,
  isAdmin,
}) => {
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);

  const lowStockCount = inventory.filter(
    (item) => item.currentStock <= item.minStockThreshold
  ).length;

  const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onRestoreBackupFile(file);
      e.target.value = '';
    }
  };

  return (
    <header className="sticky top-0 z-30 pt-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <input
        type="file"
        ref={restoreFileInputRef}
        onChange={handleRestoreFileChange}
        accept=".db,.json"
        className="hidden"
      />

      <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-3xl p-3 shadow-xs">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Logo, Title & Multi-Company Switcher */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start px-2">
            <div className="flex flex-col items-start gap-2">
              {/* Top Row: Logo + App Title */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xs font-semibold shrink-0">
                  <ShieldCheck className="w-5 h-5 text-[#10B981]" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    TaxVault Pro
                  </h1>
                  <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Multi-Company SQLite
                  </span>
                </div>
              </div>

              {/* Bottom Row: Company Switcher */}
              <div className="flex items-center gap-2 flex-wrap">
                <CompanySwitcher
                  companies={companies}
                  selectedCompanyId={selectedCompanyId}
                  onSelectCompany={onSelectCompany}
                  onOpenAddModal={onOpenAddCompanyModal}
                  onOpenManageModal={onOpenManageCompanyModal}
                />
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Quản lý kho VAT tự động từ Gmail & XML
                </p>
              </div>
            </div>

            {/* Mobile quick action icon */}
            <div className="flex items-center gap-2 lg:hidden">
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
          <nav className="flex items-center gap-1 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/60 w-full lg:w-auto justify-center flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setActiveTab('gmail')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
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
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all relative ${
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
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
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
          <div className="flex items-center gap-2 flex-wrap justify-end w-full lg:w-auto">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700">
              <span>{user.username}</span><span className={`px-1.5 py-0.5 rounded-full ${isAdmin ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>{isAdmin ? 'Admin' : 'User'}</span>
            </span>
            {isAdmin && <button onClick={onManageUsers} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-violet-50 border border-violet-200 text-violet-800 text-xs font-bold hover:bg-violet-100"><Users className="w-3.5 h-3.5" /><span>Tài khoản</span></button>}
            <button onClick={onLogout} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200" title="Đăng xuất"><LogOut className="w-3.5 h-3.5" /><span>Đăng xuất</span></button>
            <button
              onClick={onScanGmail}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              title="Nhấn để quét Gmail và bóc tách hóa đơn XML"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isScanning ? 'Đang quét...' : 'Quét Gmail'}</span>
            </button>

            <button
              onClick={onExportHTKK}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors cursor-pointer"
              title="Xuất Bảng kê VAT GTGT chuẩn HTKK (Tờ khai 01-1 & 01-2)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất HTKK</span>
            </button>

            {/* Sao lưu CSDL */}
            <button
              onClick={onDownloadBackup}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer"
              title="Tải file SQLite vat_database.db về máy tính"
            >
              <Database className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden xl:inline">Sao Lưu CSDL</span>
            </button>

            {/* Phục hồi CSDL */}
            {isAdmin && <button
              onClick={() => restoreFileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors cursor-pointer"
              title="Chọn file .db hoặc .json để khôi phục dữ liệu"
            >
              <Upload className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden xl:inline">Phục Hồi</span>
            </button>}

            {/* Thoát Ứng Dụng (Shutdown Server) */}
            {onShutdownApp && !(import.meta as any).env?.PROD && (
              <button
                onClick={() => {
                  if (confirm('Bạn có chắc chắn muốn THOÁT PHẦN MỀM và đóng toàn bộ tiến trình ngầm (CMD, Python)?')) {
                    onShutdownApp();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all cursor-pointer shadow-md shadow-rose-600/20 active:scale-95 group"
                title="Thoát Phần Mềm & Tắt Máy Chủ An Toàn"
              >
                <Power className="w-3.5 h-3.5 text-white" />
                <span>Thoát Phần Mềm</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
