import { applyRestoredCloudData, flushPendingCloudData } from './appDataSync';
import { supabase } from './supabase';
import { getSupabaseFunctionErrorMessage } from './supabaseFunctionErrors';

export const SYSTEM_BACKUP_DATA_KEYS = [
  'kelly_calc_products_v4',
  'kelly_calc_history_v4',
  'kelly_calc_settings_v4',
  'kelly_chat_conversations_v1',
  'kelly_service_orders_v1',
  'kelly_customers_v1',
  'kelly_quotes_v1',
  'kelly_quote_tags_v1',
  'kelly_store_products_v1',
  'kelly_store_categories_v1',
  'kelly_future_orders_v1',
  'kelly_store_change_history_v1',
] as const;

export interface SystemBackup {
  version: '2.0.0';
  backupId: string;
  exportedAt: string;
  appData: Record<string, unknown>;
  storefrontOrders: Array<Record<string, unknown>>;
  storefrontOrderHistory: Array<Record<string, unknown>>;
  users: Array<{
    id: string;
    email: string;
    name: string;
    username: string;
    createdAt: string | null;
    lastSignInAt: string | null;
    isAdmin: boolean;
    isActive: boolean;
  }>;
  restorationNotes: string[];
  checksum: string;
}

export interface SystemBackupHistoryItem {
  id: string;
  createdAt: string;
  checksum: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (isObject(value)) {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

async function calculateChecksum(value: Record<string, unknown>): Promise<string> {
  const { checksum: _checksum, ...payload } = value;
  const bytes = new TextEncoder().encode(stableStringify(payload));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function invokeBackup<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('system-backup', { body });
  if (error) {
    throw new Error(await getSupabaseFunctionErrorMessage(error, 'system-backup'));
  }
  if (!data) throw new Error('O servidor não retornou os dados esperados.');
  return data as T;
}

export async function validateSystemBackup(value: unknown): Promise<SystemBackup> {
  if (!isObject(value) || value.version !== '2.0.0' || typeof value.backupId !== 'string' ||
      typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt)) ||
      typeof value.checksum !== 'string' || !/^[a-f0-9]{64}$/i.test(value.checksum) ||
      !isObject(value.appData) || !Array.isArray(value.storefrontOrders) ||
      !Array.isArray(value.storefrontOrderHistory) || !Array.isArray(value.users)) {
    throw new Error('O arquivo não é uma cópia de segurança compatível.');
  }

  for (const key of SYSTEM_BACKUP_DATA_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value.appData, key)) throw new Error('A cópia não contém todos os dados necessários.');
    if (key === 'kelly_calc_settings_v4') {
      if (!isObject(value.appData[key])) throw new Error('As configurações da cópia estão inválidas.');
    } else if (!Array.isArray(value.appData[key])) {
      throw new Error('Uma das listas de dados da cópia está inválida.');
    }
  }

  if (value.storefrontOrders.some((order) => !isObject(order) || typeof order.id !== 'string') ||
      value.storefrontOrderHistory.some((entry) => !isObject(entry) || typeof entry.id !== 'string')) {
    throw new Error('Os pedidos ou o histórico da cópia estão inválidos.');
  }

  const expected = await calculateChecksum(value);
  if (expected !== value.checksum) throw new Error('A verificação de integridade da cópia não foi aprovada.');
  return value as unknown as SystemBackup;
}

export async function createSystemBackup(): Promise<SystemBackup> {
  await flushPendingCloudData();
  const result = await invokeBackup<{ backup: SystemBackup }>({ action: 'create' });
  return validateSystemBackup(result.backup);
}

export function downloadSystemBackup(backup: SystemBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date(backup.exportedAt).toISOString().replace(/[:.]/g, '-');
  const link = document.createElement('a');
  link.href = url;
  link.download = `backup-kelly-personalizados-${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function listSystemBackups(): Promise<SystemBackupHistoryItem[]> {
  const result = await invokeBackup<{ backups: SystemBackupHistoryItem[] }>({ action: 'list' });
  return Array.isArray(result.backups) ? result.backups : [];
}

export async function getSystemBackup(backupId: string): Promise<SystemBackup> {
  const result = await invokeBackup<{ backup: SystemBackup }>({ action: 'get', backupId });
  return validateSystemBackup(result.backup);
}

export async function restoreSystemBackup(backup: SystemBackup): Promise<string> {
  const validated = await validateSystemBackup(backup);
  await flushPendingCloudData();
  const result = await invokeBackup<{ appData: Record<string, unknown>; message: string }>({
    action: 'restore',
    backup: validated,
  });
  applyRestoredCloudData(result.appData);
  return result.message;
}
