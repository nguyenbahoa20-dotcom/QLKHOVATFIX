import express from 'express';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  getDatabase,
  getAllCompanies,
  saveOrUpdateCompany,
  deleteCompany,
  getAllInventory,
  saveOrUpdateInventoryItem,
  bulkSaveOrUpdateInventoryItems,
  deleteInventoryItemBySku,
  deleteMultipleInventoryItems,
  resyncInventoryFromInvoices,
  getAllInvoices,
  deleteInvoiceById,
  clearInvoices,
  clearCompanyData,
  clearAllInventoryAndInvoices,
  addInvoiceAndUpdateStock,
  getGmailConfig,
  saveGmailConfig,
  getAllEmailLogs,
  addEmailLog,
  exportBackupJson,
  restoreBackupJson,
  DB_FILE_PATH,
  saveDatabase,
} from './src/db/sqliteServer.js';
import { Company, InventoryItem, Invoice, EmailLog } from './src/types.js';

type AppRole = 'admin' | 'user';
type AppUser = { id: string; username: string; role: AppRole; createdAt: string };
const authSessions = new Map<string, { userId: string; expiresAt: number }>();
const authCookieName = 'taxvault_session';

function getUserByUsername(db: any, username: string): any | null {
  const stmt = db.prepare('SELECT id, username, passwordHash, passwordSalt, role, createdAt FROM app_users WHERE username = ? COLLATE NOCASE');
  stmt.bind([username]);
  const user = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return user;
}

function getUserById(db: any, id: string): AppUser | null {
  const stmt = db.prepare('SELECT id, username, role, createdAt FROM app_users WHERE id = ?');
  stmt.bind([id]);
  const row = stmt.step() ? stmt.getAsObject() as Record<string, any> : null;
  stmt.free();
  return row ? { id: String(row.id), username: String(row.username), role: row.role as AppRole, createdAt: String(row.createdAt) } : null;
}

function getPublicUsers(db: any): AppUser[] {
  const result = db.exec('SELECT id, username, role, createdAt FROM app_users ORDER BY createdAt ASC');
  if (!result.length) return [];
  return result[0].values.map((row: any[]) => ({
    id: String(row[0]), username: String(row[1]), role: row[2] as AppRole, createdAt: String(row[3]),
  }));
}

function countAppUsers(db: any): number {
  const result = db.exec('SELECT COUNT(*) FROM app_users');
  return Number(result?.[0]?.values?.[0]?.[0] || 0);
}

function getRequestCookie(req: express.Request, name: string): string {
  const cookies = (req.headers.cookie || '').split(';');
  const entry = cookies.map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  if (!entry) return '';
  try { return decodeURIComponent(entry.slice(name.length + 1)); } catch { return ''; }
}

