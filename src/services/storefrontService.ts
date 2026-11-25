import { supabase } from './supabase';

export const STORE_PUBLIC_ASSETS_BUCKET = 'kelly_public_store_assets_v1';
export const STORE_PRIVATE_REFERENCES_BUCKET = 'kelly_private_store_references_v1';
export const MAX_STORE_REFERENCE_SIZE = 10 * 1024 * 1024;

export interface StorefrontPersonalizationOption {
  id: string;
  name: string;
  type: 'texto' | 'numero' | 'selecao' | 'multipla_escolha' | 'sim_nao';
  required: boolean;
  values: string[];
  priceAdjustment: number;
}

export interface StorefrontAddon {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface StorefrontProduct {
  id: string;
  name: string;
  publicDescription: string;
  category: string;
  imageIds: string[];
  minimumQuantity: number;
  productionDeadline: string;
  salePrice: number | null;
  personalizationOptions: StorefrontPersonalizationOption[];
  addons: StorefrontAddon[];
}

export interface StorefrontCatalog {
  products: StorefrontProduct[];
  categories: Array<{ id: string; name: string }>;
}

export type StorefrontOrderStatus =
  | 'novo'
  | 'em_analise'
  | 'aguardando_confirmacao'
  | 'em_producao'
  | 'pronto'
  | 'entregue'
  | 'cancelado';

export interface StorefrontOrderHistoryEntry {
  id: string;
  previousStatus: StorefrontOrderStatus | null;
  newStatus: StorefrontOrderStatus;
  note: string;
  createdAt: string;
}

export interface StorefrontOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerWhatsapp: string;
  productId: string;
  productName: string;
  quantity: number;
  personalizations: Record<string, unknown>;
  selectedAddons: Array<{ id: string; name: string; price: number }>;
  customerText: string;
  themeColors: string;
  notes: string;
  referencePath: string | null;
  estimatedUnitPrice: number | null;
  estimatedTotal: number | null;
  status: StorefrontOrderStatus;
  createdAt: string;
  updatedAt: string;
  history: StorefrontOrderHistoryEntry[];
}

export interface SubmitStorefrontOrderInput {
  id: string;
  customerName: string;
  customerWhatsapp: string;
  productId: string;
  quantity: number;
  personalizations: Record<string, unknown>;
  customerText: string;
  themeColors: string;
  notes: string;
  referencePath: string | null;
  selectedAddons: string[];
}

export interface SubmittedStorefrontOrder {
  id: string;
  orderNumber: string;
  status: StorefrontOrderStatus;
  estimatedUnitPrice: number | null;
  estimatedTotal: number | null;
  createdAt: string;
}

export function createStorefrontRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    return (char === 'x' ? random : (random & 0x3 | 0x8)).toString(16);
  });
}

function extensionForImage(file: File): string {
  const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
  const extension = extensions[file.type];
  if (!extension) throw new Error('Use uma imagem PNG, JPG ou WEBP.');
  return extension;
}

export async function getStorefrontCatalog(): Promise<StorefrontCatalog> {
  const { data, error } = await supabase.rpc('kelly_get_storefront_catalog_v1');
  if (error) throw error;
  const catalog = data as Partial<StorefrontCatalog> | null;
  return {
    products: Array.isArray(catalog?.products) ? catalog.products : [],
    categories: Array.isArray(catalog?.categories) ? catalog.categories : [],
  };
}

export async function submitStorefrontOrder(input: SubmitStorefrontOrderInput): Promise<SubmittedStorefrontOrder> {
  const { data, error } = await supabase.rpc('kelly_submit_storefront_order_v1', {
    p_request_id: input.id,
    p_customer_name: input.customerName.trim(),
    p_customer_whatsapp: input.customerWhatsapp.replace(/\D/g, ''),
    p_product_id: input.productId,
    p_quantity: input.quantity,
    p_personalizations: input.personalizations,
    p_customer_text: input.customerText.trim(),
    p_theme_colors: input.themeColors.trim(),
    p_notes: input.notes.trim(),
    p_reference_path: input.referencePath,
    p_selected_addons: input.selectedAddons,
    p_calculation_version: 1,
  });
  if (error) throw error;
  return data as SubmittedStorefrontOrder;
}

export async function getStorefrontOrders(): Promise<StorefrontOrder[]> {
  const { data, error } = await supabase.rpc('kelly_get_storefront_orders_v1');
  if (error) throw error;
  return Array.isArray(data) ? data as StorefrontOrder[] : [];
}

export async function setStorefrontOrderStatus(orderId: string, status: StorefrontOrderStatus, note = ''): Promise<void> {
  const { error } = await supabase.rpc('kelly_set_storefront_order_status_v1', {
    p_order_id: orderId,
    p_status: status,
    p_note: note.trim(),
  });
  if (error) throw error;
}

export function getStoreProductImageUrl(productId: string, imageId: string): string | null {
  if (!productId || !/^[A-Za-z0-9_-]+$/.test(productId)) return null;
  if (!imageId || !/^[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(imageId)) return null;
  return supabase.storage.from(STORE_PUBLIC_ASSETS_BUCKET)
    .getPublicUrl('store-product/' + imageId).data.publicUrl;
}

export async function uploadStoreProductImages(productId: string, files: FileList | File[]): Promise<string[]> {
  if (!productId) throw new Error('Salve o produto antes de enviar fotos.');
  const list = Array.from(files);
  if (!list.length) return [];
  if (list.length > 8) throw new Error('Envie no máximo 8 imagens por vez.');
  const uploaded: string[] = [];
  for (const file of list) {
    const extension = extensionForImage(file);
    if (file.size > 8 * 1024 * 1024) throw new Error('Cada foto pode ter no máximo 8 MB.');
    const imageId = createStorefrontRequestId() + '.' + extension;
    const path = 'store-product/' + imageId;
    const { error } = await supabase.storage.from(STORE_PUBLIC_ASSETS_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    uploaded.push(imageId);
  }
  return uploaded;
}

export async function uploadStorefrontReference(orderId: string, path: string, file: File): Promise<void> {
  if (!path.startsWith(orderId + '/')) throw new Error('Arquivo de referência inválido.');
  const extension = extensionForImage(file);
  if (file.size > MAX_STORE_REFERENCE_SIZE) throw new Error('A imagem de referência pode ter no máximo 10 MB.');
  if (!path.toLowerCase().endsWith('.' + extension)) throw new Error('O formato da imagem não corresponde ao arquivo enviado.');
  const { error } = await supabase.storage.from(STORE_PRIVATE_REFERENCES_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
}

export async function getStorefrontReferenceUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(STORE_PRIVATE_REFERENCES_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
