import React, { useState } from 'react';
import { 
  Package, Search, Filter, Plus, ArrowUpRight, ArrowDownLeft, AlertTriangle, 
  CheckCircle2, Download, Edit2, Trash2, ShieldAlert, FileSpreadsheet, Layers
} from 'lucide-react';
import { InventoryItem, InvoiceItem } from '../types';

interface InventoryTabProps {
  inventory: InventoryItem[];
  onOpenAddModal: () => void;
  onOpenInboundInvoiceModal: () => void;
  onOpenOutboundInvoiceModal: () => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (sku: string) => void;
  onDeleteMultipleItems?: (skus: string[]) => void;
  onExportExcel: () => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  inventory,
  onOpenAddModal,
  onOpenInboundInvoiceModal,
  onOpenOutboundInvoiceModal,
  onEditItem,
  onDeleteItem,
  onDeleteMultipleItems,
  onExportExcel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LOW' | 'SAFE' | 'EMPTY'>('ALL');
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Calculated Stats
  const totalItems = inventory.length;
  const totalStockValue = inventory.reduce(
    (sum, item) => sum + item.currentStock * item.averageCost,
    0
  );
  const lowStockCount = inventory.filter(
    (item) => item.currentStock <= item.minStockThreshold && item.currentStock > 0
  ).length;
  const emptyStockCount = inventory.filter((item) => item.currentStock <= 0).length;

