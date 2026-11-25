import { supabase } from './supabase';

export const STORE_PUBLIC_ASSETS_BUCKET = 'kelly_public_store_assets_v1';
export const STORE_PRIVATE_REFERENCES_BUCKET = 'kelly_private_store_references_v1';
export const CUSTOM_QUOTE_ASSETS_BUCKET = 'kelly_private_quote_assets_v1';
export const MAX_STORE_REFERENCE_SIZE = 10 * 1024 * 1024;

export type CustomQuoteStatus =
  | 'novo_orcamento'
  | 'em_analise'
  | 'aguardando_informacoes'
  | 'orcamento_enviado'
  | 'aprovado'
  | 'recusado'
  | 'convertido_em_pedido'
  | 'cancelado';

export interface CustomQuoteHistoryEntry {
  previousStatus: CustomQuoteStatus | null;
  newStatus: CustomQuoteStatus;
  note: string;
  createdAt: string;
  actorUserId?: string | null;
  orderId?: string;
  archived?: boolean;
}

export interface CustomQuoteRequest {
  id: string;
  quoteNumber: string;
  customerName: string;
  customerWhatsapp: string;
  productId: string | null;
  productName: string;
  quantity: number;
  idea: string;
  material: string;
  dimensions: string;
  colors: string;
  personalizations: string;
  desiredDeadline: string | null;
  referencePath: string | null;
  additionalNotes: string;
  status: CustomQuoteStatus;
  quoteAmount: number | null;
  internalNotes: string;
  statusHistory: CustomQuoteHistoryEntry[];
  convertedOrderId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitCustomQuoteInput {
  id: string;
  customerName: string;
  customerWhatsapp: string;
  productId: string | null;
  productName: string;
  quantity: number;
  idea: string;
  material: string;
  dimensions: string;
  colors: string;
  personalizations: string;
  desiredDeadline: string | null;
  additionalNotes: string;
}

export interface SubmittedCustomQuote {
  id: string;
  quoteNumber: string;
  status: CustomQuoteStatus;
  createdAt: string;
}

export interface UpdateCustomQuoteInput {
  id: string;
  productName: string;
  quantity: number;
  idea: string;
  material: string;
  dimensions: string;
  colors: string;
  personalizations: string;
  desiredDeadline: string | null;
  additionalNotes: string;
  status: CustomQuoteStatus;
  quoteAmount: number | null;
  internalNotes: string;
  historyNote: string;
}

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

function normalizeCustomQuoteRequest(raw: Record<string, unknown>): CustomQuoteRequest {
  const read = (camel: string, snake: string) => raw[camel] ?? raw[snake];
  const rawHistory = read('statusHistory', 'status_history');
  const statusHistory = Array.isArray(rawHistory) ? rawHistory.map((entry) => {
    const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    return {
      previousStatus: (item.previousStatus ?? item.previous_status ?? null) as CustomQuoteStatus | null,
      newStatus: (item.newStatus ?? item.new_status ?? 'novo_orcamento') as CustomQuoteStatus,
      note: String(item.note ?? ''),
      createdAt: String(item.createdAt ?? item.created_at ?? ''),
      actorUserId: (item.actorUserId ?? item.actor_user_id ?? null) as string | null,
      orderId: item.orderId == null ? undefined : String(item.orderId),
      archived: item.archived === true,
    };
  }) : [];
  const amount = read('quoteAmount', 'quote_amount');

  return {
    id: String(raw.id ?? ''),
    quoteNumber: String(read('quoteNumber', 'quote_number') ?? ''),
    customerName: String(read('customerName', 'customer_name') ?? ''),
    customerWhatsapp: String(read('customerWhatsapp', 'customer_whatsapp') ?? ''),
    productId: read('productId', 'product_id') == null ? null : String(read('productId', 'product_id')),
    productName: String(read('productName', 'product_name') ?? ''),
    quantity: Number(raw.quantity ?? 0),
    idea: String(raw.idea ?? ''),
    material: String(raw.material ?? ''),
    dimensions: String(raw.dimensions ?? ''),
    colors: String(raw.colors ?? ''),
    personalizations: String(raw.personalizations ?? ''),
    desiredDeadline: read('desiredDeadline', 'desired_deadline') == null ? null : String(read('desiredDeadline', 'desired_deadline')),
    referencePath: read('referencePath', 'reference_path') == null ? null : String(read('referencePath', 'reference_path')),
    additionalNotes: String(read('additionalNotes', 'additional_notes') ?? ''),
    status: (raw.status ?? 'novo_orcamento') as CustomQuoteStatus,
    quoteAmount: amount == null ? null : Number(amount),
    internalNotes: String(read('internalNotes', 'internal_notes') ?? ''),
    statusHistory,
    convertedOrderId: read('convertedOrderId', 'converted_order_id') == null ? null : String(read('convertedOrderId', 'converted_order_id')),
    archivedAt: read('archivedAt', 'archived_at') == null ? null : String(read('archivedAt', 'archived_at')),
    createdAt: String(read('createdAt', 'created_at') ?? ''),
    updatedAt: String(read('updatedAt', 'updated_at') ?? ''),
  };
}

export async function submitCustomQuoteRequest(input: SubmitCustomQuoteInput): Promise<SubmittedCustomQuote> {
  const { data, error } = await supabase.rpc('kelly_submit_custom_quote_request_v1', {
    p_request_id: input.id,
    p_customer_name: input.customerName.trim(),
    p_customer_whatsapp: input.customerWhatsapp.replace(/\D/g, ''),
    p_product_id: input.productId,
    p_product_name: input.productName.trim(),
    p_quantity: input.quantity,
    p_idea: input.idea.trim(),
    p_material: input.material.trim(),
    p_dimensions: input.dimensions.trim(),
    p_colors: input.colors.trim(),
    p_personalizations: input.personalizations.trim(),
    p_desired_deadline: input.desiredDeadline || null,
    p_additional_notes: input.additionalNotes.trim(),
  });
  if (error) throw error;
  const result = data as Record<string, unknown>;
  return {
    id: String(result.id ?? input.id),
    quoteNumber: String(result.quoteNumber ?? result.quote_number ?? ''),
    status: (result.status ?? 'novo_orcamento') as CustomQuoteStatus,
    createdAt: String(result.createdAt ?? result.created_at ?? ''),
  };
}

export async function uploadCustomQuoteReference(quoteId: string, file: File): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(quoteId)) throw new Error('Identificador da solicitação inválido.');
  const extension = extensionForImage(file);
  if (file.size > MAX_STORE_REFERENCE_SIZE) throw new Error('A imagem de referência pode ter no máximo 10 MB.');
  const path = `quote/${quoteId}/${createStorefrontRequestId()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(CUSTOM_QUOTE_ASSETS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { error } = await supabase.rpc('kelly_set_custom_quote_reference_v1', {
    p_quote_id: quoteId,
    p_path: path,
  });
  if (error) throw error;
  return path;
}

export async function getCustomQuoteRequests(includeArchived = false): Promise<CustomQuoteRequest[]> {
  const { data, error } = await supabase.rpc('kelly_get_custom_quote_requests_v1', { p_include_archived: includeArchived });
  if (error) throw error;
  return Array.isArray(data) ? data.map((row) => normalizeCustomQuoteRequest(row as Record<string, unknown>)) : [];
}

export async function updateCustomQuoteRequest(input: UpdateCustomQuoteInput): Promise<CustomQuoteRequest> {
  const { data, error } = await supabase.rpc('kelly_update_custom_quote_request_v1', {
    p_quote_id: input.id,
    p_product_name: input.productName.trim(),
    p_quantity: input.quantity,
    p_idea: input.idea.trim(),
    p_material: input.material.trim(),
    p_dimensions: input.dimensions.trim(),
    p_colors: input.colors.trim(),
    p_personalizations: input.personalizations.trim(),
    p_desired_deadline: input.desiredDeadline || null,
    p_additional_notes: input.additionalNotes.trim(),
    p_status: input.status,
    p_quote_amount: input.quoteAmount,
    p_internal_notes: input.internalNotes.trim(),
    p_history_note: input.historyNote.trim(),
  });
  if (error) throw error;
  return normalizeCustomQuoteRequest(data as Record<string, unknown>);
}

export async function archiveCustomQuoteRequest(quoteId: string): Promise<CustomQuoteRequest> {
  const { data, error } = await supabase.rpc('kelly_archive_custom_quote_request_v1', { p_quote_id: quoteId });
  if (error) throw error;
  return normalizeCustomQuoteRequest(data as Record<string, unknown>);
}

export interface ConvertedCustomQuote {
  quoteId: string;
  orderId: string;
  orderNumber?: string;
  alreadyConverted: boolean;
}

export async function convertCustomQuoteRequest(quoteId: string): Promise<ConvertedCustomQuote> {
  const { data, error } = await supabase.rpc('kelly_convert_custom_quote_request_v1', { p_quote_id: quoteId });
  if (error) throw error;
  const result = data as Record<string, unknown>;
  return {
    quoteId: String(result.quoteId ?? result.quote_id ?? quoteId),
    orderId: String(result.orderId ?? result.order_id ?? ''),
    orderNumber: result.orderNumber == null && result.order_number == null ? undefined : String(result.orderNumber ?? result.order_number),
    alreadyConverted: result.alreadyConverted === true || result.already_converted === true,
  };
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
  const bucket = path.startsWith('quote/') ? CUSTOM_QUOTE_ASSETS_BUCKET : STORE_PRIVATE_REFERENCES_BUCKET;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
