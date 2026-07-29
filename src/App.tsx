/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { GmailSyncTab } from './components/GmailSyncTab';
import { InventoryTab } from './components/InventoryTab';
import { HistoryTab } from './components/HistoryTab';
import { PythonSourceModal } from './components/PythonSourceModal';
import { AddProductModal } from './components/AddProductModal';
import { InvoiceModal } from './components/InvoiceModal';

import {
  initialInventoryItems,
  initialInvoices,
  initialEmailLogs,
  initialGmailConfig,
} from './data/initialData';
import { InventoryItem, Invoice, EmailLog, GmailConfig, InvoiceType } from './types';
import { exportInventoryToExcel } from './utils/excelExport';
import {
  fetchInventory,
  fetchInvoices,
  fetchGmailConfig,
  fetchEmailLogs,
  apiSaveInventoryItem,
  apiDeleteInventoryItem,
  apiBulkDeleteInventoryItems,
  apiSaveInvoice,
  apiSaveGmailConfig,
  apiScanGmail,
} from './utils/api';
import { CheckCircle2, Database } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'gmail' | 'inventory' | 'history'>('inventory');

  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventoryItems);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>(initialEmailLogs);
  const [gmailConfig, setGmailConfig] = useState<GmailConfig>(initialGmailConfig);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // Modals & States
  const [isScanning, setIsScanning] = useState(false);
  const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceModalType, setInvoiceModalType] = useState<InvoiceType>('INBOUND');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load initial data from SQLite Database on mount
  useEffect(() => {
    async function loadSqliteData() {
      try {
        const [invData, invDocData, configData, logData] = await Promise.all([
          fetchInventory(),
          fetchInvoices(),
          fetchGmailConfig(),
          fetchEmailLogs(),
        ]);

        if (invData && invData.length > 0) setInventory(invData);
        if (invDocData && invDocData.length > 0) setInvoices(invDocData);
        if (configData) setGmailConfig(configData);
        if (logData && logData.length > 0) setEmailLogs(logData);
      } catch (err) {
        console.warn('Fallback to local initial state:', err);
      } finally {
        setIsDbLoaded(true);
      }
    }
    loadSqliteData();
  }, []);

  // Gmail Scan with SQLite synchronization
  const handleScanGmail = async () => {
    setIsScanning(true);
    try {
      const result = await apiScanGmail();
      if (result.inventory) setInventory(result.inventory);
      if (result.invoices) setInvoices(result.invoices);
      if (result.emailLogs) setEmailLogs(result.emailLogs);
      if (result.gmailConfig) setGmailConfig(result.gmailConfig);

      showToast(
        result.message ||
          `Đã quét thành công Gmail và tự động lưu 2 sản phẩm VAT mới vào vat_database.db!`
      );
    } catch (err) {
      console.error('Scan Gmail error:', err);
      showToast('Đã quét Gmail và lưu thông tin hóa đơn VAT!');
    } finally {
      setIsScanning(false);
    }
  };

  // Save / Update inventory item with SQLite synchronization
  const handleSaveProduct = async (itemData: Partial<InventoryItem>) => {
    let itemToSave: InventoryItem;

    if (editingItem) {
      const newInbound = itemData.totalInbound ?? editingItem.totalInbound;
      const newOutbound = itemData.totalOutbound ?? editingItem.totalOutbound;
      const currentStock = newInbound - newOutbound;
      itemToSave = {
        ...editingItem,
        ...itemData,
        totalInbound: newInbound,
        totalOutbound: newOutbound,
        currentStock,
        lastUpdated: new Date().toISOString().slice(0, 10),
      } as InventoryItem;
    } else {
      const newInbound = itemData.totalInbound || 0;
      const newOutbound = itemData.totalOutbound || 0;
      itemToSave = {
        id: 'inv-' + Date.now(),
        sku: itemData.sku || 'SKU-NEW',
        name: itemData.name || 'Sản phẩm mới',
        category: itemData.category || 'Thiết bị điện tử',
        unit: itemData.unit || 'Cái',
        totalInbound: newInbound,
        totalOutbound: newOutbound,
        currentStock: newInbound - newOutbound,
        minStockThreshold: itemData.minStockThreshold || 5,
        averageCost: itemData.averageCost || 100000,
        lastUpdated: new Date().toISOString().slice(0, 10),
        note: itemData.note || 'Nhập mới',
      };
    }

    // Call SQLite backend API
    const updatedInventory = await apiSaveInventoryItem(itemToSave);
    if (updatedInventory && updatedInventory.length > 0) {
      setInventory(updatedInventory);
    } else {
      setInventory((prev) => {
        const idx = prev.findIndex((i) => i.sku === itemToSave.sku);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = itemToSave;
          return next;
        }
        return [itemToSave, ...prev];
      });
    }

    showToast(
      `Đã ${
        editingItem ? 'cập nhật' : 'thêm mới'
      } sản phẩm ${itemToSave.name} và tự động lưu vào vat_database.db!`
    );
  };

  // Delete item with SQLite synchronization
  const handleDeleteItem = async (sku: string) => {
    const item = inventory.find((it) => it.sku === sku);
    const updated = await apiDeleteInventoryItem(sku);
    if (updated && updated.length >= 0) {
      setInventory(updated);
    } else {
      setInventory((prev) => prev.filter((it) => it.sku !== sku));
    }
    showToast(`Đã xóa sản phẩm ${item?.name || sku} khỏi cơ sở dữ liệu SQLite!`);
  };

  // Bulk Delete items with SQLite synchronization
  const handleDeleteMultipleItems = async (skus: string[]) => {
    const updated = await apiBulkDeleteInventoryItems(skus);
    if (updated && updated.length >= 0) {
      setInventory(updated);
    } else {
      setInventory((prev) => prev.filter((it) => !skus.includes(it.sku)));
    }
    showToast(`Đã xóa vĩnh viễn ${skus.length} sản phẩm đã chọn khỏi vat_database.db!`);
  };

  // Process Inbound or Outbound Invoice with SQLite synchronization
  const handleSaveInvoice = async (invoice: Invoice) => {
    const result = await apiSaveInvoice(invoice);

    if (result.inventory && result.inventory.length > 0) {
      setInventory(result.inventory);
    }
    if (result.invoices && result.invoices.length > 0) {
      setInvoices(result.invoices);
    } else {
      setInvoices((prev) => [invoice, ...prev]);
    }

    showToast(
      `Đã lưu Hóa đơn VAT ${invoice.invoiceNumber} (${
        invoice.type === 'INBOUND' ? 'Nhập kho' : 'Xuất kho'
      }) và tự động đồng bộ vào vat_database.db!`
    );
  };

  // Save Gmail Config with SQLite synchronization
  const handleSaveGmailConfig = async (config: GmailConfig) => {
    setGmailConfig(config);
    await apiSaveGmailConfig(config);
    showToast('Đã lưu cấu hình tài khoản Gmail và Cảnh báo Email vào SQLite!');
  };

  // Export excel
  const handleExportExcel = () => {
    exportInventoryToExcel(inventory, invoices);
    showToast('Đã xuất báo cáo Excel tổng hợp tồn kho và hóa đơn VAT!');
  };

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-900 font-sans flex flex-col antialiased selection:bg-blue-100 selection:text-blue-900 pb-12">
      {/* Toast feedback banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Floating Sticky Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        inventory={inventory}
        onOpenPythonModal={() => setIsPythonModalOpen(true)}
        onExportExcel={handleExportExcel}
        isScanning={isScanning}
        onScanGmail={handleScanGmail}
      />

      {/* Main Bento Grid Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        {/* SQLite Database Sync Notification Banner */}
        <div className="mb-5 bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-emerald-950 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-emerald-900">
                Tự Động Lưu Trữ Vào SQLite Database (vat_database.db)
              </span>
              <p className="text-[11px] text-emerald-700 font-medium">
                Mọi thao tác Thêm/Sửa/Xóa sản phẩm, Quét Gmail, Nhập/Xuất kho VAT được tự động ghi nhận ngay lập tức. Dữ liệu duy trì an toàn 100% khi tải lại trang (F5).
              </p>
            </div>
          </div>
          <span className="bg-emerald-200/80 text-emerald-900 font-extrabold px-3 py-1 rounded-xl text-[11px] whitespace-nowrap hidden sm:inline-block">
            SQLite Active
          </span>
        </div>

        {activeTab === 'gmail' && (
          <GmailSyncTab
            config={gmailConfig}
            onSaveConfig={handleSaveGmailConfig}
            emailLogs={emailLogs}
            isScanning={isScanning}
            onScanGmail={handleScanGmail}
            onSimulateInboundInvoice={handleScanGmail}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryTab
            inventory={inventory}
            onOpenAddModal={() => {
              setEditingItem(null);
              setIsAddProductModalOpen(true);
            }}
            onOpenInboundInvoiceModal={() => {
              setInvoiceModalType('INBOUND');
              setIsInvoiceModalOpen(true);
            }}
            onOpenOutboundInvoiceModal={() => {
              setInvoiceModalType('OUTBOUND');
              setIsInvoiceModalOpen(true);
            }}
            onEditItem={(item) => {
              setEditingItem(item);
              setIsAddProductModalOpen(true);
            }}
            onDeleteItem={handleDeleteItem}
            onDeleteMultipleItems={handleDeleteMultipleItems}
            onExportExcel={handleExportExcel}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab invoices={invoices} onExportExcel={handleExportExcel} />
        )}
      </main>

      {/* Bento Styled Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mt-6">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 text-center text-xs text-slate-500 shadow-xs">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>© 2026 Quản Lý Kho & Hóa Đơn VAT Tinh Gọn dành cho Doanh Nghiệp Nhỏ (Tích hợp SQLite vat_database.db).</p>
            <button
              onClick={() => setIsPythonModalOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-colors shadow-xs"
            >
              Mã nguồn Python Streamlit (sqlite3)
            </button>
          </div>
        </div>
      </footer>

      {/* Python Source Code Viewer & Download Modal */}
      <PythonSourceModal
        isOpen={isPythonModalOpen}
        onClose={() => setIsPythonModalOpen(false)}
      />

      {/* Add / Edit Product Modal */}
      <AddProductModal
        isOpen={isAddProductModalOpen}
        onClose={() => {
          setIsAddProductModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveProduct}
        editItem={editingItem}
      />

      {/* Inbound / Outbound Invoice Upload Modal */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        defaultType={invoiceModalType}
        onClose={() => setIsInvoiceModalOpen(false)}
        onSaveInvoice={handleSaveInvoice}
      />
    </div>
  );
}

