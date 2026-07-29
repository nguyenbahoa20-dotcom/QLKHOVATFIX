import React, { useState, useEffect } from 'react';
import { X, Package, Check, AlertTriangle } from 'lucide-react';
import { InventoryItem } from '../types';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<InventoryItem>) => void;
  editItem?: InventoryItem | null;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editItem,
}) => {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Thiết bị điện tử');
  const [unit, setUnit] = useState('Cái');
  const [inbound, setInbound] = useState(10);
  const [outbound, setOutbound] = useState(0);
  const [minThreshold, setMinThreshold] = useState(5);
  const [avgCost, setAvgCost] = useState(100000);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (editItem) {
      setSku(editItem.sku);
      setName(editItem.name);
      setCategory(editItem.category);
      setUnit(editItem.unit);
      setInbound(editItem.totalInbound);
      setOutbound(editItem.totalOutbound);
      setMinThreshold(editItem.minStockThreshold);
      setAvgCost(editItem.averageCost);
      setNote(editItem.note || '');
    } else {
      setSku('');
      setName('');
      setCategory('Thiết bị điện tử');
      setUnit('Cái');
      setInbound(10);
      setOutbound(0);
      setMinThreshold(5);
      setAvgCost(100000);
      setNote('');
    }
  }, [editItem, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku || !name) return;

    onSave({
      sku: sku.toUpperCase().trim(),
      name: name.trim(),
      category,
      unit,
      totalInbound: Number(inbound),
      totalOutbound: Number(outbound),
      minStockThreshold: Number(minThreshold),
      averageCost: Number(avgCost),
      note,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200/80 w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-base tracking-tight">
              {editItem ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới Vào Kho'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã SKU Sản Phẩm <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!!editItem}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="VD: LAP-DEL-15"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Danh Mục
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
              >
                <option value="Thiết bị điện tử">Thiết bị điện tử</option>
                <option value="Thiết bị văn phòng">Thiết bị văn phòng</option>
                <option value="Phụ kiện">Phụ kiện</option>
                <option value="Văn phòng phẩm">Văn phòng phẩm</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên Tên Sản Phẩm VAT <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Máy tính xách tay Dell Vostro 15"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Đơn Vị Tính
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Cái, Bộ, Ram..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-800 mb-1">
                Số Nhập Kho (V vào)
              </label>
              <input
                type="number"
                min="0"
                value={inbound}
                onChange={(e) => setInbound(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-emerald-50/50 border border-emerald-200 rounded-xl text-emerald-900 font-bold font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-rose-800 mb-1">
                Số Xuất Kho (V ra)
              </label>
              <input
                type="number"
                min="0"
                value={outbound}
                onChange={(e) => setOutbound(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-rose-50/50 border border-rose-200 rounded-xl text-rose-900 font-bold font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngưỡng Tồn Tối Thiểu (Cảnh báo)
              </label>
              <input
                type="number"
                min="1"
                value={minThreshold}
                onChange={(e) => setMinThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Đơn Giá Nhập Trung Bình (VNĐ)
              </label>
              <input
                type="number"
                min="0"
                value={avgCost}
                onChange={(e) => setAvgCost(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi Chú
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú thêm về lô hàng..."
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-center justify-between font-mono">
            <span>Tồn kho dự tính:</span>
            <span className="font-bold text-sm text-blue-700">
              {Number(inbound) - Number(outbound)} {unit}
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Lưu Sản Phẩm</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