  // Filtered Items
  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'LOW') {
      return item.currentStock <= item.minStockThreshold && item.currentStock > 0;
    }
    if (statusFilter === 'SAFE') {
      return item.currentStock > item.minStockThreshold;
    }
    if (statusFilter === 'EMPTY') {
      return item.currentStock <= 0;
    }
    return true;
  });

  // Batch Selection Helpers
  const isAllSelected =
    filteredInventory.length > 0 &&
    filteredInventory.every((item) => selectedSkus.includes(item.sku));

  const isSomeSelected =
    filteredInventory.some((item) => selectedSkus.includes(item.sku)) && !isAllSelected;

  const handleSelectAll = () => {
    if (isAllSelected) {
      const filteredSkuSet = new Set(filteredInventory.map((i) => i.sku));
      setSelectedSkus((prev) => prev.filter((sku) => !filteredSkuSet.has(sku)));
    } else {
      const newSelected = new Set([...selectedSkus, ...filteredInventory.map((i) => i.sku)]);
      setSelectedSkus(Array.from(newSelected));
    }
  };

  const handleToggleSelect = (sku: string) => {
    setSelectedSkus((prev) =>
      prev.includes(sku) ? prev.filter((id) => id !== sku) : [...prev, sku]
    );
  };

  const handleConfirmBulkDelete = () => {
    if (onDeleteMultipleItems) {
      onDeleteMultipleItems(selectedSkus);
    } else {
      selectedSkus.forEach((sku) => onDeleteItem(sku));
    }
    setSelectedSkus([]);
    setIsBulkDeleteModalOpen(false);
  };

  // Selected items details for modal calculation
  const selectedItemsDetails = inventory.filter((item) => selectedSkus.includes(item.sku));
  const selectedTotalValue = selectedItemsDetails.reduce(
    (sum, item) => sum + item.currentStock * item.averageCost,
    0
  );

  return (
    <div className="space-y-6">
      {/* 4 Top Summary Bento Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Bento Metric 1 */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Tổng Số Mặt Hàng
            </p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              {totalItems} <span className="text-xs font-semibold text-slate-500">sản phẩm</span>
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Bento Metric 2 (Dark Accent Hero Card) */}
        <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 p-6 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-1">
              Tổng Giá Trị Tồn Kho VAT
            </p>
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {totalStockValue.toLocaleString('vi-VN')} <span className="text-xs font-semibold text-slate-400">VNĐ</span>
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-emerald-400 flex items-center justify-center font-bold border border-slate-700">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
        </div>

        {/* Bento Metric 3 */}
        <div className={`rounded-3xl border p-6 shadow-xs hover:shadow-md transition-all flex items-center justify-between ${
          lowStockCount > 0 
            ? 'bg-amber-500/10 border-amber-300 text-amber-950' 
            : 'bg-white border-slate-200/80'
        }`}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1 text-amber-800">
              Sắp Hết (Dưới Ngưỡng)
            </p>
            <h3 className="text-3xl font-black text-amber-900 tracking-tight">
              {lowStockCount} <span className="text-xs font-semibold text-amber-700">mặt hàng</span>
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Bento Metric 4 */}
        <div className={`rounded-3xl border p-6 shadow-xs hover:shadow-md transition-all flex items-center justify-between ${
          emptyStockCount > 0 
            ? 'bg-rose-500/10 border-rose-300' 
            : 'bg-white border-slate-200/80'
        }`}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1 text-rose-800">
              Đã Hết Hàng (0 SP)
            </p>
            <h3 className="text-3xl font-black text-rose-900 tracking-tight">
              {emptyStockCount} <span className="text-xs font-semibold text-rose-700">mặt hàng</span>
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Control Bar & Actions - Bento Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Mã SKU, Tên sản phẩm, Danh mục..."
            className="w-full pl-11 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400 font-medium"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-2 text-xs font-bold rounded-2xl transition-all whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({totalItems})
          </button>

          <button
            onClick={() => setStatusFilter('LOW')}
            className={`px-3.5 py-2 text-xs font-bold rounded-2xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'LOW'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Sắp hết ({lowStockCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('SAFE')}
            className={`px-3.5 py-2 text-xs font-bold rounded-2xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'SAFE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>An toàn ({totalItems - lowStockCount - emptyStockCount})</span>
          </button>

          {emptyStockCount > 0 && (
            <button
              onClick={() => setStatusFilter('EMPTY')}
              className={`px-3.5 py-2 text-xs font-bold rounded-2xl transition-all whitespace-nowrap ${
                statusFilter === 'EMPTY'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              Hết hàng ({emptyStockCount})
            </button>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedSkus.length > 0 && (
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-2xl transition-all flex items-center gap-1.5 shadow-md animate-in fade-in zoom-in-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa Các Mục Đã Chọn ({selectedSkus.length})</span>
            </button>
          )}

          <button
            onClick={onOpenInboundInvoiceModal}
            className="px-4 py-2.5 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-2xl transition-all flex items-center gap-1.5 shadow-xs"
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
            <span>+ Nhập Kho (V vào)</span>
          </button>

          <button
            onClick={onOpenOutboundInvoiceModal}
            className="px-4 py-2.5 text-xs font-bold text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-2xl transition-all flex items-center gap-1.5 shadow-xs"
          >
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
            <span>- Xuất Kho (V ra)</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-2xl transition-all flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4 text-blue-400" />
            <span>Sản Phẩm Mới</span>
          </button>
        </div>
      </div>

      {/* Main Inventory Table Bento Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base tracking-tight">Bảng Chi Tiết Tồn Kho VAT</h3>
            <p className="text-xs text-slate-500 font-medium">
              Tự động đối chiếu Nhập Kho (Kho V vào) và Xuất Kho (Kho V ra)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedSkus.length > 0 && (
              <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-2xl shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa các mục đã chọn ({selectedSkus.length})</span>
              </button>
            )}

            <button
              onClick={onExportExcel}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-2xl shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tải Báo Cáo Excel</span>
            </button>
          </div>
        </div>

        {/* Selected Banner Bar */}
        {selectedSkus.length > 0 && (
          <div className="px-6 py-3 bg-rose-50/90 border-b border-rose-200 flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2 font-bold text-rose-900">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              <span>Đã chọn <strong className="text-rose-950 font-black text-sm">{selectedSkus.length}</strong> sản phẩm trong danh sách</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedSkus([])}
                className="px-3 py-1 bg-white hover:bg-rose-100/50 border border-rose-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Bỏ chọn tất cả
              </button>
              <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="px-3.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa các mục đã chọn</span>
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                    title="Chọn / Bỏ chọn tất cả sản phẩm"
                  />
                </th>
                <th className="px-3 py-3 text-center">STT</th>
                <th className="px-4 py-3">Mã SKU</th>
                <th className="px-4 py-3">Tên Sản Phẩm</th>
                <th className="px-4 py-3 text-center">ĐVT</th>
                <th className="px-4 py-3 text-right bg-emerald-50/60 text-emerald-900 border-x border-emerald-100">
                  Số Nhập (Kho V vào)
                </th>
                <th className="px-4 py-3 text-right bg-rose-50/60 text-rose-900 border-r border-rose-100">
                  Số Xuất (Kho V ra)
                </th>
                <th className="px-4 py-3 text-right font-bold text-slate-900">
                  Tồn Kho Còn Lại
                </th>
                <th className="px-4 py-3 text-center">Ngưỡng Tối Thiểu</th>
                <th className="px-4 py-3 text-right">Đơn Giá Nhập (VNĐ)</th>
                <th className="px-4 py-3 text-right">Tổng Giá Trị (VNĐ)</th>
                <th className="px-4 py-3">Ghi Chú Thông Minh & Trạng Thái</th>
                <th className="px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200/80">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-slate-500">
                    Không tìm thấy sản phẩm phù hợp.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item, idx) => {
                  const isSelected = selectedSkus.includes(item.sku);
                  const isLow = item.currentStock <= item.minStockThreshold && item.currentStock > 0;
                  const isEmpty = item.currentStock <= 0;
                  const isSafe = item.currentStock > item.minStockThreshold;

                  let rowBgClass = 'hover:bg-slate-50/80';
                  if (isSelected) {
                    rowBgClass = 'bg-rose-50/80 hover:bg-rose-100/70 border-l-4 border-l-rose-600';
                  } else if (isEmpty) {
                    rowBgClass = 'bg-rose-50/60 hover:bg-rose-100/60 text-rose-950';
                  } else if (isLow) {
                    rowBgClass = 'bg-amber-50/80 hover:bg-amber-100/70 text-amber-950';
                  } else {
                    rowBgClass = 'bg-emerald-50/30 hover:bg-emerald-50/60';
                  }

                  // Smart Note generation
                  const smartNote = isEmpty
                    ? `Đã xuất hết ${item.totalOutbound} ${item.unit} (Hết hàng!)`
                    : isLow
                      ? `Đã xuất ${item.totalOutbound}, còn lại ${item.currentStock} (Dưới ngưỡng ${item.minStockThreshold})`
                      : `Đã xuất ${item.totalOutbound}, còn lại ${item.currentStock} ${item.unit}`;

                  return (
                    <tr key={item.id} className={`transition-colors ${rowBgClass}`}>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.sku)}
                          className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                        />
                      </td>

                      <td className="px-3 py-3 text-slate-500 text-center font-mono">{idx + 1}</td>

                      <td className="px-4 py-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {item.sku}
                      </td>

                      <td className="px-4 py-3 max-w-xs font-medium text-slate-900">
                        <div>{item.name}</div>
                        <span className="text-[10px] text-slate-500 font-normal">{item.category}</span>
                      </td>

                      <td className="px-4 py-3 text-center text-slate-600 whitespace-nowrap">
                        {item.unit}
                      </td>

                      {/* Inbound column */}
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700 bg-emerald-50/30 border-x border-emerald-100/80 font-mono">
                        +{item.totalInbound}
                      </td>

                      {/* Outbound column */}
                      <td className="px-4 py-3 text-right font-semibold text-rose-700 bg-rose-50/30 border-r border-rose-100/80 font-mono">
                        -{item.totalOutbound}
                      </td>

                      {/* Current stock column */}
                      <td className="px-4 py-3 text-right font-bold text-slate-900 text-sm font-mono">
                        {item.currentStock}
                      </td>

                      <td className="px-4 py-3 text-center text-slate-500 font-mono">
                        {item.minStockThreshold}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700 font-mono whitespace-nowrap">
                        {item.averageCost.toLocaleString('vi-VN')}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-slate-900 font-mono whitespace-nowrap">
                        {(item.currentStock * item.averageCost).toLocaleString('vi-VN')}
                      </td>

                      {/* Smart Note & Status Badge */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] leading-tight font-medium">
                            {smartNote}
                          </span>
                          <div className="flex items-center gap-1">
                            {isEmpty && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                ❌ Đã hết hàng
                              </span>
                            )}
                            {isLow && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                ⚠️ Sắp hết - Cần nhập VAT
                              </span>
                            )}
                            {isSafe && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✅ Tồn kho an toàn
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEditItem(item)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"
                            title="Sửa thông tin sản phẩm"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setItemToDelete(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
                            title="Xóa sản phẩm khỏi kho"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Deleting Product */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200/80 max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Xác Nhận Xóa Sản Phẩm
                </h3>
                <p className="text-xs text-slate-500 font-medium">Xóa khỏi danh sách Quản Lý Kho VAT</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 my-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Tên sản phẩm:</span>
                <span className="font-bold text-slate-900 text-right max-w-[200px] truncate">{itemToDelete.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Mã SKU:</span>
                <span className="font-mono font-bold text-slate-800">{itemToDelete.sku}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Tồn kho hiện tại:</span>
                <span className="font-bold text-slate-900">{itemToDelete.currentStock} {itemToDelete.unit}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Giá trị tồn kho:</span>
                <span className="font-bold text-emerald-700 font-mono">{(itemToDelete.currentStock * itemToDelete.averageCost).toLocaleString('vi-VN')} VNĐ</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5 font-medium leading-relaxed">
              Bạn có chắc chắn muốn xóa sản phẩm này? Hệ thống sẽ ngay lập tức tính toán lại tổng số mặt hàng, tổng giá trị kho VAT và tất cả chỉ số thống kê.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={() => {
                  onDeleteItem(itemToDelete.sku);
                  setItemToDelete(null);
                }}
                className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-2xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa Sản Phẩm</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal for Bulk Deleting Selected Products */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200/80 max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Xác Nhận Xóa hàng loạt ({selectedSkus.length} mục)
                </h3>
                <p className="text-xs text-slate-500 font-medium">Xóa các sản phẩm đã chọn khỏi Quản Lý Kho VAT</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 my-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Số lượng mặt hàng chọn:</span>
                <span className="font-bold text-slate-900">{selectedSkus.length} sản phẩm</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Tổng giá trị tồn kho sẽ xóa:</span>
                <span className="font-bold text-rose-700 font-mono">{selectedTotalValue.toLocaleString('vi-VN')} VNĐ</span>
              </div>
              
              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">Danh sách sản phẩm sẽ bị xóa:</span>
                <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                  {selectedItemsDetails.map((it) => (
                    <div key={it.id} className="flex justify-between items-center text-[11px] bg-white p-1.5 rounded-lg border border-slate-200/60">
                      <span className="font-semibold text-slate-800 truncate max-w-[180px]">{it.name}</span>
                      <span className="font-mono text-slate-500">{it.sku}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5 font-medium leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn <strong>{selectedSkus.length}</strong> sản phẩm này khỏi kho VAT? Hệ thống sẽ ngay lập tức tự động cập nhật lại giao diện, tổng số mặt hàng và tất cả số liệu tổng hợp.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleConfirmBulkDelete}
                className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-2xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Đồng Ý Xóa ({selectedSkus.length} SP)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
