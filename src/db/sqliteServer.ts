import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { initialInventoryItems, initialInvoices, initialEmailLogs, initialGmailConfig } from '../data/initialData.js';
import { InventoryItem, Invoice, EmailLog, GmailConfig } from '../types.js';

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

  // Ensure tables exist even if file already existed
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
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      sku TEXT UNIQUE NOT NULL,
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
}

function initSchemaAndSeed(db: Database) {
  ensureSchema(db);

  // Seed inventory
  const stmtInv = db.prepare(`
    INSERT INTO inventory (id, sku, name, category, unit, totalInbound, totalOutbound, currentStock, minStockThreshold, averageCost, lastUpdated, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  initialInventoryItems.forEach((item) => {
    stmtInv.run([
      item.id,
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
    INSERT INTO invoices (id, invoiceNumber, symbol, date, type, partnerName, partnerTaxCode, items, totalBeforeTax, vatAmount, totalWithTax, source, emailSubject, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  initialInvoices.forEach((inv) => {
    stmtInvDoc.run([
      inv.id,
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

export function getAllInventory(db: Database): InventoryItem[] {
  const res = db.exec(`SELECT * FROM inventory ORDER BY rowid DESC`);
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
  const existing = db.exec(`SELECT sku FROM inventory WHERE sku = '${item.sku.replace(/'/g, "''")}'`);
  if (existing.length > 0 && existing[0].values.length > 0) {
    db.run(
      `UPDATE inventory SET 
        name = ?, category = ?, unit = ?, totalInbound = ?, totalOutbound = ?, currentStock = ?, minStockThreshold = ?, averageCost = ?, lastUpdated = ?, note = ?
       WHERE sku = ?`,
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
        item.sku
      ]
    );
  } else {
    db.run(
      `INSERT INTO inventory (id, sku, name, category, unit, totalInbound, totalOutbound, currentStock, minStockThreshold, averageCost, lastUpdated, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id || `inv-${Date.now()}`,
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

export function deleteInventoryItemBySku(db: Database, sku: string) {
  db.run(`DELETE FROM inventory WHERE sku = ?`, [sku]);
  saveDatabase(db);
}

export function deleteMultipleInventoryItems(db: Database, skus: string[]) {
  if (!skus || skus.length === 0) return;
  const placeholders = skus.map(() => '?').join(',');
  db.run(`DELETE FROM inventory WHERE sku IN (${placeholders})`, skus);
  saveDatabase(db);
}

export function getAllInvoices(db: Database): Invoice[] {
  const res = db.exec(`SELECT * FROM invoices ORDER BY rowid DESC`);
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

export function addInvoiceAndUpdateStock(db: Database, invoice: Invoice) {
  // 1. Insert invoice
  db.run(
    `INSERT INTO invoices (id, invoiceNumber, symbol, date, type, partnerName, partnerTaxCode, items, totalBeforeTax, vatAmount, totalWithTax, source, emailSubject, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invoice.id,
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

  // 2. Update inventory stock for items in invoice
  const currentInv = getAllInventory(db);
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
      saveOrUpdateInventoryItem(db, existing);
    } else if (invoice.type === 'INBOUND') {
      // Create new inventory item if inbound
      const newItem: InventoryItem = {
        id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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
    const status: EmailLog['status'] =
      obj.status === 'SUCCESS'
        ? 'SUCCESS'
        : obj.status === 'NO_VAT_FOUND'
          ? 'NO_VAT_FOUND'
          : 'ERROR';

    return {
      id: obj.id,
      timestamp: obj.timestamp,
      sender: obj.sender,
      subject: obj.subject,
      hasAttachment: Boolean(obj.hasAttachment),
      attachmentName: obj.attachmentName,
      status,
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
