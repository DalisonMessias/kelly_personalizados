import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export const APP_DATA_KEYS = [
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

const CACHE_OWNER_KEY = 'kelly_cache_owner_v1';
const PENDING_PREFIX = 'kelly_sync_pending_v1:';
const USER_CACHE_PREFIX = 'kelly_user_cache_v1:';
const LEGACY_CACHE_PREFIX = 'kelly_legacy_cache_v1:';
const SNAPSHOT_TABLE = 'kelly_user_data_snapshots_v1';

export interface DataSyncStatus {
  state: 'local' | 'sincronizando' | 'sincronizado' | 'offline';
  message: string;
  lastSyncedAt: string | null;
}

export interface CloudDataSnapshot {
  id: string;
  user_id: string;
  data_key: string;
  data_value: unknown;
  created_at: string;
}

let activeUserId: string | null = null;
let currentStatus: DataSyncStatus = {
  state: 'local',
  message: 'O cache deste navegador está disponível.',
  lastSyncedAt: null,
};
const statusListeners = new Set<(status: DataSyncStatus) => void>();
const scheduledWrites = new Map<string, ReturnType<typeof setTimeout>>();
const inFlightWrites = new Map<string, Promise<void>>();

function pendingKey(userId: string, dataKey: string): string {
  return PENDING_PREFIX + userId + ':' + dataKey;
}

function userCacheKey(userId: string, dataKey: string): string {
  return USER_CACHE_PREFIX + userId + ':' + dataKey;
}

function legacyCacheKey(userId: string, dataKey: string): string {
  return LEGACY_CACHE_PREFIX + userId + ':' + dataKey;
}

function pairKey(userId: string, dataKey: string): string {
  return userId + ':' + dataKey;
}

function updateStatus(status: DataSyncStatus): void {
  currentStatus = status;
  statusListeners.forEach((listener) => listener(currentStatus));
}

export function getDataSyncStatus(): DataSyncStatus {
  return currentStatus;
}

export function subscribeToDataSyncStatus(listener: (status: DataSyncStatus) => void): () => void {
  statusListeners.add(listener);
  listener(currentStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

export function hasPendingCloudData(dataKey: string): boolean {
  return Boolean(activeUserId && localStorage.getItem(pendingKey(activeUserId, dataKey)) === '1');
}

export function applyCloudDataValueLocally(dataKey: string, value: unknown): void {
  localStorage.setItem(dataKey, JSON.stringify(value));
}

export async function getLatestCloudDataSnapshot(dataKey: string): Promise<CloudDataSnapshot | null> {
  const userId = activeUserId;
  if (!userId) throw new Error('Entre em uma conta administrativa para carregar as configurações.');

  const { data, error } = await supabase
    .from(SNAPSHOT_TABLE)
    .select('id, user_id, data_key, data_value, created_at')
    .eq('user_id', userId)
    .eq('data_key', dataKey)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as CloudDataSnapshot | null;
}

export function subscribeToCloudDataSnapshots(
  dataKey: string,
  onSnapshot: (snapshot: CloudDataSnapshot) => void,
  onStatus?: (status: string) => void,
): () => void {
  const userId = activeUserId;
  if (!userId) {
    onStatus?.('CHANNEL_ERROR');
    return () => undefined;
  }

  const channel = supabase
    .channel(`kelly-cloud-data:${userId}:${dataKey}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: SNAPSHOT_TABLE,
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      const snapshot = payload.new as CloudDataSnapshot;
      if (snapshot.data_key === dataKey) onSnapshot(snapshot);
    })
    .subscribe((status) => onStatus?.(String(status)));

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function useDataSyncStatus(): DataSyncStatus {
  const [status, setStatus] = useState<DataSyncStatus>(currentStatus);

  useEffect(() => subscribeToDataSyncStatus(setStatus), []);

  return status;
}

function readLatestLocalValue(dataKey: string): { raw: string; value: unknown } | null {
  const raw = localStorage.getItem(dataKey);
  if (raw === null) return null;

  try {
    return { raw, value: JSON.parse(raw) as unknown };
  } catch {
    return null;
  }
}

function scheduleSnapshotWrite(userId: string, dataKey: string, delay = 350): void {
  if (activeUserId !== userId) return;

  localStorage.setItem(pendingKey(userId, dataKey), '1');
  updateStatus({
    state: 'sincronizando',
    message: 'Salvando alterações no Supabase e mantendo o cache local atualizado.',
    lastSyncedAt: currentStatus.lastSyncedAt,
  });

  const id = pairKey(userId, dataKey);
  const existingTimer = scheduledWrites.get(id);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    scheduledWrites.delete(id);
    void flushSnapshotWrite(userId, dataKey);
  }, delay);
  scheduledWrites.set(id, timer);
}

async function flushSnapshotWrite(userId: string, dataKey: string): Promise<void> {
  if (activeUserId !== userId) return;

  const id = pairKey(userId, dataKey);
  const running = inFlightWrites.get(id);
  if (running) {
    try {
      await running;
    } catch {
      return;
    }
    if (activeUserId === userId && localStorage.getItem(pendingKey(userId, dataKey)) === '1') {
      scheduleSnapshotWrite(userId, dataKey, 0);
    }
    return;
  }

  const localValue = readLatestLocalValue(dataKey);
  if (!localValue) return;

  const operation = (async () => {
    const { error } = await supabase.from(SNAPSHOT_TABLE).insert({
      user_id: userId,
      data_key: dataKey,
      data_value: localValue.value,
    });

    if (error) throw error;

    if (localStorage.getItem(dataKey) === localValue.raw) {
      localStorage.removeItem(pendingKey(userId, dataKey));
    }
    const hasPendingData = APP_DATA_KEYS.some((key) => localStorage.getItem(pendingKey(userId, key)) === '1');
    updateStatus({
      state: hasPendingData ? 'sincronizando' : 'sincronizado',
      message: hasPendingData
        ? 'Algumas alterações ainda estão sendo sincronizadas com o Supabase.'
        : 'Alterações sincronizadas com o Supabase. O cache local continua disponível.',
      lastSyncedAt: new Date().toISOString(),
    });
  })();

  inFlightWrites.set(id, operation);
  try {
    await operation;
  } catch (error) {
    updateStatus({
      state: 'offline',
      message: error instanceof Error
        ? 'A alteração continua no cache local e será sincronizada quando o Supabase estiver disponível.'
        : 'A alteração continua no cache local; a sincronização será retomada quando houver conexão.',
      lastSyncedAt: currentStatus.lastSyncedAt,
    });
  } finally {
    if (inFlightWrites.get(id) === operation) inFlightWrites.delete(id);
  }
}

export function writeCacheValue(dataKey: string, serializedValue: string): void {
  localStorage.setItem(dataKey, serializedValue);
  if (activeUserId) scheduleSnapshotWrite(activeUserId, dataKey);
}

export async function saveCacheValueAndWait(dataKey: string, serializedValue: string): Promise<void> {
  const userId = activeUserId;
  if (!userId) throw new Error('Entre em uma conta administrativa para salvar no Supabase.');

  const id = pairKey(userId, dataKey);
  if (localStorage.getItem(dataKey) !== serializedValue) writeCacheValue(dataKey, serializedValue);
  if (localStorage.getItem(pendingKey(userId, dataKey)) !== '1' &&
      !scheduledWrites.has(id) && !inFlightWrites.has(id)) return;

  await flushCacheValueAndWait(dataKey);
}

export async function flushCacheValueAndWait(dataKey: string): Promise<void> {
  const userId = activeUserId;
  if (!userId) throw new Error('Entre em uma conta administrativa para salvar no Supabase.');

  const id = pairKey(userId, dataKey);
  if (!readLatestLocalValue(dataKey)) throw new Error('Não há um valor local válido disponível para sincronizar.');

  while (activeUserId === userId) {
    if (!readLatestLocalValue(dataKey)) throw new Error('O valor local ficou inválido durante a sincronização e foi mantido para análise.');
    const valueBeforeFlush = localStorage.getItem(dataKey);
    const timer = scheduledWrites.get(id);
    if (timer) clearTimeout(timer);
    scheduledWrites.delete(id);

    await flushSnapshotWrite(userId, dataKey);

    if (activeUserId !== userId) break;
    const valueAfterFlush = localStorage.getItem(dataKey);
    const hasPendingValue = localStorage.getItem(pendingKey(userId, dataKey)) === '1';
    if (!hasPendingValue && valueAfterFlush === valueBeforeFlush) return;
    if (currentStatus.state === 'offline') {
      throw new Error('A alteração continua protegida neste dispositivo e será sincronizada quando o Supabase estiver disponível.');
    }
  }

  throw new Error('A sessão mudou antes da confirmação da sincronização. Entre novamente e tente salvar.');
}

export async function flushPendingCloudData(): Promise<void> {
  const userId = activeUserId;
  if (!userId) throw new Error('Entre em uma conta administrativa para criar o backup.');

  for (const dataKey of APP_DATA_KEYS) {
    if (localStorage.getItem(pendingKey(userId, dataKey)) !== '1') continue;
    await flushCacheValueAndWait(dataKey);
  }
}

export function applyRestoredCloudData(values: Record<string, unknown>): void {
  const userId = activeUserId;
  APP_DATA_KEYS.forEach((dataKey) => {
    if (!Object.prototype.hasOwnProperty.call(values, dataKey)) return;
    const id = userId ? pairKey(userId, dataKey) : null;
    const timer = id ? scheduledWrites.get(id) : null;
    if (timer) clearTimeout(timer);
    if (id) scheduledWrites.delete(id);
    localStorage.setItem(dataKey, JSON.stringify(values[dataKey]));
    if (userId) localStorage.removeItem(pendingKey(userId, dataKey));
  });
}

export function retryPendingCloudData(): void {
  const userId = activeUserId;
  if (!userId) return;
  APP_DATA_KEYS.forEach((dataKey) => {
    if (localStorage.getItem(pendingKey(userId, dataKey)) === '1') {
      scheduleSnapshotWrite(userId, dataKey, 0);
    }
  });
}

export function deactivateCloudPersistence(): void {
  activeUserId = null;
  updateStatus({
    state: 'local',
    message: 'O cache local está disponível. Entre na conta para sincronizar os dados.',
    lastSyncedAt: currentStatus.lastSyncedAt,
  });
}

function switchLocalCacheOwner(userId: string): void {
  const previousOwner = localStorage.getItem(CACHE_OWNER_KEY);
  if (previousOwner === userId) {
    activeUserId = userId;
    return;
  }

  if (previousOwner) {
    APP_DATA_KEYS.forEach((dataKey) => {
      const currentValue = localStorage.getItem(dataKey);
      if (currentValue !== null) {
        localStorage.setItem(userCacheKey(previousOwner, dataKey), currentValue);
      }
    });

    APP_DATA_KEYS.forEach((dataKey) => {
      const accountValue = localStorage.getItem(userCacheKey(userId, dataKey));
      if (accountValue === null) localStorage.removeItem(dataKey);
      else localStorage.setItem(dataKey, accountValue);
    });
  } else {
    APP_DATA_KEYS.forEach((dataKey) => {
      const currentValue = localStorage.getItem(dataKey);
      if (currentValue !== null) {
        localStorage.setItem(legacyCacheKey(userId, dataKey), currentValue);
      }
    });
  }

  localStorage.setItem(CACHE_OWNER_KEY, userId);
  activeUserId = userId;
}

export async function initializeCloudPersistence(userId: string): Promise<void> {
  let dataOwnerId = userId;
  try {
    const { data: sharedOwnerId, error: ownerError } = await supabase.rpc('kelly_get_shared_data_owner_v1');
    if (!ownerError && typeof sharedOwnerId === 'string') dataOwnerId = sharedOwnerId;
  } catch {
    dataOwnerId = userId;
  }
  switchLocalCacheOwner(dataOwnerId);
  updateStatus({
    state: 'sincronizando',
    message: 'Conferindo os dados da conta e sincronizando o cache local.',
    lastSyncedAt: currentStatus.lastSyncedAt,
  });

  try {
    const results = await Promise.all(APP_DATA_KEYS.map(async (dataKey) => {
      const { data, error } = await supabase
        .from(SNAPSHOT_TABLE)
        .select('data_value, created_at')
        .eq('user_id', dataOwnerId)
        .eq('data_key', dataKey)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return { dataKey, data, error };
    }));

    const failedResult = results.find((result) => result.error);
    if (failedResult?.error) throw failedResult.error;

    let queuedLocalData = false;
    results.forEach(({ dataKey, data }) => {
      const localValue = readLatestLocalValue(dataKey);
      const hasPendingLocalValue = localStorage.getItem(pendingKey(dataOwnerId, dataKey)) === '1';

      if (hasPendingLocalValue && localValue) {
        scheduleSnapshotWrite(dataOwnerId, dataKey, 0);
        queuedLocalData = true;
        return;
      }

      if (data) {
        localStorage.setItem(dataKey, JSON.stringify(data.data_value));
        localStorage.removeItem(pendingKey(dataOwnerId, dataKey));
        return;
      }

      if (localValue) {
        scheduleSnapshotWrite(dataOwnerId, dataKey, 0);
        queuedLocalData = true;
      } else {
        localStorage.removeItem(pendingKey(dataOwnerId, dataKey));
      }
    });

    if (!queuedLocalData) {
      updateStatus({
        state: 'sincronizado',
        message: 'Os dados da conta estão sincronizados com o Supabase; o cache local está ativo.',
        lastSyncedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    updateStatus({
      state: 'offline',
      message: error instanceof Error
        ? 'O Supabase não respondeu. Os dados existentes continuam disponíveis no cache local.'
        : 'Não foi possível consultar o Supabase. Os dados existentes continuam no cache local.',
      lastSyncedAt: currentStatus.lastSyncedAt,
    });
  }
}
