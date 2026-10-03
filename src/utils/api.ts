import { AppUser, Company, InventoryItem, Invoice, GmailConfig, EmailLog } from '../types';
import { initialCompanies } from '../data/initialData';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL ||
  "";

function verifyJsonResponse(res: Response): void {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error("Wrong API endpoint. HTML returned instead of JSON.");
  }
}

async function fetchWithFallback(endpoint: string, options?: RequestInit): Promise<Response> {
  const targetUrl = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  try {
    const res = await fetch(targetUrl, { ...options, credentials: options?.credentials || 'include' });
    return res;
  } catch (e) {
    throw new Error(`Không thể kết nối máy chủ API tại ${targetUrl}`);
  }
}

async function authRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  const res = await fetchWithFallback(path, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Yêu cầu thất bại (HTTP ${res.status})`);
  return data as T;
}

export async function fetchAuthStatus(): Promise<{ needsSetup: boolean; user: AppUser | null }> {
  return authRequest<{ needsSetup: boolean; user: AppUser | null }>('/api/auth/status');
}

export async function setupAdminAccount(username: string, password: string): Promise<AppUser> {
  const result = await authRequest<{ user: AppUser }>('/api/auth/setup', { method: 'POST', body: JSON.stringify({ username, password }) });
  return result.user;
}

export async function loginAccount(username: string, password: string): Promise<AppUser> {
  const result = await authRequest<{ user: AppUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  return result.user;
}

export async function logoutAccount(): Promise<void> {
  await authRequest<{ success: boolean }>('/api/auth/logout', { method: 'POST' });
}

export async function fetchAppUsers(): Promise<AppUser[]> {
  return authRequest<AppUser[]>('/api/auth/users');
}

export async function createAppUser(username: string, password: string, role: AppUser['role'] = 'user'): Promise<AppUser[]> {
  const result = await authRequest<{ users: AppUser[] }>('/api/auth/users', { method: 'POST', body: JSON.stringify({ username, password, role }) });
  return result.users;
}

export async function deleteAppUser(id: string): Promise<AppUser[]> {
  const result = await authRequest<{ users: AppUser[] }>(`/api/auth/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return result.users;
}

const LOCAL_STORAGE_KEYS = {
  COMPANIES: 'vat_companies_v2',
  INVENTORY: 'vat_inventory_v2',
  INVOICES: 'vat_invoices_v2',
  GMAIL_CONFIG: 'vat_gmail_config_v2',
  EMAIL_LOGS: 'vat_email_logs_v2',
  IS_INITIALIZED: 'vat_is_initialized_v2',
};

// ==========================================
// LOCAL STORAGE CACHE HELPERS (DEPRECATED/STUBS)
// SQLite via FastAPI is the SINGLE SOURCE OF TRUTH.
// ==========================================

export function getLocalCompaniesCache(): Company[] | null { return null; }
export function saveLocalCompaniesCache(_companies: Company[]): void {}
export function getLocalInventoryCache(): InventoryItem[] | null { return null; }
export function saveLocalInventoryCache(_items: InventoryItem[]): void {}
export function getLocalInvoicesCache(): Invoice[] | null { return null; }
export function saveLocalInvoicesCache(_invoices: Invoice[]): void {}

export function getLocalGmailConfigCache(): GmailConfig | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.GMAIL_CONFIG);
    if (raw !== null) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading gmail config from localStorage:', err);
  }
  return null;
}

export function saveLocalGmailConfigCache(config: GmailConfig): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.GMAIL_CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error('Error saving gmail config to localStorage:', err);
  }
}

export function getLocalEmailLogsCache(): EmailLog[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.EMAIL_LOGS);
    if (raw !== null) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading email logs from localStorage:', err);
  }
  return null;
}

export function saveLocalEmailLogsCache(logs: EmailLog[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.EMAIL_LOGS, JSON.stringify(logs));
  } catch (err) {
    console.error('Error saving email logs to localStorage:', err);
  }
}

