import React, { useState } from 'react';
import { Building2, X, Edit2, Trash2, Check, AlertTriangle, Search, Save } from 'lucide-react';
import { Company } from '../types';

interface CompanyManageModalProps {
  isOpen: boolean;
  companies: Company[];
  selectedCompanyId: string;
  onClose: () => void;
  onSelectCompany: (companyId: string) => void;
  onSaveCompany: (company: Company) => void;
  onDeleteCompany: (companyId: string) => void;
  onOpenAddModal: () => void;
  canDeleteCompany?: boolean;
}

export const CompanyManageModal: React.FC<CompanyManageModalProps> = ({
  isOpen,
  companies,
  selectedCompanyId,
  onClose,
  onSelectCompany,
  onSaveCompany,
  onDeleteCompany,
  onOpenAddModal,
  canDeleteCompany = true,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editTaxCode, setEditTaxCode] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editError, setEditError] = useState('');

  if (!isOpen) return null;

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.taxCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const startEdit = (company: Company) => {
    setEditingCompany(company);
    setEditName(company.name);
    setEditTaxCode(company.taxCode);
    setEditAddress(company.address || '');
    setEditError('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;

    if (!editName.trim()) {
      setEditError('Vui lòng nhập Tên công ty');
      return;
    }
    if (!editTaxCode.trim()) {
      setEditError('Vui lòng nhập Mã số thuế');
      return;
    }

    const updatedCompany: Company = {
      ...editingCompany,
      name: editName.trim(),
      taxCode: editTaxCode.trim(),
      address: editAddress.trim(),
    };

    onSaveCompany(updatedCompany);
    setEditingCompany(null);
  };

  const handleConfirmDelete = () => {
    if (!companyToDelete) return;
    onDeleteCompany(companyToDelete.id);
    setCompanyToDelete(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-emerald-700 text-white shrink-0">
          <div className="flex items-center space-x-2.5">
            <Building2 className="w-5 h-5 text-emerald-200" />
            <div>
              <h3 className="text-base font-extrabold text-white">Quản Lý Danh Sách Công Ty</h3>
              <p className="text-[11px] text-emerald-100">Cập nhật thông tin, Mã số thuế hoặc Xóa doanh nghiệp khỏi SQLite CSDL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-emerald-600/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-auto sm:flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm công ty theo Tên, MST, Địa chỉ..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenAddModal();
            }}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs shrink-0"
          >
              <span>Thêm Công Ty Mới</span>
          </button>
        </div>

        {/* Company List Content */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {filteredCompanies.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs font-medium">
              Không tìm thấy công ty nào phù hợp.
            </div>
          ) : (
            filteredCompanies.map((comp) => {
              const isSelected = comp.id === selectedCompanyId;
              const isEditing = editingCompany?.id === comp.id;

              if (isEditing) {
                return (
                  <form
                    key={comp.id}
                    onSubmit={handleSaveEdit}
                    className="p-4 bg-emerald-50/50 border-2 border-emerald-500 rounded-2xl space-y-3 shadow-xs animate-in fade-in duration-150"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-900 border-b border-emerald-200 pb-2">
                      <span>Sửa Thông Tin Công Ty (ID: {comp.id})</span>
                      <span className="text-[10px] text-emerald-700 font-mono">MST Hiện tại: {comp.taxCode}</span>
                    </div>

                    {editError && (
                      <div className="p-2 text-xs text-red-600 bg-red-50 rounded-lg border border-red-200">
                        {editError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                          Mã Số Thuế <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editTaxCode}
                          onChange={(e) => setEditTaxCode(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                          Tên Doanh Nghiệp / Công Ty <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                        Địa Chỉ Đăng Ký Doanh Nghiệp
                      </label>
                      <input
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-200">
                      <button
                        type="button"
                        onClick={() => setEditingCompany(null)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Lưu Thay Đổi</span>
                      </button>
                    </div>
                  </form>
                );
              }

              return (
                <div
                  key={comp.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-black text-slate-900 tracking-tight">{comp.name}</h4>
                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Đang chọn</span>
                        </span>
                      )}
                      {comp.isDefault && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          Mặc định
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-mono font-bold text-emerald-700">
                      Mã số thuế: {comp.taxCode}
                    </div>

                    {comp.address && (
                      <div className="text-[11px] text-slate-500 font-medium truncate max-w-lg">
                        📍 {comp.address}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {!isSelected && (
                      <button
                        onClick={() => {
                          onSelectCompany(comp.id);
                          onClose();
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-colors"
                      >
                        Chọn Công Ty
                      </button>
                    )}

                    <button
                      onClick={() => startEdit(comp)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1"
                      title="Sửa thông tin công ty"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                      <span>Sửa</span>
                    </button>

                    {canDeleteCompany && <button
                      onClick={() => setCompanyToDelete(comp)}
                      className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center gap-1"
                      title="Xóa công ty khỏi hệ thống"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Xóa</span>
                    </button>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 font-medium shrink-0">
          <span>Tổng số: {companies.length} doanh nghiệp</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {companyToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center font-bold shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Xác Nhận Xóa Công Ty
                </h3>
                <p className="text-xs text-slate-500 font-medium">Xóa dữ liệu doanh nghiệp khỏi SQLite</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 my-3 space-y-1 text-xs">
              <div className="font-bold text-slate-900">{companyToDelete.name}</div>
              <div className="font-mono text-emerald-700 font-bold">MST: {companyToDelete.taxCode}</div>
              {companyToDelete.address && (
                <div className="text-slate-500 text-[11px] truncate">Địa chỉ: {companyToDelete.address}</div>
              )}
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 mb-5 font-semibold space-y-1">
              <p>⚠️ <strong>CẢNH BÁO QUAN TRỌNG:</strong></p>
              <p className="font-normal text-[11px] leading-relaxed">
                Hành động này sẽ xóa vĩnh viễn công ty cùng <strong>toàn bộ dữ liệu tồn kho và hóa đơn VAT</strong> thuộc công ty này khỏi CSDL SQLite <code className="font-mono font-bold">vat_database.db</code>!
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setCompanyToDelete(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Đồng Ý Xóa Công Ty</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
