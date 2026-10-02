import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { initialCompanies, initialInventoryItems, initialInvoices, initialEmailLogs, initialGmailConfig } from '../data/initialData.js';
import { Company, InventoryItem, Invoice, EmailLog, GmailConfig } from '../types.js';

const DB_FILE_PATH = path.join(process.cwd(), 'vat_database.db');

let dbInstance: Database | null = null;

/**
 * Initialize SQLite database with vat_database.db
 */
export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE_PATH)) {
    const fileBuffer = fs.readFileSync(DB_FILE_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
    initSchemaAndSeed(dbInstance);
    saveDatabase(dbInstance);
  }

  // Ensure tables and columns exist even if file already existed
  ensureSchema(dbInstance);
  saveDatabase(dbInstance);

  return dbInstance;
}

/**
 * Persist SQLite memory database to disk file vat_database.db
 */
export function saveDatabase(db: Database = dbInstance!) {
  if (!db) return;
  const binaryArray = db.export();
  const buffer = Buffer.from(binaryArray);
  fs.writeFileSync(DB_FILE_PATH, buffer);
}

function ensureSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      taxCode TEXT UNIQUE NOT NULL,
      address TEXT,
      isDefault INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      companyId TEXT,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT NOT NULL,
      totalInbound INTEGER NOT NULL DEFAULT 0,
      totalOutbound INTEGER NOT NULL DEFAULT 0,
      currentStock INTEGER NOT NULL DEFAULT 0,
      minStockThreshold INTEGER NOT NULL DEFAULT 5,
      averageCost REAL NOT NULL DEFAULT 0,
      lastUpdated TEXT,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      companyId TEXT,
      invoiceNumber TEXT NOT NULL,
      symbol TEXT,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      partnerName TEXT NOT NULL,
      partnerTaxCode TEXT,
      items TEXT NOT NULL,
      totalBeforeTax REAL NOT NULL,
      vatAmount REAL NOT NULL,
      totalWithTax REAL NOT NULL,
      source TEXT NOT NULL,
      emailSubject TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      sender TEXT NOT NULL,
      subject TEXT NOT NULL,
      hasAttachment INTEGER NOT NULL DEFAULT 0,
      attachmentName TEXT,
      status TEXT NOT NULL,
      invoiceId TEXT,
      parsedItemCount INTEGER
    );

    CREATE TABLE IF NOT EXISTS gmail_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      email TEXT,
      appPassword TEXT,
      isConnected INTEGER NOT NULL DEFAULT 0,
      autoScanIntervalMinutes INTEGER DEFAULT 15,
      lastSyncTime TEXT,
      imapHost TEXT,
      imapPort INTEGER,
      enableAlerts INTEGER DEFAULT 1,
      alertEmailRecipient TEXT
    );
  `);

  // Safely add companyId column to existing databases
  try { db.run(`ALTER TABLE inventory ADD COLUMN companyId TEXT;`); } catch {}
  try { db.run(`ALTER TABLE invoices ADD COLUMN companyId TEXT;`); } catch {}

  // Seed default companies if companies table is empty
  const resComp = db.exec(`SELECT count(*) as count FROM companies`);
  if (!resComp || resComp.length === 0 || Number(resComp[0].values[0][0]) === 0) {
    const stmtComp = db.prepare(`
      INSERT INTO companies (id, name, taxCode, address, isDefault)
      VALUES (?, ?, ?, ?, ?)
    `);
    initialCompanies.forEach((comp) => {
      stmtComp.run([comp.id, comp.name, comp.taxCode, comp.address || '', comp.isDefault ? 1 : 0]);
    });
    stmtComp.free();

    // Set existing inventory & invoices to comp-1 if companyId is NULL
    db.run(`UPDATE inventory SET companyId = 'comp-1' WHERE companyId IS NULL OR companyId = ''`);
    db.run(`UPDATE invoices SET companyId = 'comp-1' WHERE companyId IS NULL OR companyId = ''`);
  }
}

function initSchemaAndSeed(db: Database) {
  ensureSchema(db);

  // Seed inventory
  const stmtInv = db.prepare(`
    INSERT INTO inventory (id, companyId, sku, name, category, unit, totalInbound, totalOutbound, currentStock, minStockThreshold, averageCost, lastUpdated, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  initialInventoryItems.forEach((item) => {
    stmtInv.run([
      item.id,
      item.companyId || 'comp-1',
      item.sku,
      item.name,
      item.category || '',
      item.unit,
      item.totalInbound,
      item.totalOutbound,
      item.currentStock,
      item.minStockThreshold,
      item.averageCost,
      item.lastUpdated,
      item.note || ''
    ]);
  });
  stmtInv.free();

  // Seed invoices
  const stmtInvDoc = db.prepare(`
    INSERT INTO invoices (id, companyId, invoiceNumber, symbol, date, type, partnerName, partnerTaxCode, items, totalBeforeTax, vatAmount, totalWithTax, source, emailSubject, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  initialInvoices.forEach((inv) => {
    stmtInvDoc.run([
      inv.id,
      inv.companyId || 'comp-1',
      inv.invoiceNumber,
      inv.symbol || '',
      inv.date,
      inv.type,
      inv.partnerName,
      inv.partnerTaxCode || '',
      JSON.stringify(inv.items),
      inv.totalBeforeTax,
      inv.vatAmount,
      inv.totalWithTax,
      inv.source,
      inv.emailSubject || '',
      inv.createdAt
    ]);
  });
  stmtInvDoc.free();

  // Seed email logs
  const stmtLog = db.prepare(`
    INSERT INTO email_logs (id, timestamp, sender, subject, hasAttachment, attachmentName, status, invoiceId, parsedItemCount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  initialEmailLogs.forEach((log) => {
    stmtLog.run([
      log.id,
      log.timestamp,
      log.sender,
      log.subject,
      log.hasAttachment ? 1 : 0,
      log.attachmentName || '',
      log.status,
      log.invoiceId || '',
      log.parsedItemCount || 0
    ]);
  });
  stmtLog.free();

  // Seed Gmail Config
  const stmtConfig = db.prepare(`
    INSERT INTO gmail_config (id, email, appPassword, isConnected, autoScanIntervalMinutes, lastSyncTime, imapHost, imapPort, enableAlerts, alertEmailRecipient)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmtConfig.run([
    initialGmailConfig.email,
    initialGmailConfig.appPassword,
    initialGmailConfig.isConnected ? 1 : 0,
    initialGmailConfig.autoScanIntervalMinutes,
    initialGmailConfig.lastSyncTime,
    initialGmailConfig.imapHost,
    initialGmailConfig.imapPort,
    initialGmailConfig.enableAlerts ? 1 : 0,
    initialGmailConfig.alertEmailRecipient
  ]);
  stmtConfig.free();
}

// ==========================================
// DB ACCESSORS & MUTATORS
// ==========================================

export function getAllCompanies(db: Database): Company[] {
  const res = db.exec(`SELECT * FROM companies ORDER BY isDefault DESC, rowid ASC`);
  if (!res || res.length === 0) return [];
  const columns = res[0].columns;
  const values = res[0].values;

  return values.map((row) => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return {
      id: obj.id,
      name: obj.name,
      taxCode: obj.taxCode,
      address: obj.address || '',
      isDefault: Boolean(obj.isDefault),
    };
  });
}

export function saveOrUpdateCompany(db: Database, company: Company): Company[] {
  const existing = db.exec(`SELECT id FROM companies WHERE id = '${company.id.replace(/'/g, "''")}'`);
  if (existing.length > 0 && existing[0].values.length > 0) {
    db.run(
      `UPDATE companies SET name = ?, taxCode = ?, address = ?, isDefault = ? WHERE id = ?`,
      [company.name, company.taxCode, company.address || '', company.isDefault ? 1 : 0, company.id]
    );
  } else {
    db.run(
      `INSERT INTO companies (id, name, taxCode, address, isDefault) VALUES (?, ?, ?, ?, ?)`,
      [company.id || `comp-${Date.now()}`, company.name, company.taxCode, company.address || '', company.isDefault ? 1 : 0]
    );
  }
  saveDatabase(db);
  return getAllCompanies(db);
}

export function deleteCompany(db: Database, id: string): Company[] {
  db.run(`DELETE FROM companies WHERE id = ?`, [id]);
  db.run(`DELETE FROM inventory WHERE companyId = ?`, [id]);
  db.run(`DELETE FROM invoices WHERE companyId = ?`, [id]);
  saveDatabase(db);
  return getAllCompanies(db);
}

export function getAllInventory(db: Database, companyId?: string): InventoryItem[] {
  const query = companyId 
    ? `SELECT * FROM inventory WHERE companyId = '${companyId.replace(/'/g, "''")}' ORDER BY rowid DESC`
    : `SELECT * FROM inventory ORDER BY rowid DESC`;
  const res = db.exec(query);
  if (!res || res.length === 0) return [];
  const columns = res[0].columns;
  const values = res[0].values;

  return values.map((row) => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return {
      id: obj.id,
      companyId: obj.companyId || 'comp-1',
      sku: obj.sku,
      name: obj.name,
      category: obj.category,
      unit: obj.unit,
      totalInbound: Number(obj.totalInbound),
      totalOutbound: Number(obj.totalOutbound),
      currentStock: Number(obj.currentStock),
      minStockThreshold: Number(obj.minStockThreshold),
      averageCost: Number(obj.averageCost),
      lastUpdated: obj.lastUpdated,
      note: obj.note,
    };
  });
}

