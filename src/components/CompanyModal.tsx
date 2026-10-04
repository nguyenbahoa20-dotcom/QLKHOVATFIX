import React, { useState, useEffect } from 'react';
import { Building2, X, Check } from 'lucide-react';
import { Company } from '../types';

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (company: Company) => void;
  initialTaxCode?: string;
  initialName?: string;
}

export const CompanyModal: React.FC<CompanyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTaxCode = '',
  initialName = '',
}) => {
  const [name, setName] = useState(initialName);
  const [taxCode, setTaxCode] = useState(initialTaxCode);
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setTaxCode(initialTaxCode);
      setAddress('');
      setError('');
    }
  }, [isOpen, initialTaxCode, initialName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập Tên công ty');
      return;
    }
    if (!taxCode.trim()) {
      setError('Vui lòng nhập Mã số thuế');
      return;
    }

    const newCompany: Company = {
      id: `comp-${Date.now()}`,
      name: name.trim(),
      taxCode: taxCode.trim(),
      address: address.trim(),
      isDefault: false,
    };

    onSave(newCompany);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-emerald-700 text-white">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-emerald-200" />
            <h3 className="text-lg font-semibold">Thêm Công Ty Mới</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-emerald-600/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Mã Số Thuế <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              placeholder="VD: 0101234567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Tên Công Ty / Doanh Nghiệp <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: CÔNG TY TNHH THIẾT BỊ SỐ ABC"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Địa Chỉ Đăng Ký
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="VD: Số 123 Đường Lê Lợi, Phường 1, Quận 1, TP. Hồ Chí Minh"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
            >
              <span>Tạo Công Ty</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
