import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check, Settings } from 'lucide-react';
import { Company } from '../types';

interface CompanySwitcherProps {
  companies: Company[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  onOpenAddModal: () => void;
  onOpenManageModal: () => void;
}

export const CompanySwitcher: React.FC<CompanySwitcherProps> = ({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onOpenAddModal,
  onOpenManageModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-300/80 rounded-xl transition-all text-xs font-bold text-slate-800 shadow-2xs"
      >
        <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <div className="flex flex-col text-left max-w-[170px] sm:max-w-[220px]">
          <span className="truncate text-slate-900 font-bold leading-tight">
            {selectedCompany ? selectedCompany.name : 'Chọn Công Ty'}
          </span>
          {selectedCompany && (
            <span className="text-[10px] text-slate-500 font-mono font-medium truncate">
              MST: {selectedCompany.taxCode}
            </span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
            <span>Danh Sách Công Ty ({companies.length})</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenManageModal();
              }}
              className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 normal-case text-[11px] hover:underline"
            >
              <Settings className="w-3 h-3" />
              <span>Quản lý Công ty</span>
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {companies.map((comp) => {
              const isSelected = comp.id === selectedCompanyId;
              return (
                <button
                  key={comp.id}
                  onClick={() => {
                    onSelectCompany(comp.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                    isSelected ? 'bg-emerald-50/70 text-emerald-900 font-semibold' : 'text-slate-700'
                  }`}
                >
                  <div className="pr-2 min-w-0">
                    <div className="text-xs font-bold truncate">{comp.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">MST: {comp.taxCode}</div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="p-1.5 border-t border-slate-100 bg-slate-50/50 flex items-center gap-1.5">
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenAddModal();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
            >
              <span>Thêm Công Ty</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                onOpenManageModal();
              }}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
              title="Quản lý danh sách (Sửa/Xóa công ty)"
            >
              <Settings className="w-3.5 h-3.5 text-slate-600" />
              <span>Quản Lý</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