export function saveOrUpdateInventoryItem(db: Database, item: InventoryItem) {
  const companyId = item.companyId || 'comp-1';
  const existing = db.exec(`SELECT sku FROM inventory WHERE sku = '${item.sku.replace(/'/g, "''")}' AND (companyId = '${companyId}' OR companyId IS NULL)`);
  if (existing.length > 0 && existing[0].values.length > 0) {
    db.run(
      `UPDATE inventory SET 
        name = ?, category = ?, unit = ?, totalInbound = ?, totalOutbound = ?, currentStock = ?, minStockThreshold = ?, averageCost = ?, lastUpdated = ?, note = ?, companyId = ?
       WHERE sku = ? AND (companyId = ? OR companyId IS NULL)`,
      [
        item.name,
        item.category || '',
        item.unit,
        item.totalInbound,
        item.totalOutbound,
        item.currentStock,
        item.minStockThreshold,
        item.averageCost,
        item.lastUpdated,
        item.note || '',
        companyId,
        item.sku,
        companyId,
      ]
    );
  } else {
    db.run(
      `INSERT INTO inventory (id, companyId, sku, name, category, unit, totalInbound, totalOutbound, currentStock, minStockThreshold, averageCost, lastUpdated, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id || `inv-${Date.now()}`,
        companyId,
        item.sku,
        item.name,
        item.category || '',
        item.unit,
        item.totalInbound,
        item.totalOutbound,
        item.currentStock,
        item.minStockThreshold,
        item.averageCost,
        item.lastUpdated,
        item.note || ''
      ]
    );
  }
  saveDatabase(db);
}

export function deleteInventoryItemBySku(db: Database, sku: string, companyId?: string) {
  if (companyId) {
    db.run(`DELETE FROM inventory WHERE sku = ? AND companyId = ?`, [sku, companyId]);
  } else {
    db.run(`DELETE FROM inventory WHERE sku = ?`, [sku]);
  }
  saveDatabase(db);
}

export function deleteMultipleInventoryItems(db: Database, skus: string[], companyId?: string) {
  if (!skus || skus.length === 0) return;
  const placeholders = skus.map(() => '?').join(',');
  if (companyId) {
    db.run(`DELETE FROM inventory WHERE sku IN (${placeholders}) AND companyId = ?`, [...skus, companyId]);
  } else {
    db.run(`DELETE FROM inventory WHERE sku IN (${placeholders})`, skus);
  }
  saveDatabase(db);
}

export function getAllInvoices(db: Database, companyId?: string): Invoice[] {
  const query = companyId 
    ? `SELECT * FROM invoices WHERE companyId = '${companyId.replace(/'/g, "''")}' ORDER BY rowid DESC`
    : `SELECT * FROM invoices ORDER BY rowid DESC`;
  const res = db.exec(query);
  if (!res || res.length === 0) return [];
  const columns = res[0].columns;
  const values = res[0].values;

  return values.map((row) => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    let parsedItems = [];
    try {
      parsedItems = JSON.parse(obj.items);
    } catch {
      parsedItems = [];
    }
    return {
      id: obj.id,
      companyId: obj.companyId || 'comp-1',
      invoiceNumber: obj.invoiceNumber,
      symbol: obj.symbol,
      date: obj.date,
      type: obj.type as 'INBOUND' | 'OUTBOUND',
      partnerName: obj.partnerName,
      partnerTaxCode: obj.partnerTaxCode,
      items: parsedItems,
      totalBeforeTax: Number(obj.totalBeforeTax),
      vatAmount: Number(obj.vatAmount),
      totalWithTax: Number(obj.totalWithTax),
      source: obj.source as 'GMAIL' | 'EXCEL' | 'MANUAL',
      emailSubject: obj.emailSubject,
      createdAt: obj.createdAt,
    };
  });
}