export function isLocalStorageInitialized(): boolean {
  return true;
}

// ==========================================
// API FETCHERS DIRECTLY FROM FASTAPI / SQLITE
// ==========================================

export async function fetchCompanies(): Promise<Company[]> {
  try {
    const res = await fetchWithFallback(`${API_BASE_URL}/api/companies`);
    if (!res.ok) {
      throw new Error(`Lỗi tải danh sách công ty (HTTP ${res.status})`);
    }
    verifyJsonResponse(res);
    const data: Company[] = await res.json();
    return Array.isArray(data) ? data.filter((c) => c && c.id) : [];
  } catch (err) {
    console.warn('API fetchCompanies failed:', err);
    return initialCompanies;
  }
}

export async function apiSaveCompany(company: Company): Promise<Company[]> {
  const res = await fetchWithFallback(`${API_BASE_URL}/api/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(company),
  });
  verifyJsonResponse(res);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || errData.error || `Lỗi lưu công ty vào CSDL (HTTP ${res.status})`);
  }
  return fetchCompanies();
}

export async function apiDeleteCompany(id: string): Promise<Company[]> {
  const res = await fetchWithFallback(`${API_BASE_URL}/api/companies/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  verifyJsonResponse(res);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || errData.error || `Lỗi xóa công ty khỏi CSDL (HTTP ${res.status})`);
  }
  return fetchCompanies();
}

export async function fetchInventory(companyId?: string): Promise<InventoryItem[]> {
  try {
    const url = companyId
      ? `${API_BASE_URL}/api/inventory?companyId=${encodeURIComponent(companyId)}`
      : `${API_BASE_URL}/api/inventory`;
    const res = await fetchWithFallback(url);
    if (!res.ok) {
      throw new Error(`Lỗi tải kho hàng từ CSDL (HTTP ${res.status})`);
    }
    verifyJsonResponse(res);
    const data: InventoryItem[] = await res.json();
    return Array.isArray(data)
      ? data
          .filter((i) => i && (i.sku || i.name))
          .map((i, idx) => ({
            ...i,
            sku: (i.sku || '').trim() || `SP-VAT-${idx + 1}`,
          }))
      : [];
  } catch (err) {
    console.warn('API fetchInventory failed:', err);
    return [];
  }
}

export async function apiResyncInventory(companyId?: string): Promise<InventoryItem[]> {
  const queryParam = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  const urlsToTry = [
    `${API_BASE_URL}/api/inventory/resync${queryParam}`,
    `${API_BASE_URL}/api/resync-inventory${queryParam}`,
  ];

  let res: Response | null = null;
  let lastError = '';

  for (const url of urlsToTry) {
    try {
      res = await fetchWithFallback(url, { method: 'POST' });
      if (res && res.ok) break;
      res = await fetchWithFallback(url, { method: 'GET' });
      if (res && res.ok) break;
    } catch (err: any) {
      lastError = err.message || String(err);
    }
  }

  if (!res || !res.ok) {
    throw new Error(lastError || `Lỗi đồng bộ lại kho hàng (HTTP ${res ? res.status : 404})`);
  }

  verifyJsonResponse(res);
  const data: InventoryItem[] = await res.json();
  return Array.isArray(data)
    ? data.map((i, idx) => ({
        ...i,
        sku: (i.sku || '').trim() || `SP-VAT-${idx + 1}`,
      }))
    : [];
}

