import { InventoryItem, Invoice, GmailConfig, EmailLog } from '../types';

export async function fetchInventory(): Promise<InventoryItem[]> {
  try {
    const res = await fetch('/api/inventory');
    if (!res.ok) throw new Error('Network response failed');
    return await res.json();
  } catch (err) {
    console.warn('API fetchInventory failed, using local cache:', err);
    return [];
  }
}

export async function apiSaveInventoryItem(item: InventoryItem): Promise<InventoryItem[]> {
  try {
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    const data = await res.json();
    return data.inventory || [];
  } catch (err) {
    console.error('API apiSaveInventoryItem error:', err);
    return [];
  }
}

export async function apiDeleteInventoryItem(sku: string): Promise<InventoryItem[]> {
  try {
    const res = await fetch(`/api/inventory/${encodeURIComponent(sku)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    return data.inventory || [];
  } catch (err) {
    console.error('API apiDeleteInventoryItem error:', err);
    return [];
  }
}

export async function apiBulkDeleteInventoryItems(skus: string[]): Promise<InventoryItem[]> {
  try {
    const res = await fetch('/api/inventory/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skus }),
    });
    const data = await res.json();
    return data.inventory || [];
  } catch (err) {
    console.error('API apiBulkDeleteInventoryItems error:', err);
    return [];
  }
}

export async function fetchInvoices(): Promise<Invoice[]> {
  try {
    const res = await fetch('/api/invoices');
    if (!res.ok) throw new Error('Network response failed');
    return await res.json();
  } catch (err) {
    console.warn('API fetchInvoices failed:', err);
    return [];
  }
}

export async function apiSaveInvoice(invoice: Invoice): Promise<{ inventory: InventoryItem[]; invoices: Invoice[] }> {
  try {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoice),
    });
    const data = await res.json();
    return {
      inventory: data.inventory || [],
      invoices: data.invoices || [],
    };
  } catch (err) {
    console.error('API apiSaveInvoice error:', err);
    return { inventory: [], invoices: [] };
  }
}

export async function fetchGmailConfig(): Promise<GmailConfig | null> {
  try {
    const res = await fetch('/api/gmail-config');
    if (!res.ok) throw new Error('Network response failed');
    return await res.json();
  } catch (err) {
    console.warn('API fetchGmailConfig failed:', err);
    return null;
  }
}

export async function apiSaveGmailConfig(config: GmailConfig): Promise<GmailConfig | null> {
  try {
    const res = await fetch('/api/gmail-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    return data.config || null;
  } catch (err) {
    console.error('API apiSaveGmailConfig error:', err);
    return null;
  }
}

export async function fetchEmailLogs(): Promise<EmailLog[]> {
  try {
    const res = await fetch('/api/email-logs');
    if (!res.ok) throw new Error('Network response failed');
    return await res.json();
  } catch (err) {
    console.warn('API fetchEmailLogs failed:', err);
    return [];
  }
}

export async function apiScanGmail(): Promise<{
  inventory: InventoryItem[];
  invoices: Invoice[];
  emailLogs: EmailLog[];
  gmailConfig: GmailConfig;
  message: string;
}> {
  const res = await fetch('/api/scan-gmail', { method: 'POST' });
  if (!res.ok) throw new Error('Scan Gmail request failed');
  return await res.json();
}