export function isInvoiceDuplicateInDb(db: Database, companyId: string, invoiceNumber: string, symbol: string, partnerTaxCode: string): boolean {
  const normNum = (invoiceNumber || '').trim().toLowerCase();
  const normSym = (symbol || '').trim().toLowerCase();
  const normTax = (partnerTaxCode || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  const invoices = getAllInvoices(db, companyId);
  return invoices.some((inv) => {
    const invNum = (inv.invoiceNumber || '').trim().toLowerCase();
    const invSym = (inv.symbol || '').trim().toLowerCase();
    const invTax = (inv.partnerTaxCode || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const numMatch = invNum === normNum;
    const symMatch = !normSym || !invSym || invSym === normSym;
    const taxMatch = !normTax || !invTax || invTax === normTax;

    return numMatch && symMatch && taxMatch;
  });
}

export function deleteInvoiceById(db: Database, id: string, companyId?: string): { invoices: Invoice[]; inventory: InventoryItem[] } {
  let actualId = id;
  let invCompId = companyId || 'comp-1';

  try {
    // 1. Find target invoice record by id or invoiceNumber
    let res = db.exec(`SELECT * FROM invoices WHERE id = ?`, [id]);
    if (!res || res.length === 0 || res[0].values.length === 0) {
      res = db.exec(`SELECT * FROM invoices WHERE invoiceNumber = ?`, [id]);
    }

    if (res && res.length > 0 && res[0].values.length > 0) {
      const row = res[0].values[0];
      const columns = res[0].columns;
      actualId = (row[columns.indexOf('id')] as string) || id;
      invCompId = (row[columns.indexOf('companyId')] as string) || companyId || 'comp-1';

      // Delete from invoice_items and invoices
      try { db.run(`DELETE FROM invoice_items WHERE invoice_id = ?`, [actualId]); } catch {}
      try { db.run(`DELETE FROM invoices WHERE id = ?`, [actualId]); } catch {}
    }
  } catch (err) {
    console.error('Error during delete invoice:', err);
  }

  // Backup delete by ID and invoiceNumber directly
  try { db.run(`DELETE FROM invoice_items WHERE invoice_id = ?`, [id]); } catch {}
  try { db.run(`DELETE FROM invoices WHERE id = ? OR invoiceNumber = ?`, [id, id]); } catch {}

  // Recalculate inventory directly from remaining invoices for Single Source of Truth
  resyncInventoryFromInvoices(db, invCompId);
  saveDatabase(db);

  return {
    invoices: getAllInvoices(db, invCompId),
    inventory: getAllInventory(db, invCompId),
  };
}

/**
 * Automatically recalculates and resynchronizes the inventory table directly from the invoices table
 * to ensure Single Source of Truth.
 */
export function resyncInventoryFromInvoices(db: Database, companyId?: string): InventoryItem[] {
  const targetCompanyId = companyId || 'comp-1';
  const invoices = getAllInvoices(db, targetCompanyId);

  const inventoryMap: { [sku: string]: InventoryItem } = {};

  invoices.forEach((inv) => {
    const invType = (inv.type || 'INBOUND').toUpperCase();
    const invDate = inv.date || new Date().toISOString().split('T')[0];
    const items = Array.isArray(inv.items) ? inv.items : [];

    items.forEach((item, idx) => {
      if (!item) return;
      const rawName = item.name || `Sản phẩm HĐ ${inv.invoiceNumber}`;
      const rawSku = (item.sku || '').trim();
      const sku = (rawSku || `SP-VAT-${idx + 1}`).toUpperCase();
      const unit = item.unit || 'Cái';
      const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
      const price = Number(item.unitPrice) || 0;

      if (!inventoryMap[sku]) {
        inventoryMap[sku] = {
          id: `inv-${targetCompanyId}-${sku.replace(/[^a-zA-Z0-9]/g, '-')}`,
          companyId: targetCompanyId,
          sku: sku,
          name: rawName,
          category: 'Hàng VAT',
          unit: unit,
          totalInbound: 0,
          totalOutbound: 0,
          currentStock: 0,
          minStockThreshold: 5,
          averageCost: price,
          lastUpdated: invDate,
          note: `Đồng bộ từ HĐ ${inv.invoiceNumber}`,
        };
      }

      const invItem = inventoryMap[sku];
      if (invType === 'INBOUND') {
        invItem.totalInbound += qty;
        if (price > 0) {
          invItem.averageCost = price;
        }
      } else {
        invItem.totalOutbound += qty;
      }

      invItem.currentStock = Math.max(0, invItem.totalInbound - invItem.totalOutbound);
      invItem.lastUpdated = invDate;
    });
  });

  // Clear existing inventory for target company and insert rebuilt inventory items
  try {
    if (targetCompanyId) {
      db.run(`DELETE FROM inventory WHERE companyId = ? OR companyId IS NULL OR companyId = ''`, [targetCompanyId]);
    } else {
      db.run(`DELETE FROM inventory`);
    }
  } catch {}

  const stmt = db.prepare(`
    INSERT INTO inventory (id, companyId, sku, name, category, unit, totalInbound, totalOutbound, currentStock, minStockThreshold, averageCost, lastUpdated, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  Object.values(inventoryMap).forEach((item) => {
    stmt.run([
      item.id,
      item.companyId || targetCompanyId,
      item.sku,
      item.name,
      item.category || 'Hàng VAT',
      item.unit || 'Cái',
      item.totalInbound,
      item.totalOutbound,
      item.currentStock,
      item.minStockThreshold ?? 5,
      item.averageCost,
      item.lastUpdated,
      item.note || '',
    ]);
  });
  stmt.free();

  saveDatabase(db);
  return getAllInventory(db, targetCompanyId);
}

export function clearInvoices(db: Database, companyId?: string): { invoices: Invoice[]; inventory: InventoryItem[] } {
  try {
    if (companyId) {
      db.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE companyId = ? OR companyId IS NULL OR companyId = '')`, [companyId]);
    } else {
      db.run(`DELETE FROM invoice_items`);
    }
  } catch {}
  if (companyId) {
    db.run(`DELETE FROM invoices WHERE companyId = ? OR companyId IS NULL OR companyId = ''`, [companyId]);
  } else {
    db.run(`DELETE FROM invoices`);
  }
  saveDatabase(db);
  return {
    invoices: getAllInvoices(db, companyId),
    inventory: getAllInventory(db, companyId),
  };
}