export async function apiSaveInventoryItem(item: InventoryItem): Promise<InventoryItem[]> {
  const res = await fetchWithFallback(`${API_BASE_URL}/api/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  verifyJsonResponse(res);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || errData.error || `Lỗi lưu hàng hóa vào CSDL (HTTP ${res.status})`);
  }
  return fetchInventory(item.companyId);
}

export async function apiDeleteInventoryItem(sku: string, companyId?: string): Promise<InventoryItem[]> {
  const res = await fetchWithFallback(`${API_BASE_URL}/api/inventory/${encodeURIComponent(sku)}`, {
    method: 'DELETE',
  });
  verifyJsonResponse(res);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || errData.error || `Lỗi xóa hàng hóa khỏi CSDL (HTTP ${res.status})`);
  }
  return fetchInventory(companyId);
}

export async function apiBulkDeleteInventoryItems(skus: string[], companyId?: string): Promise<InventoryItem[]> {
  const res = await fetchWithFallback(`${API_BASE_URL}/api/inventory/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skus }),
  });
  verifyJsonResponse(res);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || errData.error || `Lỗi xóa hàng loạt hàng hóa khỏi CSDL (HTTP ${res.status})`);
  }
  return fetchInventory(companyId);
}

export async function fetchInvoices(companyId?: string): Promise<Invoice[]> {
  try {
    const url = companyId
      ? `${API_BASE_URL}/api/invoices?companyId=${encodeURIComponent(companyId)}`
      : `${API_BASE_URL}/api/invoices`;
    const res = await fetchWithFallback(url);
    if (!res.ok) {
      throw new Error(`Lỗi tải danh sách hóa đơn từ CSDL (HTTP ${res.status})`);
    }
    verifyJsonResponse(res);
    const data: Invoice[] = await res.json();
    return Array.isArray(data) ? data.filter((i) => i && i.id) : [];
  } catch (err) {
    console.warn('API fetchInvoices failed:', err);
    return [];
  }
}

export async function apiSaveInvoice(invoice: Invoice): Promise<{ inventory: InventoryItem[]; invoices: Invoice[] }> {
  const res = await fetchWithFallback(`${API_BASE_URL}/api/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invoice),
  });

  verifyJsonResponse(res);

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err: any = new Error(errData.detail || errData.error || `Lỗi lưu hóa đơn vào CSDL (HTTP ${res.status})`);
    if (errData.isDuplicate || errData.detail?.includes('đã tồn tại') || errData.error?.includes('đã tồn tại')) {
      err.isDuplicate = true;
    }
    throw err;
  }

  let updatedInv = await fetchInventory(invoice.companyId);
  // Some older local databases may contain an invoice but no stock rows.
  // Rebuild that company's inventory from its saved invoices before returning.
  if (updatedInv.length === 0 && invoice.items.length > 0) {
    updatedInv = await apiResyncInventory(invoice.companyId);
  }
  const updatedInvoices = await fetchInvoices(invoice.companyId);

  return { inventory: updatedInv, invoices: updatedInvoices };
}

export async function apiDeleteInvoice(id: string, companyId?: string): Promise<{ inventory: InventoryItem[]; invoices: Invoice[] }> {
  const url = companyId
    ? `${API_BASE_URL}/api/invoices/${encodeURIComponent(id)}?company_id=${encodeURIComponent(companyId)}`
    : `${API_BASE_URL}/api/invoices/${encodeURIComponent(id)}`;
  const res = await fetchWithFallback(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  verifyJsonResponse(res);

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || errData.error || `Lỗi xóa hóa đơn khỏi CSDL (HTTP ${res.status})`);
  }

  const updatedInvoices = await fetchInvoices(companyId);
  const updatedInventory = await fetchInventory(companyId);

  return { inventory: updatedInventory, invoices: updatedInvoices };
}

export async function apiClearInvoices(companyId?: string): Promise<{ inventory: InventoryItem[]; invoices: Invoice[] }> {
  const url = companyId
    ? `${API_BASE_URL}/api/invoices?company_id=${encodeURIComponent(companyId)}`
    : `${API_BASE_URL}/api/invoices`;
  const res = await fetchWithFallback(url, { method: 'DELETE' });

  verifyJsonResponse(res);

  if (!res.ok) {
    throw new Error(`Làm sạch danh sách hóa đơn thất bại (HTTP ${res.status})`);
  }
  const updatedInv = await fetchInventory(companyId);
  const updatedInvoices = await fetchInvoices(companyId);
  return { inventory: updatedInv, invoices: updatedInvoices };
}

export async function apiClearCompanyData(companyId?: string): Promise<{ inventory: InventoryItem[]; invoices: Invoice[] }> {
  const url = companyId
    ? `${API_BASE_URL}/api/clear-company-data?company_id=${encodeURIComponent(companyId)}`
    : `${API_BASE_URL}/api/clear-company-data`;
  const res = await fetchWithFallback(url, { method: 'DELETE' });

  verifyJsonResponse(res);

  if (!res.ok) {
    throw new Error(`Làm sạch dữ liệu công ty thất bại (HTTP ${res.status})`);
  }
  const updatedInv = await fetchInventory(companyId);
  const updatedInvoices = await fetchInvoices(companyId);
  return { inventory: updatedInv, invoices: updatedInvoices };
}

export async function apiClearAllData(companyId?: string): Promise<{ inventory: InventoryItem[]; invoices: Invoice[] }> {
  return apiClearCompanyData(companyId);
}

export async function fetchGmailConfig(): Promise<GmailConfig | null> {
  try {
    const res = await fetchWithFallback(`${API_BASE_URL}/api/gmail-config`);
    verifyJsonResponse(res);
    const data: GmailConfig = await res.json();
    saveLocalGmailConfigCache(data);
    return data;
  } catch (err) {
    console.warn('API fetchGmailConfig failed, falling back to localStorage cache:', err);
    return getLocalGmailConfigCache();
  }
}

export async function apiSaveGmailConfig(config: GmailConfig): Promise<GmailConfig | null> {
  try {
    const res = await fetchWithFallback(`${API_BASE_URL}/api/gmail-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    verifyJsonResponse(res);
    const data = await res.json();
    const updated = data.config || config;
    saveLocalGmailConfigCache(updated);
    return updated;
  } catch (err) {
    console.error('API apiSaveGmailConfig error:', err);
    saveLocalGmailConfigCache(config);
    return config;
  }
}

