import {
  FutureOrder,
  PersonalizationOption,
  StoreCategory,
  StoreProduct,
  StoreProductAddon,
} from '../types';

const KEYS = {
  PRODUCTS: 'kelly_store_products_v1',
  CATEGORIES: 'kelly_store_categories_v1',
  FUTURE_ORDERS: 'kelly_future_orders_v1',
  CHANGE_HISTORY: 'kelly_store_change_history_v1',
};

interface ChangeRecord {
  id: string;
  entity: 'product' | 'category' | 'personalization' | 'addon' | 'future_order';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'duplicate';
  createdAt: string;
  snapshot: unknown;
}

function readArray<T>(key: string): T[] {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function recordChange(entity: ChangeRecord['entity'], entityId: string, action: ChangeRecord['action'], snapshot: unknown) {
  const history = readArray<ChangeRecord>(KEYS.CHANGE_HISTORY);
  history.unshift({
    id: uniqueId('change'),
    entity,
    entityId,
    action,
    createdAt: new Date().toISOString(),
    snapshot,
  });
  writeArray(KEYS.CHANGE_HISTORY, history.slice(0, 500));
}

export const storeRepository = {
  getProducts(): StoreProduct[] {
    return readArray<StoreProduct>(KEYS.PRODUCTS);
  },

  saveProduct(product: StoreProduct): StoreProduct[] {
    const products = this.getProducts();
    const existing = products.some((item) => item.id === product.id);
    const now = new Date().toISOString();
    const normalized: StoreProduct = {
      ...product,
      minimumQuantity: Math.max(1, Number(product.minimumQuantity) || 1),
      salePrice: Math.max(0, Number(product.salePrice) || 0),
      marginPercent: Math.max(0, Number(product.marginPercent) || 0),
      productionCost: Math.max(0, Number(product.productionCost) || 0),
      laborCost: Math.max(0, Number(product.laborCost) || 0),
      materialCost: Math.max(0, Number(product.materialCost) || 0),
      otherCosts: Math.max(0, Number(product.otherCosts) || 0),
      estimatedProductionTime: Math.max(0, Number(product.estimatedProductionTime) || 0),
      updatedAt: now,
    };
    const updated = existing
      ? products.map((item) => item.id === normalized.id ? normalized : item)
      : [{ ...normalized, id: normalized.id || uniqueId('store-product'), createdAt: now }, ...products];
    writeArray(KEYS.PRODUCTS, updated);
    recordChange('product', normalized.id, existing ? 'update' : 'create', normalized);
    return updated;
  },

  deleteProduct(id: string): StoreProduct[] {
    const products = this.getProducts();
    const target = products.find((item) => item.id === id);
    const updated = products.filter((item) => item.id !== id);
    writeArray(KEYS.PRODUCTS, updated);
    recordChange('product', id, 'delete', target);
    return updated;
  },

  duplicateProduct(id: string): StoreProduct | null {
    const product = this.getProducts().find((item) => item.id === id);
    if (!product) return null;

    const now = new Date().toISOString();
    const copy: StoreProduct = {
      ...JSON.parse(JSON.stringify(product)),
      id: uniqueId('store-product'),
      name: `${product.name} (Cópia)`,
      status: 'inativo',
      showInFutureStore: false,
      createdAt: now,
      updatedAt: now,
      personalizationOptions: product.personalizationOptions.map((option) => ({ ...option, id: uniqueId('personalization') })),
      addons: product.addons.map((addon) => ({ ...addon, id: uniqueId('addon') })),
    };
    this.saveProduct(copy);
    recordChange('product', copy.id, 'duplicate', copy);
    return copy;
  },

  getCategories(): StoreCategory[] {
    return readArray<StoreCategory>(KEYS.CATEGORIES);
  },

  saveCategory(category: StoreCategory): StoreCategory[] {
    const categories = this.getCategories();
    const existing = categories.some((item) => item.id === category.id);
    const now = new Date().toISOString();
    const normalized = { ...category, updatedAt: now };
    const updated = existing
      ? categories.map((item) => item.id === normalized.id ? normalized : item)
      : [{ ...normalized, id: normalized.id || uniqueId('category'), createdAt: now }, ...categories];
    writeArray(KEYS.CATEGORIES, updated);
    recordChange('category', normalized.id, existing ? 'update' : 'create', normalized);
    return updated;
  },

  deleteCategory(id: string): StoreCategory[] {
    const updated = this.getCategories().filter((item) => item.id !== id);
    writeArray(KEYS.CATEGORIES, updated);
    recordChange('category', id, 'delete', { id });
    return updated;
  },

  getFutureOrders(): FutureOrder[] {
    return readArray<FutureOrder>(KEYS.FUTURE_ORDERS);
  },

  saveFutureOrder(order: FutureOrder): FutureOrder[] {
    const orders = this.getFutureOrders();
    const existing = orders.some((item) => item.id === order.id);
    const now = new Date().toISOString();
    const normalized = { ...order, updatedAt: now };
    const updated = existing
      ? orders.map((item) => item.id === normalized.id ? normalized : item)
      : [{ ...normalized, id: normalized.id || uniqueId('future-order'), createdAt: now }, ...orders];
    writeArray(KEYS.FUTURE_ORDERS, updated);
    recordChange('future_order', normalized.id, existing ? 'update' : 'create', normalized);
    return updated;
  },

  getChangeHistory(): ChangeRecord[] {
    return readArray<ChangeRecord>(KEYS.CHANGE_HISTORY);
  },

  createPersonalizationOption(): PersonalizationOption {
    return {
      id: uniqueId('personalization'),
      name: '',
      type: 'texto',
      required: false,
      values: [],
      priceAdjustment: 0,
      active: true,
    };
  },

  createAddon(): StoreProductAddon {
    return {
      id: uniqueId('addon'),
      name: '',
      description: '',
      price: 0,
      active: true,
    };
  },

  getBackupData() {
    return {
      products: this.getProducts(),
      categories: this.getCategories(),
      futureOrders: this.getFutureOrders(),
      changeHistory: this.getChangeHistory(),
    };
  },

  restoreBackup(data: { products?: StoreProduct[]; categories?: StoreCategory[]; futureOrders?: FutureOrder[] }): void {
    if (Array.isArray(data.products)) writeArray(KEYS.PRODUCTS, data.products);
    if (Array.isArray(data.categories)) writeArray(KEYS.CATEGORIES, data.categories);
    if (Array.isArray(data.futureOrders)) writeArray(KEYS.FUTURE_ORDERS, data.futureOrders);
  },
};