export function clearCompanyData(db: Database, companyId?: string): { invoices: Invoice[]; inventory: InventoryItem[] } {
  try {
    if (companyId) {
      db.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE companyId = ? OR companyId IS NULL OR companyId = '')`, [companyId]);
    } else {
      db.run(`DELETE FROM invoice_items`);
    }
  } catch {}
  if (companyId) {
    db.run(`DELETE FROM inventory WHERE companyId = ? OR companyId IS NULL OR companyId = ''`, [companyId]);
    db.run(`DELETE FROM invoices WHERE companyId = ? OR companyId IS NULL OR companyId = ''`, [companyId]);
  } else {
    db.run(`DELETE FROM inventory`);
    db.run(`DELETE FROM invoices`);
  }
  saveDatabase(db);
  return {
    invoices: [],
    inventory: [],
  };
}

export function clearAllInventoryAndInvoices(db: Database, companyId?: string): { invoices: Invoice[]; inventory: InventoryItem[] } {
  return clearCompanyData(db, companyId);
}

export function addInvoiceAndUpdateStock(db: Database, invoice: Invoice) {
  const companyId = invoice.companyId || 'comp-1';

  // Check duplicate invoice (Số HĐ + Ký hiệu + MST người bán/đối tác)
  if (isInvoiceDuplicateInDb(db, companyId, invoice.invoiceNumber, invoice.symbol || '', invoice.partnerTaxCode || '')) {
    throw new Error(
      `Hóa đơn số ${invoice.invoiceNumber} (Ký hiệu: ${invoice.symbol || 'C26TBA'}) từ ${invoice.partnerName || 'Đối tác'} (MST: ${invoice.partnerTaxCode || 'N/A'}) đã tồn tại trong kho của công ty này. Không thể nhập trùng!`
    );
  }

  // 1. Insert invoice
  db.run(
    `INSERT INTO invoices (id, companyId, invoiceNumber, symbol, date, type, partnerName, partnerTaxCode, items, totalBeforeTax, vatAmount, totalWithTax, source, emailSubject, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invoice.id,
      companyId,
      invoice.invoiceNumber,
      invoice.symbol || '',
      invoice.date,
      invoice.type,
      invoice.partnerName,
      invoice.partnerTaxCode || '',
      JSON.stringify(invoice.items),
      invoice.totalBeforeTax,
      invoice.vatAmount,
      invoice.totalWithTax,
      invoice.source,
      invoice.emailSubject || '',
      invoice.createdAt
    ]
  );

  // 1b. Insert into invoice_items
  if (Array.isArray(invoice.items)) {
    invoice.items.forEach((item) => {
      const iiId = item.id || `ii-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      db.run(
        `INSERT INTO invoice_items (id, invoice_id, sku, name, unit, quantity, unitPrice, totalPrice)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [iiId, invoice.id, item.sku, item.name, item.unit, item.quantity, item.unitPrice, item.totalAmount || (item.quantity * item.unitPrice)]
      );
    });
  }

  // 2. Update inventory stock for items in invoice for this company
  const currentInv = getAllInventory(db, companyId);
  const nowStr = new Date().toISOString().split('T')[0];

  invoice.items.forEach((item) => {
    const existing = currentInv.find((i) => i.sku.toUpperCase() === item.sku.toUpperCase());
    if (existing) {
      if (invoice.type === 'INBOUND') {
        existing.totalInbound += item.quantity;
        existing.currentStock = existing.totalInbound - existing.totalOutbound;
        existing.averageCost = item.unitPrice;
      } else {
        existing.totalOutbound += item.quantity;
        existing.currentStock = existing.totalInbound - existing.totalOutbound;
      }
      existing.lastUpdated = nowStr;
      existing.companyId = companyId;
      saveOrUpdateInventoryItem(db, existing);
    } else if (invoice.type === 'INBOUND') {
      // Create new inventory item if inbound
      const newItem: InventoryItem = {
        id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        companyId: companyId,
        sku: item.sku,
        name: item.name,
        category: 'Hàng VAT Mới',
        unit: item.unit,
        totalInbound: item.quantity,
        totalOutbound: 0,
        currentStock: item.quantity,
        minStockThreshold: 5,
        averageCost: item.unitPrice,
        lastUpdated: nowStr,
        note: `Nhập tự động từ HĐ VAT ${invoice.invoiceNumber}`,
      };
      saveOrUpdateInventoryItem(db, newItem);
    }
  });

  saveDatabase(db);
}