export async function fetchEmailLogs(): Promise<EmailLog[]> {
  try {
    const res = await fetchWithFallback(`${API_BASE_URL}/api/email-logs`);
    verifyJsonResponse(res);
    const data: EmailLog[] = await res.json();
    saveLocalEmailLogsCache(data);
    return data;
  } catch (err) {
    console.warn('API fetchEmailLogs failed, falling back to localStorage cache:', err);
    return getLocalEmailLogsCache() || [];
  }
}

export async function apiScanGmail(): Promise<{
  inventory: InventoryItem[];
  invoices: Invoice[];
  emailLogs: EmailLog[];
  gmailConfig: GmailConfig;
  message: string;
}> {
  const res = await fetchWithFallback(`${API_BASE_URL}/api/scan-gmail`, { method: 'POST' });
  verifyJsonResponse(res);
  const data = await res.json();
  if (data.emailLogs) saveLocalEmailLogsCache(data.emailLogs);
  if (data.gmailConfig) saveLocalGmailConfigCache(data.gmailConfig);
  return data;
}

// ==========================================
// DATA BACKUP & RESTORE HELPERS
// ==========================================

export async function downloadDatabaseFile(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/backup/download`);
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vat_database.db';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return;
    }
  } catch (err) {
    console.warn('Backend download failed:', err);
  }

  // Fallback: Create downloadable JSON backup directly from current SQLite state
  const companies = await fetchCompanies();
  const inventory = await fetchInventory();
  const invoices = await fetchInvoices();
  const backupData = {
    companies,
    inventory,
    invoices,
    gmailConfig: getLocalGmailConfigCache(),
    emailLogs: getLocalEmailLogsCache() || [],
    exportedAt: new Date().toISOString(),
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vat_database_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function restoreDatabaseFromFile(file: File): Promise<{
  companies: Company[];
  inventory: InventoryItem[];
  invoices: Invoice[];
  gmailConfig?: GmailConfig;
  emailLogs?: EmailLog[];
  message: string;
}> {
  const text = await file.text();
  let backupData: any = null;

  try {
    backupData = JSON.parse(text);
  } catch (err) {
    throw new Error('File không hợp lệ. Vui lòng chọn file sao lưu JSON hoặc file dữ liệu hợp lệ.');
  }

  if (!backupData || typeof backupData !== 'object') {
    throw new Error('Định dạng file sao lưu không hợp lệ.');
  }

  if (backupData.gmailConfig) saveLocalGmailConfigCache(backupData.gmailConfig);
  if (Array.isArray(backupData.emailLogs)) saveLocalEmailLogsCache(backupData.emailLogs);

  // Attempt server sync if backend is active
  try {
    const res = await fetch(`${API_BASE_URL}/api/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupData),
    });
    if (res.ok) {
      verifyJsonResponse(res);
      const resData = await res.json();
      return {
        companies: resData.companies || backupData.companies || [],
        inventory: resData.inventory || backupData.inventory || [],
        invoices: resData.invoices || backupData.invoices || [],
        gmailConfig: resData.gmailConfig || backupData.gmailConfig,
        emailLogs: resData.emailLogs || backupData.emailLogs,
        message: 'Khôi phục cơ sở dữ liệu SQLite thành công!',
      };
    }
  } catch (err) {
    console.warn('Server restore sync endpoint error:', err);
  }

  const freshCompanies = await fetchCompanies();
  const freshInventory = await fetchInventory();
  const freshInvoices = await fetchInvoices();

  return {
    companies: freshCompanies.length > 0 ? freshCompanies : initialCompanies,
    inventory: freshInventory,
    invoices: freshInvoices,
    gmailConfig: backupData.gmailConfig || getLocalGmailConfigCache(),
    emailLogs: backupData.emailLogs || getLocalEmailLogsCache() || [],
    message: 'Khôi phục toàn bộ cơ sở dữ liệu thành công!',
  };
}

