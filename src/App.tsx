/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FileCode } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { GmailSyncTab } from './components/GmailSyncTab';
import { InventoryTab } from './components/InventoryTab';
import { HistoryTab } from './components/HistoryTab';
import { PythonSourceModal } from './components/PythonSourceModal';
import { AddProductModal } from './components/AddProductModal';
import { InvoiceModal } from './components/InvoiceModal';
import { CompanyModal } from './components/CompanyModal';
import { CompanyManageModal } from './components/CompanyManageModal';
import { DuplicateWarningModal, DuplicateInvoiceInfo } from './components/DuplicateWarningModal';
import { UploadSummaryModal, UploadBatchSummary, FileProcessingResult } from './components/UploadSummaryModal';
import { AIChat } from './components/AIChat';

import {
  initialCompanies,
  initialInventoryItems,
  initialInvoices,
  initialEmailLogs,
  initialGmailConfig,
} from './data/initialData';
import { Company, InventoryItem, Invoice, EmailLog, GmailConfig, InvoiceType } from './types';
import { parseInvoiceXml, ParsedXmlInvoice } from './utils/xmlParser';
import { parsePdfInvoice } from './utils/pdfParser';
import { exportInventoryToExcel, exportHTKKVATToExcel } from './utils/excelExport';
import {
  fetchCompanies,
  apiSaveCompany,
  apiDeleteCompany,
  fetchInventory,
  fetchInvoices,
  fetchGmailConfig,
  fetchEmailLogs,
  apiSaveInventoryItem,
  apiDeleteInventoryItem,
  apiBulkDeleteInventoryItems,
  apiSaveInvoice,
  apiDeleteInvoice,
  apiResyncInventory,
  apiClearInvoices,
  apiClearCompanyData,
  apiClearAllData,
  apiSaveGmailConfig,
  apiScanGmail,
  downloadDatabaseFile,
  restoreDatabaseFromFile,
  apiShutdownApp,
  getLocalEmailLogsCache,
  getLocalGmailConfigCache,
} from './utils/api';
import { CheckCircle2, Building2, Sparkles, Plus, ArrowRight, AlertCircle, Loader2, X, Power } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'gmail' | 'inventory' | 'history'>('inventory');

  // Multi-Company State
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('comp-1');

  const selectedCompany = companies.find((c) => c && c.id === selectedCompanyId) || companies[0];

  // Data State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [emailLogs, setEmailLogs] = useState<EmailLog[]>(() => {
    const cached = getLocalEmailLogsCache();
    return cached !== null ? cached : initialEmailLogs;
  });

  const [gmailConfig, setGmailConfig] = useState<GmailConfig>(() => {
    const cached = getLocalGmailConfigCache();
    return cached || initialGmailConfig;
  });

  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // Modals & States
  const [isScanning, setIsScanning] = useState(false);
  const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isAddCompanyModalOpen, setIsAddCompanyModalOpen] = useState(false);
  const [isManageCompanyModalOpen, setIsManageCompanyModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceModalType, setInvoiceModalType] = useState<InvoiceType>('INBOUND');

  // Duplicate Invoice Prevention Modal State
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInvoiceInfo | null>(null);
  const [pendingDuplicateInvoice, setPendingDuplicateInvoice] = useState<Invoice | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  // Batch Upload (.xml & .pdf) Progress & Summary Modal State
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [batchSummary, setBatchSummary] = useState<UploadBatchSummary | null>(null);
  const [isUploadSummaryOpen, setIsUploadSummaryOpen] = useState(false);

  // XML Tax Code Suggestion Modal
  const [pendingXmlInvoice, setPendingXmlInvoice] = useState<{
    invoice: Invoice;
    targetTaxCode: string;
    targetName: string;
  } | null>(null);
  const [showXmlDetectModal, setShowXmlDetectModal] = useState(false);

  const [prefillCompanyTaxCode, setPrefillCompanyTaxCode] = useState('');
  const [prefillCompanyName, setPrefillCompanyName] = useState('');

  const [isAppShutdown, setIsAppShutdown] = useState(false);

  const [toastMessage, setToastMessage] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: any, type: 'success' | 'error' | 'info' = 'success') => {
    const textMsg = typeof msg === 'string'
      ? msg
      : (msg?.message || msg?.msg || (typeof msg === 'object' ? JSON.stringify(msg) : String(msg)));
    setToastMessage({ msg: textMsg, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleShutdownApp = async () => {
    setIsAppShutdown(true);
    await apiShutdownApp();
  };

  // Load companies & data from SQLite Database when component mounts or company changes
  useEffect(() => {
    async function loadSqliteData() {
      try {
        const [compData, invData, invDocData, configData, logData] = await Promise.all([
          fetchCompanies(),
          fetchInventory(selectedCompanyId),
          fetchInvoices(selectedCompanyId),
          fetchGmailConfig(),
          fetchEmailLogs(),
        ]);

        if (Array.isArray(compData) && compData.length > 0) {
          setCompanies(compData.filter((c) => c && c.id));
        } else {
          setCompanies(initialCompanies);
        }
        setInventory(Array.isArray(invData) ? invData.filter((i) => i && i.sku) : []);
        setInvoices(Array.isArray(invDocData) ? invDocData.filter((i) => i && i.id) : []);
        if (configData) setGmailConfig(configData);
        if (Array.isArray(logData)) setEmailLogs(logData);
      } catch (err) {
        console.error('Lỗi kết nối SQLite:', err);
      } finally {
        setIsDbLoaded(true);
      }
    }
    loadSqliteData();
  }, [selectedCompanyId]);

  // Selected company object
  const currentCompany = companies.find((c) => c && c.id === selectedCompanyId) || companies[0] || initialCompanies[0];

  // Filter inventory and invoices for selected company
  const companyInventory = inventory.filter((item) => item && (item.companyId === selectedCompanyId || !item.companyId));
  const companyInvoices = invoices.filter((inv) => inv && (inv.companyId === selectedCompanyId || !inv.companyId));

  // Handle company switch
  const handleSelectCompany = (comp = selectedCompanyId) => {
    setSelectedCompanyId(comp);
    const compObj = companies.find((c) => c && c.id === comp);
    showToast(`Đã chuyển sang công ty: ${compObj?.name || 'Công Ty'}`);
  };

  // Handle Save or Update Company
  const handleSaveCompany = async (newCompany: Company) => {
    const updated = await apiSaveCompany(newCompany);
    setCompanies(updated.filter((c) => c && c.id));
    setSelectedCompanyId(newCompany.id);

    setIsAddCompanyModalOpen(false);
    setIsManageCompanyModalOpen(false);
    setShowXmlDetectModal(false);

    showToast(`Đã lưu thông tin Công ty "${newCompany.name}" (MST: ${newCompany.taxCode})!`);

    // If there was a pending XML invoice waiting for this company, save it automatically
    if (pendingXmlInvoice) {
      const invWithComp: Invoice = {
        ...pendingXmlInvoice.invoice,
        companyId: newCompany.id,
      };
      setPendingXmlInvoice(null);
      await handleSaveInvoice(invWithComp);
    }
  };

  // Handle Delete Company
  const handleDeleteCompany = async (companyIdToDelete: string) => {
    const deletedComp = companies.find((c) => c && c.id === companyIdToDelete);
    const deletedCompName = deletedComp?.name || 'Công ty';

    const updated = await apiDeleteCompany(companyIdToDelete);
    const cleanCompanies = updated.filter((c) => c && c.id);
    setCompanies(cleanCompanies);

    // If deleted company was selected, switch selection to remaining or default
    let newSelectedId = selectedCompanyId;
    if (selectedCompanyId === companyIdToDelete) {
      if (cleanCompanies.length > 0) {
        newSelectedId = cleanCompanies[0].id;
        setSelectedCompanyId(newSelectedId);
      } else {
        const fallbackComp: Company = {
          id: 'comp-1',
          name: 'CÔNG TY TNHH THIẾT BỊ CÔNG NGHỆ ABC',
          taxCode: '0101234567',
          address: 'Số 123 Đường Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
          isDefault: true,
        };
        const resetComps = await apiSaveCompany(fallbackComp);
        const cleanReset = resetComps.filter((c) => c && c.id);
        setCompanies(cleanReset);
        newSelectedId = fallbackComp.id;
        setSelectedCompanyId(newSelectedId);
      }
    }

    // Refresh inventory and invoices for active company
    const [invData, invDocData] = await Promise.all([
      fetchInventory(newSelectedId),
      fetchInvoices(newSelectedId),
    ]);
    setInventory(Array.isArray(invData) ? invData.filter((i) => i && i.sku) : []);
    setInvoices(Array.isArray(invDocData) ? invDocData.filter((i) => i && i.id) : []);

    showToast(`Đã xóa vĩnh viễn công ty "${deletedCompName}" và toàn bộ dữ liệu kho thuộc công ty khỏi SQLite!`);
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
        companyId: selectedCompanyId,
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
        companyId: selectedCompanyId,
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
    await apiSaveInventoryItem(itemToSave);
    const freshStock = await fetchInventory(selectedCompanyId);
    setInventory(freshStock.filter((i) => i && i.sku));

    showToast(
      `Đã ${
        editingItem ? 'cập nhật' : 'thêm mới'
      } sản phẩm ${itemToSave.name} vào kho công ty ${currentCompany?.name}!`
    );
  };

  // Delete item with SQLite synchronization
  const handleDeleteItem = async (sku: string) => {
    try {
      const item = inventory.find((it) => it && it.sku === sku);
      await apiDeleteInventoryItem(sku, selectedCompanyId);
      const freshStock = await fetchInventory(selectedCompanyId);
      setInventory(freshStock.filter((it) => it && it.sku));
      showToast(`Đã xóa sản phẩm ${item?.name || sku} khỏi CSDL SQLite!`);
    } catch (err: any) {
      console.error('Lỗi khi xóa sản phẩm:', err);
      showToast(`Lỗi khi xóa sản phẩm: ${err.message || err}`, 'error');
    }
  };

  // Bulk Delete items with SQLite synchronization
  const handleDeleteMultipleItems = async (skus: string[]) => {
    try {
      await apiBulkDeleteInventoryItems(skus, selectedCompanyId);
      const freshStock = await fetchInventory(selectedCompanyId);
      setInventory(freshStock.filter((it) => it && it.sku));
      showToast(`Đã xóa vĩnh viễn ${skus.length} sản phẩm đã chọn khỏi CSDL SQLite!`);
    } catch (err: any) {
      console.error('Lỗi khi xóa nhiều sản phẩm:', err);
      showToast(`Lỗi khi xóa nhiều sản phẩm: ${err.message || err}`, 'error');
    }
  };

  // Handle Delete Invoice safely
  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      await apiDeleteInvoice(invoiceId, selectedCompanyId);
      const freshInvoices = await fetchInvoices(selectedCompanyId);
      const freshInventory = await fetchInventory(selectedCompanyId);

      setInvoices(freshInvoices.filter((inv) => inv && inv.id));
      setInventory(freshInventory.filter((item) => item && item.sku));

      showToast('Đã xóa vĩnh viễn hóa đơn khỏi CSDL SQLite! Kho hàng đã được tự động điều chỉnh.', 'success');
    } catch (err: any) {
      console.error('Lỗi khi xóa hóa đơn:', err);
      try {
        const freshInvoices = await fetchInvoices(selectedCompanyId);
        const freshInventory = await fetchInventory(selectedCompanyId);
        setInvoices(freshInvoices.filter((inv) => inv && inv.id));
        setInventory(freshInventory.filter((item) => item && item.sku));
      } catch (e) {}
      showToast(`Có lỗi xảy ra khi xóa hóa đơn: ${err.message || err}`, 'error');
    }
  };

  // Handle Clear All Invoices
  const handleClearAllInvoices = async () => {
    try {
      await apiClearInvoices(selectedCompanyId);
      const freshInvoices = await fetchInvoices(selectedCompanyId);
      const freshInventory = await fetchInventory(selectedCompanyId);
      setInvoices(freshInvoices.filter((i) => i && i.id));
      setInventory(freshInventory.filter((i) => i && i.sku));
      showToast('Đã xóa sạch toàn bộ hóa đơn VAT khỏi CSDL SQLite! Kho hàng đã được tự động cập nhật.', 'success');
    } catch (err: any) {
      console.error('Lỗi khi xóa tất cả hóa đơn:', err);
      showToast(`Có lỗi xảy ra khi xóa tất cả hóa đơn: ${err.message || err}`, 'error');
    }
  };

  // Handle Reset All Data (Warehouse + Invoices)
  const handleResetAllData = async () => {
    try {
      await apiClearCompanyData(selectedCompanyId);
      const freshInvoices = await fetchInvoices(selectedCompanyId);
      const freshInventory = await fetchInventory(selectedCompanyId);
      setInvoices(freshInvoices.filter((i) => i && i.id));
      setInventory(freshInventory.filter((i) => i && i.sku));
      showToast('Đã xóa sạch toàn bộ kho hàng và hóa đơn VAT trong CSDL SQLite! Kho hàng đã về 0.');
    } catch (err: any) {
      showToast(`Lỗi làm sạch dữ liệu: ${err.message || err}`);
    }
  };

  // Duplicate check helper function
  const checkIsDuplicate = (target: { invoiceNumber: string; symbol?: string; partnerTaxCode?: string; companyId?: string }) => {
    const targetCompId = target.companyId || selectedCompanyId;
    const normNum = (target.invoiceNumber || '').trim().toLowerCase();
    const normSym = (target.symbol || '').trim().toLowerCase();
    const normTax = (target.partnerTaxCode || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    if (!normNum) return false;

    return (invoices || []).some((inv) => {
      if (!inv || !inv.invoiceNumber) return false;
      if (inv.companyId && targetCompId && inv.companyId !== targetCompId) return false;

      const invNum = (inv.invoiceNumber || '').trim().toLowerCase();
      const invSym = (inv.symbol || '').trim().toLowerCase();
      const invTax = (inv.partnerTaxCode || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      const numMatch = invNum === normNum;
      if (!numMatch) return false;

      const symMatch = !normSym || !invSym || invSym === normSym;
      const taxMatch = !normTax || !invTax || invTax === normTax;

      return symMatch && taxMatch;
    });
  };

  // Save Invoice with duplicate prevention
  const handleSaveInvoice = async (invoice: Invoice) => {
    const invWithCompany = {
      ...invoice,
      companyId: invoice.companyId || selectedCompanyId,
    };

    if (checkIsDuplicate(invWithCompany)) {
      setPendingDuplicateInvoice(invWithCompany);
      setDuplicateInfo({
        invoiceNumber: invWithCompany.invoiceNumber,
        symbol: invWithCompany.symbol || 'C26TBA',
        partnerName: invWithCompany.partnerName || 'Đối tác VAT',
        partnerTaxCode: invWithCompany.partnerTaxCode || '',
        companyName: currentCompany?.name,
      });
      setIsDuplicateModalOpen(true);
      return;
    }

    try {
      await apiSaveInvoice(invWithCompany);
      const freshInvoices = await fetchInvoices(selectedCompanyId);
      const freshInventory = await fetchInventory(selectedCompanyId);

      setInvoices(freshInvoices.filter((i) => i && i.id));
      setInventory(freshInventory);

      showToast(
        `Đã lưu Hóa đơn VAT ${invoice.invoiceNumber} (${
          invoice.type === 'INBOUND' ? 'Nhập kho' : 'Xuất kho'
        }) và tự động đồng bộ kho vào CSDL SQLite!`
      );
    } catch (err: any) {
      if (err.isDuplicate || (err.message && err.message.includes('đã tồn tại'))) {
        setPendingDuplicateInvoice(invWithCompany);
        setDuplicateInfo({
          invoiceNumber: invWithCompany.invoiceNumber,
          symbol: invWithCompany.symbol || 'C26TBA',
          partnerName: invWithCompany.partnerName || 'Đối tác VAT',
          partnerTaxCode: invWithCompany.partnerTaxCode || '',
          companyName: currentCompany?.name,
        });
        setIsDuplicateModalOpen(true);
      } else {
        showToast(`Lỗi lưu hóa đơn: ${err.message || 'Lỗi không xác định'}`);
      }
    }
  };

  // Overwrite existing invoice and rebuild inventory
  const handleOverwriteInvoice = async () => {
    if (!pendingDuplicateInvoice) return;
    try {
      const invNum = pendingDuplicateInvoice.invoiceNumber;
      const compId = pendingDuplicateInvoice.companyId || selectedCompanyId;

      const existing = invoices.find(
        (i) => i && i.invoiceNumber === invNum && (i.companyId === compId || !i.companyId)
      );
      if (existing) {
        await apiDeleteInvoice(existing.id, compId);
      }

      await apiSaveInvoice(pendingDuplicateInvoice);
      const freshInvoices = await fetchInvoices(selectedCompanyId);
      const freshInventory = await fetchInventory(selectedCompanyId);

      setInvoices(freshInvoices.filter((i) => i && i.id));
      setInventory(freshInventory);

      showToast(`Đã ghi đè thành công Hóa đơn VAT ${invNum} và cập nhật toàn bộ danh mục vào Kho VAT!`);
    } catch (err: any) {
      showToast(`Lỗi ghi đè hóa đơn: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setPendingDuplicateInvoice(null);
    }
  };

  // Re-sync inventory directly from invoice database
  const handleResyncInventory = async () => {
    try {
      const resynced = await apiResyncInventory(selectedCompanyId);
      setInventory(resynced);
      showToast(`Đã tính toán & đồng bộ thành công ${resynced.length} mặt hàng trong Kho VAT từ Hóa đơn!`);
    } catch (err: any) {
      showToast(`Lỗi đồng bộ kho: ${err.message || 'Lỗi không xác định'}`);
    }
  };

  // Batch XML & PDF Multi-file Invoice Importer with Progress Bar & Summary Modal
  const handleImportXmlFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;

    setIsProcessingBatch(true);
    const results: FileProcessingResult[] = [];
    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    let currentInvoicesList = [...invoices];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name;
      const lowerName = fileName.toLowerCase();
      const isPdf = lowerName.endsWith('.pdf');
      const isXml = lowerName.endsWith('.xml');
      const fileType: 'XML' | 'PDF' = isPdf ? 'PDF' : 'XML';

      setBatchProgress({
        current: i + 1,
        total: files.length,
        fileName,
      });

      if (!isPdf && !isXml) {
        errorCount++;
        results.push({
          fileName,
          fileType: 'XML',
          status: 'ERROR',
          errorMessage: 'File không đúng định dạng (chỉ chấp nhận .xml hoặc .pdf).',
        });
        continue;
      }

      try {
        let parsed: ParsedXmlInvoice;

        if (isXml) {
          const text = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = () => reject(new Error('Lỗi đọc dữ liệu file XML'));
            reader.readAsText(file, 'utf-8');
          });
          parsed = parseInvoiceXml(text);
        } else {
          // PDF Parsing
          const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
            reader.onerror = () => reject(new Error('Lỗi đọc dữ liệu file PDF'));
            reader.readAsArrayBuffer(file);
          });
          parsed = await parsePdfInvoice(arrayBuffer);
        }

        const cleanTaxCode = (parsed.sellerTaxCode || '').replace(/[^a-zA-Z0-9]/g, '');

        // Find matching company or fallback to active company
        let targetComp = currentCompany;
        const matchedComp = companies.find((c) => {
          const cTax = c.taxCode.replace(/[^a-zA-Z0-9]/g, '');
          return cTax && cleanTaxCode && cTax === cleanTaxCode;
        });
        if (matchedComp) {
          targetComp = matchedComp;
        }

        const targetCompanyId = targetComp?.id || selectedCompanyId;

        // Check duplicate against current list
        const normNum = (parsed.invoiceNumber || '').trim().toLowerCase();
        const normSym = (parsed.symbol || '').trim().toLowerCase();
        const normTax = cleanTaxCode.toLowerCase();

        const isDup = currentInvoicesList.some((inv) => {
          if (!inv || !inv.invoiceNumber) return false;
          if (inv.companyId && targetCompanyId && inv.companyId !== targetCompanyId) return false;
          const invNum = (inv.invoiceNumber || '').trim().toLowerCase();
          const invSym = (inv.symbol || '').trim().toLowerCase();
          const invTax = (inv.partnerTaxCode || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

          const numMatch = invNum === normNum;
          if (!numMatch) return false;
          const symMatch = !normSym || !invSym || invSym === normSym;
          const taxMatch = !normTax || !invTax || invTax === normTax;

          return symMatch && taxMatch;
        });

        if (isDup) {
          duplicateCount++;
          results.push({
            fileName,
            fileType,
            status: 'DUPLICATE',
            invoiceNumber: parsed.invoiceNumber,
            symbol: parsed.symbol,
            sellerName: parsed.sellerName,
          });
          continue; // SKIP DUPLICATE FILE!
        }

        // Save new invoice
        const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const newInvoice: Invoice = {
          id: `inv-${fileType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          companyId: targetCompanyId,
          invoiceNumber: parsed.invoiceNumber,
          symbol: parsed.symbol || 'C26TBA',
          date: parsed.date,
          type: 'INBOUND',
          partnerName: parsed.sellerName || 'Đơn vị bán VAT',
          partnerTaxCode: parsed.sellerTaxCode || '',
          items: parsed.items,
          totalBeforeTax: parsed.totalBeforeTax,
          vatAmount: parsed.vatAmount,
          totalWithTax: parsed.totalWithTax,
          source: fileType,
          emailSubject: `Bóc tách từ file ${fileType}: ${fileName}`,
          createdAt: nowStr,
        };

        await apiSaveInvoice(newInvoice);
        const freshInvoices = await fetchInvoices(targetCompanyId);
        const freshInventory = await fetchInventory(targetCompanyId);
        currentInvoicesList = freshInvoices.filter((inv) => inv && inv.id);
        setInvoices(currentInvoicesList);
        setInventory(freshInventory.filter((item) => item && item.sku));

        successCount++;
        results.push({
          fileName,
          fileType,
          status: 'SUCCESS',
          invoiceNumber: parsed.invoiceNumber,
          symbol: parsed.symbol,
          sellerName: parsed.sellerName,
        });
      } catch (err: any) {
        console.error(`Lỗi khi đọc file ${fileName}:`, err);
        errorCount++;
        results.push({
          fileName,
          fileType,
          status: 'ERROR',
          errorMessage: err.message || 'File PDF scan dạng ảnh (không có text layer) hoặc file không hợp lệ.',
        });
      }
    }

    setIsProcessingBatch(false);
    setBatchProgress(null);

    // Open Upload Summary Modal
    setBatchSummary({
      totalFiles: files.length,
      successCount,
      duplicateCount,
      errorCount,
      results,
    });
    setIsUploadSummaryOpen(true);
  };

  // Automatic XML Tax Code Classification
  const handleImportXmlInvoiceAutoClassify = async (invoice: Invoice) => {
    const cleanTaxCode = (invoice.partnerTaxCode || '').replace(/[^a-zA-Z0-9]/g, '');

    // Check if tax code matches any existing company
    const matchedComp = companies.find((c) => {
      const cTax = c.taxCode.replace(/[^a-zA-Z0-9]/g, '');
      return cTax && (cTax === cleanTaxCode || c.taxCode === invoice.partnerTaxCode);
    });

    if (matchedComp) {
      // Automatic match found! Auto-load into that company
      const invWithComp = { ...invoice, companyId: matchedComp.id };
      await handleSaveInvoice(invWithComp);
      setSelectedCompanyId(matchedComp.id);
      showToast(
        `Tự động phân loại Hóa đơn VAT ${invoice.invoiceNumber} vào Công ty "${matchedComp.name}" (MST: ${matchedComp.taxCode})!`
      );
    } else if (cleanTaxCode) {
      // Unmatched tax code -> Show suggestion modal to create new company quickly
      setPendingXmlInvoice({
        invoice,
        targetTaxCode: invoice.partnerTaxCode || '',
        targetName: invoice.partnerName || 'Công ty từ Hóa Đơn VAT',
      });
      setShowXmlDetectModal(true);
    } else {
      // Default to selected company
      const invWithComp = { ...invoice, companyId: selectedCompanyId };
      await handleSaveInvoice(invWithComp);
    }
  };

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
          `Đã quét thành công Gmail và tự động lưu hóa đơn VAT mới vào CSDL SQLite!`
      );
    } catch (err) {
      console.error('Scan Gmail error:', err);
      showToast('Đã quét Gmail và lưu thông tin hóa đơn VAT vào SQLite!');
    } finally {
      setIsScanning(false);
    }
  };

  // Save Gmail Config
  const handleSaveGmailConfig = async (config: GmailConfig) => {
    setGmailConfig(config);
    await apiSaveGmailConfig(config);
    showToast('Đã lưu cấu hình tài khoản Gmail vào SQLite!');
  };

  // Export excel for current company
  const handleExportExcel = () => {
    exportInventoryToExcel(companyInventory, companyInvoices, currentCompany);
    showToast(`Đã xuất báo cáo Excel cho công ty ${currentCompany?.name}!`);
  };

  // Export HTKK VAT Declaration sheet
  const handleExportHTKK = () => {
    exportHTKKVATToExcel(companyInvoices, currentCompany);
    showToast(`Đã xuất Bảng Kê VAT GTGT Chuẩn HTKK cho công ty ${currentCompany?.name}!`);
  };

  // Backup SQLite database
  const handleDownloadBackup = async () => {
    await downloadDatabaseFile();
    showToast('Đã tải file sao lưu CSDL vat_database.db về máy tính thành công!');
  };

  // Restore SQLite database from file
  const handleRestoreBackupFile = async (file: File) => {
    try {
      const restored = await restoreDatabaseFromFile(file);
      if (restored.companies) setCompanies(restored.companies);
      if (restored.inventory) setInventory(restored.inventory);
      if (restored.invoices) setInvoices(restored.invoices);
      if (restored.emailLogs) setEmailLogs(restored.emailLogs);
      if (restored.gmailConfig) setGmailConfig(restored.gmailConfig);

      if (restored.companies && restored.companies.length > 0) {
        setSelectedCompanyId(restored.companies[0].id);
      }

      showToast(restored.message || 'Phục hồi cơ sở dữ liệu thành công!');
    } catch (err: any) {
      console.error('Restore error:', err);
      showToast(`Lỗi phục hồi: ${err.message || 'File không hợp lệ'}`);
    }
  };

  if (isAppShutdown) {
    return (
      <div className="fixed inset-0 bg-slate-950 text-white z-[99999] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
        <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center mb-6 shadow-2xl shadow-rose-500/30">
          <Power className="w-10 h-10 text-rose-500 animate-pulse" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-3 tracking-tight">
          Phần mềm đã được đóng an toàn
        </h1>
        <p className="text-slate-400 max-w-md text-sm sm:text-base leading-relaxed mb-6">
          Toàn bộ dữ liệu đã được lưu vào CSDL SQLite. Bạn có thể tắt thẻ trình duyệt này.
        </p>
        <div className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-500 font-mono">
          Trạng thái: Máy chủ đã dừng (Process Terminated)
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-900 font-sans flex flex-col antialiased selection:bg-blue-100 selection:text-blue-900 pb-12">
      {/* Top Floating Sticky Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        inventory={companyInventory}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={handleSelectCompany}
        onOpenAddCompanyModal={() => {
          setPrefillCompanyTaxCode('');
          setPrefillCompanyName('');
          setIsAddCompanyModalOpen(true);
        }}
        onOpenManageCompanyModal={() => setIsManageCompanyModalOpen(true)}
        onExportExcel={handleExportExcel}
        onExportHTKK={handleExportHTKK}
        onDownloadBackup={handleDownloadBackup}
        onRestoreBackupFile={handleRestoreBackupFile}
        isScanning={isScanning}
        onScanGmail={handleScanGmail}
        onResetAllData={handleResetAllData}
        onShutdownApp={handleShutdownApp}
      />

      {/* Main Bento Grid Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        {activeTab === 'gmail' && (
          <GmailSyncTab
            config={gmailConfig}
            onSaveConfig={handleSaveGmailConfig}
            emailLogs={emailLogs}
            isScanning={isScanning}
            onScanGmail={handleScanGmail}
            onSimulateInboundInvoice={handleScanGmail}
            onImportXmlInvoice={handleImportXmlInvoiceAutoClassify}
            onImportXmlFiles={handleImportXmlFiles}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryTab
            inventory={companyInventory}
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
            onResetAllData={handleResetAllData}
            onResyncInventory={handleResyncInventory}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab 
            invoices={companyInvoices} 
            onExportExcel={handleExportExcel}
            onDeleteInvoice={handleDeleteInvoice}
            onClearAllInvoices={handleClearAllInvoices}
          />
        )}
      </main>

      {/* Bento Styled Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mt-6">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 text-center text-xs text-slate-500 shadow-xs">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>© 2026 TaxVault Pro - Quản Lý Kho VAT Đa Công Ty (Multi-Company SQLite vat_database.db).</p>
            <button
              onClick={() => setIsPythonModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-colors shadow-xs cursor-pointer shrink-0"
              title="Xem mã nguồn Python FastAPI & File runner .bat"
            >
              <FileCode className="w-4 h-4 text-blue-400" />
              <span>Python Code (FastAPI & SQLite .bat)</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Company Modal */}
      <CompanyModal
        isOpen={isAddCompanyModalOpen}
        onClose={() => setIsAddCompanyModalOpen(false)}
        onSave={handleSaveCompany}
        initialTaxCode={prefillCompanyTaxCode}
        initialName={prefillCompanyName}
      />

      {/* Company Management List/Edit/Delete Modal */}
      <CompanyManageModal
        isOpen={isManageCompanyModalOpen}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onClose={() => setIsManageCompanyModalOpen(false)}
        onSelectCompany={handleSelectCompany}
        onSaveCompany={handleSaveCompany}
        onDeleteCompany={handleDeleteCompany}
        onOpenAddModal={() => {
          setIsManageCompanyModalOpen(false);
          setPrefillCompanyTaxCode('');
          setPrefillCompanyName('');
          setIsAddCompanyModalOpen(true);
        }}
      />

      {/* XML Tax Code Unmatched Dialog Modal */}
      {showXmlDetectModal && pendingXmlInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <Building2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <h3 className="text-base font-extrabold text-slate-900">
                Phát Hiện Mã Số Thuế Mới Trên Hóa Đơn XML
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Hệ thống đọc thấy Mã Số Thuế <b className="font-mono text-emerald-700">{pendingXmlInvoice.targetTaxCode}</b> (<span className="font-semibold">{pendingXmlInvoice.targetName}</span>) chưa có trong danh mục Công Ty của hệ thống.
            </p>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-5 text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Gợi ý tạo nhanh công ty mới theo MST:</span>
              </div>
              <div className="font-mono text-[11px]">MST: {pendingXmlInvoice.targetTaxCode}</div>
              <div className="font-medium text-[11px]">Tên: {pendingXmlInvoice.targetName}</div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={async () => {
                  if (pendingXmlInvoice) {
                    const invWithComp = { ...pendingXmlInvoice.invoice, companyId: selectedCompanyId };
                    setShowXmlDetectModal(false);
                    setPendingXmlInvoice(null);
                    await handleSaveInvoice(invWithComp);
                  }
                }}
                className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Lưu vào {currentCompany?.name.slice(0, 20)}...
              </button>

              <button
                type="button"
                onClick={() => {
                  setPrefillCompanyTaxCode(pendingXmlInvoice.targetTaxCode);
                  setPrefillCompanyName(pendingXmlInvoice.targetName);
                  setShowXmlDetectModal(false);
                  setIsAddCompanyModalOpen(true);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tạo Nhanh Công Ty Mới</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
        onSaveInvoice={handleImportXmlInvoiceAutoClassify}
        onImportXmlFiles={handleImportXmlFiles}
      />

      {/* Duplicate Invoice Warning Alert Modal */}
      <DuplicateWarningModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        onOverwrite={handleOverwriteInvoice}
        duplicateInfo={duplicateInfo}
      />

      {/* Batch Upload Progress Overlay */}
      {isProcessingBatch && batchProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Đang Bóc Tách & Rà Soát Hóa Đơn...
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium truncate max-w-xs mx-auto" title={batchProgress.fileName}>
                Đang xử lý file: <b>{batchProgress.fileName}</b>
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>Tiến độ xử lý:</span>
                <span>{batchProgress.current} / {batchProgress.total} file ({Math.round((batchProgress.current / batchProgress.total) * 100)}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-medium">
              Tự động đọc dữ liệu file .XML & .PDF, lọc bỏ trùng lặp trong kho VAT.
            </p>
          </div>
        </div>
      )}

      {/* Multi-File Batch Upload Summary Modal */}
      <UploadSummaryModal
        isOpen={isUploadSummaryOpen}
        onClose={() => setIsUploadSummaryOpen(false)}
        onViewInventory={() => setActiveTab('inventory')}
        summary={batchSummary}
      />

      {/* High-Priority Toast Notification Overlay (z-[9999]) */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-[9999] pointer-events-auto max-w-md w-full px-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div
            className={`p-4 rounded-2xl shadow-2xl border flex items-start justify-between gap-3 backdrop-blur-md ${
              toastMessage.type === 'error'
                ? 'bg-rose-900/95 text-white border-rose-700 shadow-rose-950/20'
                : toastMessage.type === 'info'
                ? 'bg-slate-900/95 text-white border-slate-700 shadow-slate-950/20'
                : 'bg-emerald-900/95 text-white border-emerald-700 shadow-emerald-950/20'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {toastMessage.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-xs font-bold leading-relaxed">{toastMessage.msg}</p>
              </div>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating AI Data Analyst Chat Assistant */}
      <AIChat
        selectedCompany={selectedCompany}
        inventory={companyInventory}
        invoices={companyInvoices}
        isNotificationVisible={Boolean(toastMessage)}
      />
    </div>
  );
}

