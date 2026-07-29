import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  getDatabase,
  getAllInventory,
  saveOrUpdateInventoryItem,
  deleteInventoryItemBySku,
  deleteMultipleInventoryItems,
  getAllInvoices,
  addInvoiceAndUpdateStock,
  getGmailConfig,
  saveGmailConfig,
  getAllEmailLogs,
  addEmailLog,
} from './src/db/sqliteServer.js';
import { Invoice, EmailLog } from './src/types.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize SQLite database (vat_database.db)
  const db = await getDatabase();
  console.log('SQLite Database (vat_database.db) initialized successfully.');

  // ==========================================
  // API ROUTES
  // ==========================================

  // 1. Inventory Routes
  app.get('/api/inventory', (req, res) => {
    try {
      const items = getAllInventory(db);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory', (req, res) => {
    try {
      const item = req.body;
      saveOrUpdateInventoryItem(db, item);
      const updated = getAllInventory(db);
      res.json({ success: true, item, inventory: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/inventory/:sku', (req, res) => {
    try {
      const { sku } = req.params;
      deleteInventoryItemBySku(db, sku);
      const updated = getAllInventory(db);
      res.json({ success: true, sku, inventory: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory/bulk-delete', (req, res) => {
    try {
      const { skus } = req.body;
      deleteMultipleInventoryItems(db, skus);
      const updated = getAllInventory(db);
      res.json({ success: true, count: skus.length, inventory: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Invoice Routes
  app.get('/api/invoices', (req, res) => {
    try {
      const invoices = getAllInvoices(db);
      res.json(invoices);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/invoices', (req, res) => {
    try {
      const invoice: Invoice = req.body;
      addInvoiceAndUpdateStock(db, invoice);
      const updatedInvoices = getAllInvoices(db);
      const updatedInventory = getAllInventory(db);
      res.json({ success: true, invoice, invoices: updatedInvoices, inventory: updatedInventory });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Gmail Config Routes
  app.get('/api/gmail-config', (req, res) => {
    try {
      const config = getGmailConfig(db);
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/gmail-config', (req, res) => {
    try {
      const config = req.body;
      saveGmailConfig(db, config);
      const updated = getGmailConfig(db);
      res.json({ success: true, config: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Email Log Routes
  app.get('/api/email-logs', (req, res) => {
    try {
      const logs = getAllEmailLogs(db);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/email-logs', (req, res) => {
    try {
      const log: EmailLog = req.body;
      addEmailLog(db, log);
      const updated = getAllEmailLogs(db);
      res.json({ success: true, logs: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Scan Gmail & Import VAT
  app.post('/api/scan-gmail', (req, res) => {
    try {
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const dateOnly = nowStr.split(' ')[0];

      // Update Gmail config last sync time
      const config = getGmailConfig(db);
      config.lastSyncTime = nowStr;
      saveGmailConfig(db, config);

      // Create simulated new VAT invoice
      const newInvoiceNumber = String(Math.floor(1000000 + Math.random() * 9000000));
      const simulatedInvoice: Invoice = {
        id: `inv-gmail-${Date.now()}`,
        invoiceNumber: newInvoiceNumber,
        symbol: 'C26TBA',
        date: dateOnly,
        type: 'INBOUND',
        partnerName: 'Công ty Cổ phần Công Nghệ Điện Tử Á Châu',
        partnerTaxCode: '0109887766',
        items: [
          {
            id: `ii-scan-${Date.now()}-1`,
            sku: 'MON-LG-27',
            name: 'Màn hình máy tính LG 27 inch Full HD 100Hz',
            unit: 'Cái',
            quantity: 10,
            unitPrice: 3400000,
            vatRate: 10,
            totalAmount: 34000000,
          },
          {
            id: `ii-scan-${Date.now()}-2`,
            sku: 'KEY-LOG-K380',
            name: 'Bàn phím Bluetooth Logitech K380 Multi-Device',
            unit: 'Cái',
            quantity: 15,
            unitPrice: 560000,
            vatRate: 10,
            totalAmount: 840000,
          }
        ],
        totalBeforeTax: 42400000,
        vatAmount: 4240000,
        totalWithTax: 46640000,
        source: 'GMAIL',
        emailSubject: `Hóa đơn điện tử VAT số ${newInvoiceNumber} - Á Châu Tech`,
        createdAt: nowStr,
      };

      // Add invoice and update stock in SQLite
      addInvoiceAndUpdateStock(db, simulatedInvoice);

      // Add email log
      const log: EmailLog = {
        id: `log-${Date.now()}`,
        timestamp: nowStr,
        sender: 'einvoice@achau-tech.com.vn',
        subject: `Hóa đơn điện tử VAT số ${newInvoiceNumber} - Á Châu Tech`,
        hasAttachment: true,
        attachmentName: `HD_${newInvoiceNumber}_C26TBA.xml`,
        status: 'SUCCESS',
        invoiceId: simulatedInvoice.id,
        parsedItemCount: 2,
      };
      addEmailLog(db, log);

      const updatedInventory = getAllInventory(db);
      const updatedInvoices = getAllInvoices(db);
      const updatedLogs = getAllEmailLogs(db);
      const updatedConfig = getGmailConfig(db);

      res.json({
        success: true,
        invoice: simulatedInvoice,
        log,
        inventory: updatedInventory,
        invoices: updatedInvoices,
        emailLogs: updatedLogs,
        gmailConfig: updatedConfig,
        message: 'Đã tự động kết nối Gmail, bóc tách hóa đơn XML và ghi dữ liệu SQLite (vat_database.db) thành công!'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite Middleware for Dev
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