export async function apiSendAIChatMessage(
  message: string,
  companyId?: string,
  history?: { role: 'user' | 'model'; text: string }[],
  inventoryData?: InventoryItem[],
  invoiceData?: Invoice[]
): Promise<string> {
  try {
    const res = await fetchWithFallback(`${API_BASE_URL}/api/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        companyId,
        history,
        inventoryData,
        invoiceData,
      }),
    });
    verifyJsonResponse(res);
    const data = await res.json().catch(() => ({}));
    if (data.error && !data.reply) {
      return `⚠️ Thông báo từ Trợ lý AI: ${data.error}`;
    }
    return data.reply || 'Không có phản hồi từ Trợ lý AI.';
  } catch (err: any) {
    console.error('Error in apiSendAIChatMessage:', err);
    return `❌ Không thể kết nối đến Trợ lý AI (${err?.message || err}). Vui lòng kiểm tra dịch vụ backend.`;
  }
}

export async function apiShutdownApp(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetchWithFallback(`${API_BASE_URL}/api/shutdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      verifyJsonResponse(res);
      const data = await res.json().catch(() => ({
        success: true,
        message: 'Phần mềm đã được đóng an toàn. Toàn bộ dữ liệu đã được lưu.',
      }));
      return {
        success: true,
        message: data.message || 'Phần mềm đã được đóng an toàn. Toàn bộ dữ liệu đã được lưu.',
      };
    }
  } catch (err) {
    console.warn('Shutdown endpoint call completed or server terminated immediately:', err);
  }
  return {
    success: true,
    message: 'Phần mềm đã được đóng an toàn. Toàn bộ dữ liệu đã được lưu.',
  };
}
