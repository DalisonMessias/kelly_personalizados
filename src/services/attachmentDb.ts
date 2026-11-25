import { CustomerQuote, QuoteAttachment } from '../types';
import { supabase } from './supabase';

const DB_NAME = 'kelly-personalizados-assets';
const DB_VERSION = 1;
const STORE_ATTACHMENTS = 'attachments';
const STORAGE_BUCKET = 'kelly_private_quote_assets_v1';
const QUOTES_STORAGE_KEY = 'kelly_quotes_v1';
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_QUOTE_ATTACHMENTS_SIZE = 30 * 1024 * 1024;

interface StoredAttachment {
  id: string;
  quoteId: string;
  metadata: QuoteAttachment;
  blob: Blob;
  createdAt: string;
  cloudUserId?: string;
  ownerUserId?: string;
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id || null;
  } catch {
    return null;
  }
}

function getQuoteAttachment(id: string): { quoteId: string; metadata: QuoteAttachment } | null {
  try {
    const quotes = JSON.parse(localStorage.getItem(QUOTES_STORAGE_KEY) || '[]') as CustomerQuote[];
    for (const quote of quotes) {
      const metadata = quote.attachments?.find((attachment) => attachment.id === id);
      if (metadata) return { quoteId: quote.id, metadata };
    }
  } catch {
    return null;
  }
  return null;
}

async function getAttachmentsForQuote(quoteId: string): Promise<StoredAttachment[]> {
  const database = await openDatabase();
  const records = await new Promise<StoredAttachment[]>((resolve, reject) => {
    const transaction = database.transaction(STORE_ATTACHMENTS, 'readonly');
    const request = transaction.objectStore(STORE_ATTACHMENTS).index('quoteId').getAll(IDBKeyRange.only(quoteId));
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return records;
}

async function saveAttachmentRecord(record: StoredAttachment): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_ATTACHMENTS, 'readwrite');
    transaction.objectStore(STORE_ATTACHMENTS).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function uploadAttachmentRecord(record: StoredAttachment, userId: string): Promise<boolean> {
  try {
    const storagePath = userId + '/' + record.id;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, record.blob, {
      contentType: record.blob.type || record.metadata.type,
      upsert: true,
    });
    if (error) return false;

    await saveAttachmentRecord({ ...record, cloudUserId: userId, ownerUserId: record.ownerUserId || userId });
    return true;
  } catch {
    return false;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_ATTACHMENTS)) {
        const store = database.createObjectStore(STORE_ATTACHMENTS, { keyPath: 'id' });
        store.createIndex('quoteId', 'quoteId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putAttachment(
  quoteId: string,
  metadata: QuoteAttachment,
  blob: Blob
): Promise<boolean> {
  if (blob.size > MAX_ATTACHMENT_SIZE) {
    throw new Error('Uma imagem excede o limite de 10 MB.');
  }

  const userId = await getCurrentUserId();
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_ATTACHMENTS, 'readwrite');
    const store = transaction.objectStore(STORE_ATTACHMENTS);
    const record: StoredAttachment = {
      id: metadata.id,
      quoteId,
      metadata,
      blob,
      createdAt: new Date().toISOString(),
      ownerUserId: userId || undefined,
    };
    store.put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();

  if (!userId) return false;
  return uploadAttachmentRecord({ id: metadata.id, quoteId, metadata, blob, createdAt: new Date().toISOString(), ownerUserId: userId }, userId);
}

export async function getAttachment(id: string): Promise<StoredAttachment | null> {
  const database = await openDatabase();
  const record = await new Promise<StoredAttachment | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_ATTACHMENTS, 'readonly');
    const request = transaction.objectStore(STORE_ATTACHMENTS).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  const userId = await getCurrentUserId();
  const recordBelongsToAnotherUser = Boolean(record?.ownerUserId && userId && record.ownerUserId !== userId);
  if (record && !recordBelongsToAnotherUser && (!record.cloudUserId || !userId || record.cloudUserId === userId)) {
    return record;
  }
  if (!userId) return record || null;

  const storagePath = userId + '/' + id;
  let blob: Blob | null = null;
  try {
    const result = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);
    if (!result.error) blob = result.data;
  } catch {
    return recordBelongsToAnotherUser ? null : record || null;
  }
  if (!blob) return recordBelongsToAnotherUser ? null : record || null;

  const knownAttachment = getQuoteAttachment(id);
  const metadata = knownAttachment?.metadata || {
    id,
    name: id,
    type: blob.type || 'application/octet-stream',
    size: blob.size,
    description: '',
    createdAt: new Date().toISOString(),
  };
  const downloaded: StoredAttachment = {
    id,
    quoteId: knownAttachment?.quoteId || '',
    metadata,
    blob,
    createdAt: metadata.createdAt,
    cloudUserId: userId,
    ownerUserId: userId,
  };
  await saveAttachmentRecord(downloaded);
  return downloaded;
}

export async function deleteAttachment(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_ATTACHMENTS, 'readwrite');
    transaction.objectStore(STORE_ATTACHMENTS).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function deleteAttachmentsByQuote(quoteId: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_ATTACHMENTS, 'readwrite');
    const store = transaction.objectStore(STORE_ATTACHMENTS);
    const request = store.index('quoteId').openCursor(IDBKeyRange.only(quoteId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function exportAttachmentsByQuote(quoteId: string): Promise<Array<{ metadata: QuoteAttachment; blob: Blob }>> {
  const cachedRecords = await getAttachmentsForQuote(quoteId);
  const cachedById = new Map(cachedRecords.map((record) => [record.id, record]));
  const quote = (() => {
    try {
      return (JSON.parse(localStorage.getItem(QUOTES_STORAGE_KEY) || '[]') as CustomerQuote[])
        .find((item) => item.id === quoteId);
    } catch {
      return undefined;
    }
  })();
  const metadataList = quote?.attachments || cachedRecords.map((record) => record.metadata);
  const exported = await Promise.all(metadataList.map(async (metadata) => {
    const cached = cachedById.get(metadata.id);
    const stored = cached || await getAttachment(metadata.id);
    return stored ? { metadata, blob: stored.blob } : null;
  }));
  return exported.filter((item): item is { metadata: QuoteAttachment; blob: Blob } => item !== null);
}

export async function syncPendingAttachments(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const quotes = (() => {
    try {
      return JSON.parse(localStorage.getItem(QUOTES_STORAGE_KEY) || '[]') as CustomerQuote[];
    } catch {
      return [];
    }
  })();
  const referencedIds = new Set(quotes.flatMap((quote) => quote.attachments?.map((attachment) => attachment.id) || []));
  const database = await openDatabase();
  const records = await new Promise<StoredAttachment[]>((resolve, reject) => {
    const transaction = database.transaction(STORE_ATTACHMENTS, 'readonly');
    const request = transaction.objectStore(STORE_ATTACHMENTS).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  database.close();

  for (const record of records) {
    if (
      referencedIds.has(record.id)
      && (!record.ownerUserId || record.ownerUserId === userId)
      && record.cloudUserId !== userId
    ) {
      await uploadAttachmentRecord(record, userId);
    }
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