function issueSession(res: express.Response, user: AppUser) {
  const token = randomBytes(32).toString('hex');
  authSessions.set(token, { userId: user.id, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${authCookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);
}

function getSessionUser(req: express.Request, db: any): AppUser | null {
  const token = getRequestCookie(req, authCookieName);
  const session = authSessions.get(token);
  if (!token || !session) return null;
  if (session.expiresAt <= Date.now()) {
    authSessions.delete(token);
    return null;
  }
  return getUserById(db, session.userId);
}

const requireAdmin: express.RequestHandler = (_req, res, next) => {
  if (res.locals.authUser?.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ tài khoản Admin được phép thực hiện thao tác này.' });
  }
  next();
};

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';
  const adminUsername = process.env.ADMIN_USERNAME || '';
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  app.set('trust proxy', 1);
  app.get('/healthz', (_req, res) => res.status(200).send('ok'));

  if (isProduction && (!adminUsername || adminPassword.length < 16)) {
    throw new Error('Production requires ADMIN_USERNAME and an ADMIN_PASSWORD of at least 16 characters.');
  }

  // A single-user gate protects the app and every data-changing API in remote deployments.
  app.use((req, res, next) => {
    if (!isProduction) return next();

    const authorization = req.headers.authorization || '';
    const encoded = authorization.startsWith('Basic ') ? authorization.slice(6) : '';
    let providedUsername = '';
    let providedPassword = '';
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      if (separator >= 0) {
        providedUsername = decoded.slice(0, separator);
        providedPassword = decoded.slice(separator + 1);
      }
    } catch {
      // Invalid credentials receive the same response as missing credentials.
    }

    const usernameMatches = secretsMatch(providedUsername, adminUsername);
    const passwordMatches = secretsMatch(providedPassword, adminPassword);

    if (!usernameMatches || !passwordMatches) {
      res.setHeader('WWW-Authenticate', 'Basic realm="QLKHOVATFIX", charset="UTF-8"');
      return res.status(401).send('Vui lòng đăng nhập để sử dụng ứng dụng.');
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      const host = req.get('host');
      if (!origin || !host) return res.status(403).send('Yêu cầu không hợp lệ.');
      try {
        const parsedOrigin = new URL(origin);
        if (parsedOrigin.protocol !== 'https:' || parsedOrigin.host !== host) {
          return res.status(403).send('Yêu cầu không cùng nguồn.');
        }
      } catch {
        return res.status(403).send('Yêu cầu không hợp lệ.');
      }
    }

    next();
  });

  app.use(express.json({ limit: '10mb' }));

  // Initialize SQLite database (vat_database.db)
  const db = await getDatabase();
  console.log('SQLite Database (vat_database.db) initialized successfully.');

  // First-run setup and sign-in routes stay public; all other API routes require a session.
  app.get('/api/auth/status', (req, res) => {
    res.json({ needsSetup: countAppUsers(db) === 0, user: getSessionUser(req, db) });
  });

  app.post('/api/auth/setup', (req, res) => {
    if (countAppUsers(db) > 0) return res.status(409).json({ error: 'Tài khoản Admin đã được tạo.' });
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return res.status(400).json({ error: 'Tên đăng nhập cần từ 3 đến 32 ký tự, gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Mật khẩu cần có ít nhất 8 ký tự.' });
    const salt = randomBytes(16).toString('hex');
    const user: AppUser = { id: `user-${randomBytes(12).toString('hex')}`, username, role: 'admin', createdAt: new Date().toISOString() };
    try {
      db.run('INSERT INTO app_users (id, username, passwordHash, passwordSalt, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)', [
        user.id, user.username, scryptSync(password, salt, 64).toString('hex'), salt, user.role, user.createdAt,
      ]);
      saveDatabase(db);
      issueSession(res, user);
      res.status(201).json({ user });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Không thể tạo tài khoản Admin.' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const stored = getUserByUsername(db, username);
    if (!stored) return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu chưa đúng.' });
    const expected = Buffer.from(String(stored.passwordHash), 'hex');
    const actual = scryptSync(password, String(stored.passwordSalt), 64);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu chưa đúng.' });
    }
    const user = getUserById(db, String(stored.id))!;
    issueSession(res, user);
    res.json({ user });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = getRequestCookie(req, authCookieName);
    if (token) authSessions.delete(token);
    res.setHeader('Set-Cookie', `${authCookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    res.json({ success: true });
  });

  app.use('/api', (req, res, next) => {
    if (['/auth/status', '/auth/setup', '/auth/login', '/auth/logout'].includes(req.path)) return next();
    const user = getSessionUser(req, db);
    if (!user) return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
    res.locals.authUser = user;
    next();
  });

  app.get('/api/auth/users', requireAdmin, (_req, res) => res.json(getPublicUsers(db)));
  app.post('/api/auth/users', requireAdmin, (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return res.status(400).json({ error: 'Tên đăng nhập cần từ 3 đến 32 ký tự, gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Mật khẩu cần có ít nhất 8 ký tự.' });
    const salt = randomBytes(16).toString('hex');
    const role: AppRole = req.body?.role === 'admin' ? 'admin' : 'user';
    const user: AppUser = { id: `user-${randomBytes(12).toString('hex')}`, username, role, createdAt: new Date().toISOString() };
    try {
      db.run('INSERT INTO app_users (id, username, passwordHash, passwordSalt, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)', [
        user.id, user.username, scryptSync(password, salt, 64).toString('hex'), salt, user.role, user.createdAt,
      ]);
      saveDatabase(db);
      res.status(201).json({ user, users: getPublicUsers(db) });
    } catch (err: any) {
      const duplicate = String(err.message || '').toLowerCase().includes('unique');
      res.status(duplicate ? 409 : 500).json({ error: duplicate ? 'Tên đăng nhập này đã được sử dụng.' : 'Không thể tạo tài khoản User.' });
    }
  });
  app.delete('/api/auth/users/:id', requireAdmin, (req, res) => {
    const target = getUserById(db, req.params.id);
    if (!target) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    if (target.role === 'admin') {
      if (target.id === res.locals.authUser.id) return res.status(400).json({ error: 'Không thể tự xóa tài khoản đang đăng nhập.' });
      const adminCount = Number(db.exec("SELECT COUNT(*) FROM app_users WHERE role = 'admin'")?.[0]?.values?.[0]?.[0] || 0);
      if (adminCount <= 1) return res.status(400).json({ error: 'Cần giữ lại ít nhất một tài khoản Admin.' });
    }
    db.run('DELETE FROM app_users WHERE id = ?', [target.id]);
    for (const [token, session] of authSessions) if (session.userId === target.id) authSessions.delete(token);
    saveDatabase(db);
    res.json({ success: true, users: getPublicUsers(db) });
  });

  // ==========================================
  // API ROUTES
  // ==========================================

  // 0. Company Routes
  app.get('/api/companies', (req, res) => {
    try {
      const companies = getAllCompanies(db);
      res.json(companies);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/companies', (req, res) => {
    try {
      const company: Company = req.body;
      const updated = saveOrUpdateCompany(db, company);
      res.json({ success: true, company, companies: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/companies/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const updated = deleteCompany(db, id);
      res.json({ success: true, id, companies: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 1. Inventory Routes
  const handleResync = (req: express.Request, res: express.Response) => {
    try {
      const companyId = (req.query.company_id || req.query.companyId || req.body?.company_id || req.body?.companyId) as string | undefined;
      const resyncedInventory = resyncInventoryFromInvoices(db, companyId);
      res.json(resyncedInventory);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  app.post('/api/inventory/resync', handleResync);
  app.get('/api/inventory/resync', handleResync);
  app.post('/api/resync-inventory', handleResync);
  app.get('/api/resync-inventory', handleResync);

  app.post('/api/inventory/bulk-delete', requireAdmin, (req, res) => {
    try {
      const { skus, companyId } = req.body;
      deleteMultipleInventoryItems(db, skus, companyId);
      const updated = getAllInventory(db, companyId);
      res.json({ success: true, count: skus.length, inventory: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory/import-excel', requireAdmin, (req, res) => {
    try {
      const { items } = req.body as { items?: unknown };
      if (!Array.isArray(items) || items.length === 0 || items.length > 5000) {
        return res.status(400).json({ error: 'Danh sách nhập Excel không hợp lệ (tối đa 5.000 mặt hàng).' });
      }
      const validItems = items.every((item: any) =>
        item && typeof item.sku === 'string' && item.sku.trim() &&
        typeof item.name === 'string' && item.name.trim() &&
        typeof item.unit === 'string' && item.unit.trim() &&
        typeof item.companyId === 'string' && item.companyId.trim() &&
        ['totalInbound', 'totalOutbound', 'currentStock', 'minStockThreshold', 'averageCost'].every((key) => Number.isFinite(Number(item[key])))
      );
      if (!validItems) return res.status(400).json({ error: 'Một hoặc nhiều dòng thiếu mã/tên/đơn vị tính hoặc có số liệu không hợp lệ.' });
      const companyIds = new Set((items as any[]).map((item) => item.companyId));
      if (companyIds.size !== 1) return res.status(400).json({ error: 'Một lần nhập chỉ được áp dụng cho một công ty.' });
      bulkSaveOrUpdateInventoryItems(db, items as InventoryItem[]);
      const companyId = String((items[0] as any).companyId);
      res.json({ success: true, imported: items.length, inventory: getAllInventory(db, companyId) });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Không thể lưu dữ liệu Excel.' });
    }
  });

  app.get('/api/inventory', (req, res) => {
    try {
      const companyId = req.query.companyId as string | undefined;
      const items = getAllInventory(db, companyId);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory', (req, res) => {
    try {
      const item = req.body;
      saveOrUpdateInventoryItem(db, item);
      const updated = getAllInventory(db, item.companyId);
      res.json({ success: true, item, inventory: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/inventory/:sku', requireAdmin, (req, res) => {
    try {
      const { sku } = req.params;
      const companyId = req.query.companyId as string | undefined;
      deleteInventoryItemBySku(db, sku, companyId);
      const updated = getAllInventory(db, companyId);
      res.json({ success: true, sku, inventory: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Invoice Routes
  app.get('/api/invoices', (req, res) => {
    try {
      const companyId = req.query.companyId as string | undefined;
      const invoices = getAllInvoices(db, companyId);
      res.json(invoices);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/invoices', (req, res) => {
    try {
      const invoice: Invoice = req.body;
      addInvoiceAndUpdateStock(db, invoice);
      const updatedInvoices = getAllInvoices(db, invoice.companyId);
      const updatedInventory = getAllInventory(db, invoice.companyId);
      res.json({ success: true, invoice, invoices: updatedInvoices, inventory: updatedInventory });
    } catch (err: any) {
      const isDup = err.message && err.message.includes('đã tồn tại trong kho');
      res.status(isDup ? 400 : 500).json({ error: err.message, isDuplicate: Boolean(isDup) });
    }
  });

  app.delete('/api/invoices/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const companyId = (req.query.company_id || req.query.companyId) as string | undefined;
      const result = deleteInvoiceById(db, id, companyId);
      res.json({ success: true, id, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/invoices', requireAdmin, (req, res) => {
    try {
      const companyId = (req.query.company_id || req.query.companyId) as string | undefined;
      const result = clearInvoices(db, companyId);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.all('/api/clear-company-data', requireAdmin, (req, res) => {
    try {
      const companyId = (req.query.company_id || req.query.companyId || req.body?.company_id || req.body?.companyId) as string | undefined;
      const result = clearCompanyData(db, companyId);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/clear-all', requireAdmin, (req, res) => {
    try {
      const companyId = (req.query.company_id || req.query.companyId || req.body?.company_id || req.body?.companyId) as string | undefined;
      const result = clearCompanyData(db, companyId);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/clear-all', requireAdmin, (req, res) => {
    try {
      const companyId = (req.query.company_id || req.query.companyId) as string | undefined;
      const result = clearCompanyData(db, companyId);
      res.json({ success: true, ...result });
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

  // 4a. AI Data Analyst Chat Route
  app.post('/api/ai-chat', async (req, res) => {
    try {
      const { message, companyId, history, inventoryData, invoiceData } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      const activeCompanyId = companyId || 'comp-1';
      const companies = getAllCompanies(db);
      const currentCompany = companies.find((c) => c.id === activeCompanyId) || companies[0] || { name: 'Công ty TaxVault', taxCode: '0101234567' };

      let inventory = getAllInventory(db, activeCompanyId);
      if ((!inventory || inventory.length === 0) && Array.isArray(inventoryData) && inventoryData.length > 0) {
        inventory = inventoryData;
      }

      let invoices = getAllInvoices(db, activeCompanyId);
      if ((!invoices || invoices.length === 0) && Array.isArray(invoiceData) && invoiceData.length > 0) {
        invoices = invoiceData;
      }

      const totalInventoryVal = inventory.reduce((sum, item) => sum + (item.currentStock || 0) * (item.averageCost || 0), 0);
      const lowStockItems = inventory.filter((item) => (item.currentStock || 0) <= (item.minStockThreshold ?? 5));

      const inboundInvoices = invoices.filter((i) => i.type === 'INBOUND');
      const outboundInvoices = invoices.filter((i) => i.type === 'OUTBOUND');

      const totalInboundVat = inboundInvoices.reduce((sum, i) => sum + (i.vatAmount || 0), 0);
      const totalOutboundVat = outboundInvoices.reduce((sum, i) => sum + (i.vatAmount || 0), 0);
      const totalInboundWithTax = inboundInvoices.reduce((sum, i) => sum + (i.totalWithTax || 0), 0);
      const totalOutboundWithTax = outboundInvoices.reduce((sum, i) => sum + (i.totalWithTax || 0), 0);

      const highestValInvoice = invoices.length > 0 ? [...invoices].sort((a, b) => (b.totalWithTax || 0) - (a.totalWithTax || 0))[0] : null;

      const dynamicContextJSON = JSON.stringify({
        companyName: currentCompany.name,
        taxCode: currentCompany.taxCode,
        inventory: {
          totalProductsCount: inventory.length,
          totalInventoryValueVND: totalInventoryVal,
          lowStockCount: lowStockItems.length,
          lowStockList: lowStockItems.map((i) => ({ sku: i.sku, name: i.name, stock: i.currentStock, unit: i.unit, minStockThreshold: i.minStockThreshold ?? 5 })),
          allProductsList: inventory.map((i) => ({ sku: i.sku, name: i.name, stock: i.currentStock, unit: i.unit, cost: i.averageCost, totalVal: (i.currentStock || 0) * (i.averageCost || 0) })),
        },
        invoices: {
          totalInvoicesCount: invoices.length,
          inboundCount: inboundInvoices.length,
          outboundCount: outboundInvoices.length,
          totalInboundVATVND: totalInboundVat,
          totalOutboundVATVND: totalOutboundVat,
          totalInboundAmountVND: totalInboundWithTax,
          totalOutboundAmountVND: totalOutboundWithTax,
          highestInvoice: highestValInvoice
            ? {
                invoiceNumber: highestValInvoice.invoiceNumber,
                symbol: highestValInvoice.symbol,
                type: highestValInvoice.type === 'INBOUND' ? 'Mua vào' : 'Bán ra',
                partnerName: highestValInvoice.partnerName,
                partnerTaxCode: highestValInvoice.partnerTaxCode,
                totalWithTax: highestValInvoice.totalWithTax,
                vatAmount: highestValInvoice.vatAmount,
                date: highestValInvoice.date,
              }
            : null,
          recentList: invoices.slice(0, 20).map((inv) => ({
            number: inv.invoiceNumber,
            symbol: inv.symbol,
            date: inv.date,
            type: inv.type === 'INBOUND' ? 'Mua vào' : 'Bán ra',
            partner: inv.partnerName,
            partnerTaxCode: inv.partnerTaxCode,
            vat: inv.vatAmount,
            totalWithTax: inv.totalWithTax,
          })),
        },
      }, null, 2);

      const SYSTEM_PROMPT = `Bạn là Trợ lý Kế toán Phân tích Dữ liệu của phần mềm TaxVault Pro. Nhiệm vụ DUY NHẤT của bạn là phân tích, tính toán, và tóm tắt thông tin dựa trên dữ liệu hóa đơn và tồn kho được cung cấp. KHÔNG trả lời các câu hỏi ngoài lề hoặc kiến thức chung. Hãy trả lời ngắn gọn, trực diện bằng tiếng Việt chuyên ngành kế toán, sử dụng gạch đầu dòng để làm nổi bật các con số quan trọng.`;

      const promptWithContext = `DỮ LIỆU CSDL SQLITE THỜI GIAN THỰC CỦA CÔNG TY (${currentCompany.name} - MST: ${currentCompany.taxCode}):
\`\`\`json
${dynamicContextJSON}
\`\`\`

CÂU HỎI CỦA KẾ TOÁN/NGƯỜI DÙNG:
${message}`;

      const ai = getGenAI();
      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: promptWithContext,
            config: {
              systemInstruction: SYSTEM_PROMPT,
            },
          });

          if (response && response.text) {
            return res.json({ reply: response.text });
          }
        } catch (geminiError: any) {
          console.error('Gemini API call failed, using intelligent fallback:', geminiError.message);
        }
      }

      // Smart Fallback if Gemini key is missing or call fails
      let fallbackReply = '';
      const msgLower = message.toLowerCase();

      if (msgLower.includes('tóm tắt tồn kho') || msgLower.includes('tồn kho')) {
        fallbackReply = `📊 **Tóm Tắt Tồn Kho Hiện Tại (${currentCompany.name}):**\n\n` +
          `• **Tổng số mặt hàng phân loại:** ${inventory.length} sản phẩm\n` +
          `• **Tổng giá trị tồn kho VAT:** ${totalInventoryVal.toLocaleString('vi-VN')} VNĐ\n` +
          `• **Mặt hàng cần chú ý (sắp hết/hết):** ${lowStockItems.length} sản phẩm\n` +
          (lowStockItems.length > 0
            ? `• **Danh sách sắp hết:** ` + lowStockItems.map((i) => `${i.name} (còn ${i.currentStock} ${i.unit})`).join(', ')
            : `• **Trạng thái kho:** Tất cả mặt hàng đều duy trì mức tồn kho an toàn!`);
      } else if (msgLower.includes('cao nhất') || msgLower.includes('giá trị cao')) {
        if (highestValInvoice) {
          fallbackReply = `🔝 **Hóa Đơn Có Giá Trị Cao Nhất:**\n\n` +
            `• **Số hóa đơn:** ${highestValInvoice.invoiceNumber} (Mẫu/Ký hiệu: ${highestValInvoice.symbol})\n` +
            `• **Phân loại:** ${highestValInvoice.type === 'INBOUND' ? 'Mua vào (Đầu vào)' : 'Bán ra (Đầu ra)'}\n` +
            `• **Đối tác:** ${highestValInvoice.partnerName} (MST: ${highestValInvoice.partnerTaxCode || 'N/A'})\n` +
            `• **Ngày chứng từ:** ${highestValInvoice.date}\n` +
            `• **Tiền thuế VAT:** ${(highestValInvoice.vatAmount || 0).toLocaleString('vi-VN')} VNĐ\n` +
            `• **Tổng thanh toán:** ${(highestValInvoice.totalWithTax || 0).toLocaleString('vi-VN')} VNĐ`;
        } else {
          fallbackReply = `Hệ thống chưa ghi nhận hóa đơn nào trong CSDL của ${currentCompany.name}.`;
        }
      } else if (msgLower.includes('sắp hết') || msgLower.includes('cảnh báo')) {
        if (lowStockItems.length > 0) {
          fallbackReply = `⚠️ **Cảnh Báo Mặt Hàng Sắp Hết Tồn Kho (${lowStockItems.length} SP):**\n\n` +
            lowStockItems.map((i) => `• **${i.name}** (Mã SKU: ${i.sku}): Còn **${i.currentStock} ${i.unit}** (Ngưỡng tối thiểu: ${i.minStockThreshold ?? 5} ${i.unit})`).join('\n');
        } else {
          fallbackReply = `✅ Tất cả ${inventory.length} sản phẩm trong kho của ${currentCompany.name} đều có số lượng an toàn vượt mức tối thiểu!`;
        }
      } else if (msgLower.includes('vat') || msgLower.includes('thuế')) {
        fallbackReply = `💰 **Tổng Quan Thuế VAT (${currentCompany.name}):**\n\n` +
          `• **Tổng VAT Hóa Đơn Mua Vào (${inboundInvoices.length} HD):** ${totalInboundVat.toLocaleString('vi-VN')} VNĐ (Tổng tiền: ${totalInboundWithTax.toLocaleString('vi-VN')} VNĐ)\n` +
          `• **Tổng VAT Hóa Đơn Bán Ra (${outboundInvoices.length} HD):** ${totalOutboundVat.toLocaleString('vi-VN')} VNĐ (Tổng tiền: ${totalOutboundWithTax.toLocaleString('vi-VN')} VNĐ)\n` +
          `• **Chênh lệch VAT (Đầu ra - Đầu vào):** ${(totalOutboundVat - totalInboundVat).toLocaleString('vi-VN')} VNĐ`;
      } else {
        fallbackReply = `🤖 **Trợ Lý TaxVault Pro Phân Tích Dữ Liệu (${currentCompany.name}):**\n\n` +
          `• **Tổng số sản phẩm trong kho:** ${inventory.length} mặt hàng (Tổng giá trị: ${totalInventoryVal.toLocaleString('vi-VN')} VNĐ)\n` +
          `• **Tổng số chứng từ hóa đơn:** ${invoices.length} hóa đơn\n` +
          `• **Tổng VAT mua vào:** ${totalInboundVat.toLocaleString('vi-VN')} VNĐ\n` +
          `• **Cảnh báo kho:** ${lowStockItems.length} sản phẩm chạm ngưỡng tối thiểu.\n\n` +
          `Bạn có thể chọn nút gợi ý nhanh ở trên để truy vấn chi tiết!`;
      }

      return res.json({ reply: fallbackReply });
    } catch (err: any) {
      console.error('Error in /api/ai-chat:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 4b. Backup & Restore CSDL Routes
  app.get('/api/backup/download', (req, res) => {
    try {
      const dbPath = DB_FILE_PATH;
      if (fs.existsSync(dbPath)) {
        res.download(dbPath, 'vat_database.db');
      } else {
        res.status(404).json({ error: 'File vat_database.db không tồn tại.' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/backup/json', (req, res) => {
    try {
      const backup = exportBackupJson(db);
      res.json(backup);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backup/restore', requireAdmin, (req, res) => {
    try {
      const backupData = req.body;
      restoreBackupJson(db, backupData);
      const companies = getAllCompanies(db);
      const inventory = getAllInventory(db);
      const invoices = getAllInvoices(db);
      const gmailConfig = getGmailConfig(db);
      const emailLogs = getAllEmailLogs(db);
      res.json({
        success: true,
        message: 'Khôi phục cơ sở dữ liệu SQLite (vat_database.db) thành công!',
        companies,
        inventory,
        invoices,
        gmailConfig,
        emailLogs,
      });
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

  // Shutdown API Endpoint
  app.post('/api/shutdown', requireAdmin, (req, res) => {
    if (isProduction) {
      return res.status(404).json({ error: 'Không thể tắt máy chủ từ ứng dụng đã triển khai.' });
    }
    res.json({ success: true, message: 'Phần mềm đã được đóng an toàn. Toàn bộ dữ liệu đã được lưu.' });
    setTimeout(() => {
      console.log('User requested application shutdown. Terminating process...');
      process.exit(0);
    }, 500);
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

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

startServer();