export function getGmailConfig(db: Database): GmailConfig {
  const res = db.exec(`SELECT * FROM gmail_config WHERE id = 1`);
  if (!res || res.length === 0 || res[0].values.length === 0) {
    return initialGmailConfig;
  }
  const columns = res[0].columns;
  const row = res[0].values[0];
  const obj: any = {};
  columns.forEach((col, idx) => {
    obj[col] = row[idx];
  });

  return {
    email: obj.email,
    appPassword: obj.appPassword,
    isConnected: Boolean(obj.isConnected),
    autoScanIntervalMinutes: Number(obj.autoScanIntervalMinutes),
    lastSyncTime: obj.lastSyncTime,
    imapHost: obj.imapHost,
    imapPort: Number(obj.imapPort),
    enableAlerts: Boolean(obj.enableAlerts),
    alertEmailRecipient: obj.alertEmailRecipient,
  };
}

export function saveGmailConfig(db: Database, config: GmailConfig) {
  db.run(
    `UPDATE gmail_config SET 
      email = ?, appPassword = ?, isConnected = ?, autoScanIntervalMinutes = ?, lastSyncTime = ?, imapHost = ?, imapPort = ?, enableAlerts = ?, alertEmailRecipient = ?
     WHERE id = 1`,
    [
      config.email,
      config.appPassword,
      config.isConnected ? 1 : 0,
      config.autoScanIntervalMinutes,
      config.lastSyncTime,
      config.imapHost,
      config.imapPort || 993,
      config.enableAlerts ? 1 : 0,
      config.alertEmailRecipient || ''
    ]
  );
  saveDatabase(db);
}

