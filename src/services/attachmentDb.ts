import { QuoteAttachment } from '../types';

const DB_NAME = 'kelly-personalizados-assets';
const DB_VERSION = 1;
const STORE_ATTACHMENTS = 'attachments';
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_QUOTE_ATTACHMENTS_SIZE = 30 * 1024 * 1024;

interface StoredAttachment {
  id: string;
  quoteId: string;
  metadata: QuoteAttachment;
  blob: Blob;
  createdAt: string;
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
): Promise<void> {
  if (blob.size > MAX_ATTACHMENT_SIZE) {
    throw new Error('Uma imagem excede o limite de 10 MB.');
  }

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
    };
    store.put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
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
  return record || null;
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
  const database = await openDatabase();
  const records = await new Promise<StoredAttachment[]>((resolve, reject) => {
    const transaction = database.transaction(STORE_ATTACHMENTS, 'readonly');
    const request = transaction.objectStore(STORE_ATTACHMENTS).index('quoteId').getAll(IDBKeyRange.only(quoteId));
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return records.map((record) => ({ metadata: record.metadata, blob: record.blob }));
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