export function getAllEmailLogs(db: Database): EmailLog[] {
  const res = db.exec(`SELECT * FROM email_logs ORDER BY rowid DESC`);
  if (!res || res.length === 0) return [];
  const columns = res[0].columns;
  const values = res[0].values;

  return values.map((row) => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return {
      id: obj.id,
      timestamp: obj.timestamp,
      sender: obj.sender,
      subject: obj.subject,
      hasAttachment: Boolean(obj.hasAttachment),
      attachmentName: obj.attachmentName,
      status: obj.status as 'SUCCESS' | 'ERROR' | 'NO_VAT_FOUND',
      invoiceId: obj.invoiceId,
      parsedItemCount: Number(obj.parsedItemCount),
    };
  });
}

export function addEmailLog(db: Database, log: EmailLog) {
  db.run(
    `INSERT INTO email_logs (id, timestamp, sender, subject, hasAttachment, attachmentName, status, invoiceId, parsedItemCount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.timestamp,
      log.sender,
      log.subject,
      log.hasAttachment ? 1 : 0,
      log.attachmentName || '',
      log.status,
      log.invoiceId || '',
      log.parsedItemCount || 0
    ]
  );
  saveDatabase(db);
}

export function exportBackupJson(db: Database) {
  return {
    companies: getAllCompanies(db),
    inventory: getAllInventory(db),
    invoices: getAllInvoices(db),
    gmailConfig: getGmailConfig(db),
    emailLogs: getAllEmailLogs(db),
  };
}

export function restoreBackupJson(db: Database, data: any) {
  if (!data) return;

  if (Array.isArray(data.companies) && data.companies.length > 0) {
    db.run(`DELETE FROM companies`);
    const stmtComp = db.prepare(`
      INSERT INTO companies (id, name, taxCode, address, isDefault)
      VALUES (?, ?, ?, ?, ?)
    `);
    data.companies.forEach((comp: Company) => {
      stmtComp.run([comp.id, comp.name, comp.taxCode, comp.address || '', comp.isDefault ? 1 : 0]);
    });
    stmtComp.free();
  }

  if (Array.isArray(data.inventory) && data.inventory.length > 0) {
    db.run(`DELETE FROM inventory`);
    const stmtInv = db.prepare(`
      INSERT INTO inventory (id, companyId, sku, name, category, unit, totalInbound, totalOutbound, currentStock, minStockThreshold, averageCost, lastUpdated, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    data.inventory.forEach((item: InventoryItem) => {
      stmtInv.run([
        item.id || `inv-${Date.now()}`,
        item.companyId || 'comp-1',
        item.sku,
        item.name,
        item.category || '',
        item.unit,
        item.totalInbound,
        item.totalOutbound,
        item.currentStock,
        item.minStockThreshold,
        item.averageCost,
        item.lastUpdated,
        item.note || ''
      ]);
    });
    stmtInv.free();
  }

  if (Array.isArray(data.invoices) && data.invoices.length > 0) {
    db.run(`DELETE FROM invoices`);
    const stmtInvDoc = db.prepare(`
      INSERT INTO invoices (id, companyId, invoiceNumber, symbol, date, type, partnerName, partnerTaxCode, items, totalBeforeTax, vatAmount, totalWithTax, source, emailSubject, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    data.invoices.forEach((inv: Invoice) => {
      stmtInvDoc.run([
        inv.id,
        inv.companyId || 'comp-1',
        inv.invoiceNumber,
        inv.symbol || '',
        inv.date,
        inv.type,
        inv.partnerName,
        inv.partnerTaxCode || '',
        JSON.stringify(inv.items),
        inv.totalBeforeTax,
        inv.vatAmount,
        inv.totalWithTax,
        inv.source,
        inv.emailSubject || '',
        inv.createdAt
      ]);
    });
    stmtInvDoc.free();
  }

  if (data.gmailConfig) {
    saveGmailConfig(db, data.gmailConfig);
  }

  saveDatabase(db);
}

