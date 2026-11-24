import { AppBackupData, AppSettings, CalculationRecord, ChatConversation, Customer, CustomerQuote, ProductService, QuoteTag, ServiceOrder } from '../types';
import { storeRepository } from './storeRepository';

const STORAGE_KEYS = {
  PRODUCTS: 'kelly_calc_products_v4',
  CALCULATIONS: 'kelly_calc_history_v4',
  SETTINGS: 'kelly_calc_settings_v4',
  CHAT_CONVERSATIONS: 'kelly_chat_conversations_v1',
  SERVICE_ORDERS: 'kelly_service_orders_v1',
  CUSTOMERS: 'kelly_customers_v1',
  QUOTES: 'kelly_quotes_v1',
  QUOTE_TAGS: 'kelly_quote_tags_v1',
};

export const DEFAULT_QUOTE_TAGS: QuoteTag[] = [
  { id: 'tag-art-inclusa', name: 'Arte inclusa', color: '#db2777', custom: false },
  { id: 'tag-art-aprovada', name: 'Arte aprovada', color: '#16a34a', custom: false },
  { id: 'tag-aguardando', name: 'Aguardando aprovação', color: '#f59e0b', custom: false },
  { id: 'tag-personalizado', name: 'Personalizado', color: '#7c3aed', custom: false },
  { id: 'tag-entrega', name: 'Entrega', color: '#2563eb', custom: false },
  { id: 'tag-retirada', name: 'Retirada', color: '#0891b2', custom: false },
  { id: 'tag-urgente', name: 'Urgente', color: '#dc2626', custom: false },
  { id: 'tag-em-producao', name: 'Em produção', color: '#ea580c', custom: false },
];

export const DEFAULT_SETTINGS: AppSettings = {
  shopName: 'Kelly Personalizados',
  ownerName: 'Kelly',
  defaultHourlyRate: 20.0, // R$ 20,00/h de mão de obra técnica
  defaultWastePercentage: 5.0, // 5% de margem de segurança
  defaultMarginPercentage: 40.0, // 40% de margem de lucro líquido
  defaultMarkupPercentage: 70.0, // 70% de markup sobre custos
  defaultInkCostPerSheet: 0.15, // R$ 0,15 por folha (Epson EcoTank original)
  currencySymbol: 'R$',
};

export const INITIAL_PRODUCTS: ProductService[] = [];

export const storageService = {
  // Configurações
  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) {
        this.saveSettings(DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
      }
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Falha ao salvar configurações:', e);
    }
  },

  // Produtos e Serviços Reais
  getProducts(): ProductService[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (!data) {
        return [];
      }
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveAllProducts(products: ProductService[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    } catch (e) {
      console.error('Falha ao salvar produtos:', e);
    }
  },

  saveProduct(product: ProductService): ProductService[] {
    const products = this.getProducts();
    const existingIndex = products.findIndex((p) => p.id === product.id);
    const now = new Date().toISOString();

    let updatedList: ProductService[];
    if (existingIndex >= 0) {
      updatedList = [...products];
      updatedList[existingIndex] = {
        ...product,
        updatedAt: now,
      };
    } else {
      updatedList = [
        {
          ...product,
          id: product.id || `prod-${Date.now()}`,
          createdAt: now,
          updatedAt: now,
        },
        ...products,
      ];
    }

    this.saveAllProducts(updatedList);
    return updatedList;
  },

  deleteProduct(id: string): ProductService[] {
    const products = this.getProducts();
    const updated = products.filter((p) => p.id !== id);
    this.saveAllProducts(updated);
    return updated;
  },

  duplicateProduct(id: string): ProductService | null {
    const products = this.getProducts();
    const target = products.find((p) => p.id === id);
    if (!target) return null;

    const copy: ProductService = {
      ...JSON.parse(JSON.stringify(target)),
      id: `prod-${Date.now()}`,
      name: `${target.name} (Cópia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveProduct(copy);
    return copy;
  },

  // Histórico de Cálculos Reais
  getCalculations(): CalculationRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CALCULATIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveCalculation(record: Omit<CalculationRecord, 'id' | 'date'> & { id?: string; date?: string }): CalculationRecord[] {
    const records = this.getCalculations();
    const newRecord: CalculationRecord = {
      ...record,
      id: record.id || `calc-${Date.now()}`,
      date: record.date || new Date().toISOString(),
    };

    const updated = [newRecord, ...records];
    try {
      localStorage.setItem(STORAGE_KEYS.CALCULATIONS, JSON.stringify(updated));
    } catch (e) {
      console.error('Falha ao salvar cálculo no histórico:', e);
    }
    return updated;
  },

  deleteCalculation(id: string): CalculationRecord[] {
    const records = this.getCalculations();
    const updated = records.filter((r) => r.id !== id);
    try {
      localStorage.setItem(STORAGE_KEYS.CALCULATIONS, JSON.stringify(updated));
    } catch (e) {
      console.error('Falha ao excluir histórico:', e);
    }
    return updated;
  },

  // Conversas do Assistente IA
  getChatConversations(): ChatConversation[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CHAT_CONVERSATIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveChatConversations(conversations: ChatConversation[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CHAT_CONVERSATIONS, JSON.stringify(conversations));
    } catch (e) {
      console.error('Falha ao salvar conversas:', e);
    }
  },

  deleteChatConversation(id: string): ChatConversation[] {
    const updated = this.getChatConversations().filter((conversation) => conversation.id !== id);
    this.saveChatConversations(updated);
    return updated;
  },

  // Ordens de Serviço
  getServiceOrders(): ServiceOrder[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SERVICE_ORDERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveServiceOrder(order: ServiceOrder): ServiceOrder[] {
    const updated = [order, ...this.getServiceOrders()];
    try {
      localStorage.setItem(STORAGE_KEYS.SERVICE_ORDERS, JSON.stringify(updated));
    } catch (e) {
      console.error('Falha ao salvar ordem de serviço:', e);
    }
    return updated;
  },

  deleteServiceOrder(id: string): ServiceOrder[] {
    const updated = this.getServiceOrders().filter((order) => order.id !== id);
    try {
      localStorage.setItem(STORAGE_KEYS.SERVICE_ORDERS, JSON.stringify(updated));
    } catch (e) {
      console.error('Falha ao excluir ordem de serviço:', e);
    }
    return updated;
  },

  // Clientes
  getCustomers(): Customer[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveCustomer(customer: Customer): Customer[] {
    const customers = this.getCustomers();
    const existingIndex = customers.findIndex((item) => item.id === customer.id);
    const now = new Date().toISOString();
    const updated = existingIndex >= 0
      ? customers.map((item) => item.id === customer.id ? { ...customer, updatedAt: now } : item)
      : [{ ...customer, id: customer.id || `client-${Date.now()}`, createdAt: now, updatedAt: now }, ...customers];
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updated));
    return updated;
  },

  deleteCustomer(id: string): Customer[] {
    const updated = this.getCustomers().filter((customer) => customer.id !== id);
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updated));
    return updated;
  },

  // Orçamentos
  getQuotes(): CustomerQuote[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUOTES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveQuote(quote: CustomerQuote): CustomerQuote[] {
    const quotes = this.getQuotes();
    const existingIndex = quotes.findIndex((item) => item.id === quote.id);
    const now = new Date().toISOString();
    const updated = existingIndex >= 0
      ? quotes.map((item) => item.id === quote.id ? { ...quote, updatedAt: now } : item)
      : [{ ...quote, id: quote.id || `quote-${Date.now()}`, createdAt: now, updatedAt: now }, ...quotes];
    localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(updated));
    return updated;
  },

  deleteQuote(id: string): CustomerQuote[] {
    const updated = this.getQuotes().filter((quote) => quote.id !== id);
    localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(updated));
    return updated;
  },

  // Etiquetas de orçamentos
  getQuoteTags(): QuoteTag[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUOTE_TAGS);
      if (!data) {
        this.saveQuoteTags(DEFAULT_QUOTE_TAGS);
        return DEFAULT_QUOTE_TAGS;
      }
      const saved = JSON.parse(data) as QuoteTag[];
      const merged = [...DEFAULT_QUOTE_TAGS];
      saved.forEach((tag) => {
        if (!merged.some((item) => item.id === tag.id)) merged.push(tag);
      });
      return merged;
    } catch {
      return DEFAULT_QUOTE_TAGS;
    }
  },

  saveQuoteTags(tags: QuoteTag[]): void {
    localStorage.setItem(STORAGE_KEYS.QUOTE_TAGS, JSON.stringify(tags));
  },

  // Backup e Restauração de Dados
  generateBackupData(): AppBackupData {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      products: this.getProducts(),
      calculations: this.getCalculations(),
      settings: this.getSettings(),
      conversations: this.getChatConversations(),
      serviceOrders: this.getServiceOrders(),
      customers: this.getCustomers(),
      quotes: this.getQuotes(),
      quoteTags: this.getQuoteTags(),
      storeProducts: storeRepository.getProducts(),
      storeCategories: storeRepository.getCategories(),
      futureOrders: storeRepository.getFutureOrders(),
    };
  },

  downloadBackupFile(): void {
    const backupData = this.generateBackupData();
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];

    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-kelly-personalizados-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  restoreBackup(jsonString: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonString) as AppBackupData;

      if (!data || !data.version || !Array.isArray(data.products)) {
        return {
          success: false,
          message: 'Arquivo de backup inválido ou incompatível com o formato esperado.',
        };
      }

      this.saveAllProducts(data.products);

      if (Array.isArray(data.calculations)) {
        localStorage.setItem(STORAGE_KEYS.CALCULATIONS, JSON.stringify(data.calculations));
      }

      if (data.settings) {
        this.saveSettings(data.settings);
      }

      if (Array.isArray(data.conversations)) {
        this.saveChatConversations(data.conversations);
      }

      if (Array.isArray(data.serviceOrders)) {
        localStorage.setItem(STORAGE_KEYS.SERVICE_ORDERS, JSON.stringify(data.serviceOrders));
      }

      if (Array.isArray(data.customers)) {
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(data.customers));
      }

      if (Array.isArray(data.quotes)) {
        localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(data.quotes));
      }

      if (Array.isArray(data.quoteTags)) {
        this.saveQuoteTags(data.quoteTags);
      }

      storeRepository.restoreBackup({
        products: data.storeProducts,
        categories: data.storeCategories,
        futureOrders: data.futureOrders,
      });

      return {
        success: true,
        message: `Backup restaurado com sucesso! ${data.products.length} produtos carregados.`,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao processar o arquivo JSON. Certifique-se de selecionar um backup válido.',
      };
    }
  },

  resetAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.CALCULATIONS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.CHAT_CONVERSATIONS);
    localStorage.removeItem(STORAGE_KEYS.SERVICE_ORDERS);
    localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
    localStorage.removeItem(STORAGE_KEYS.QUOTES);
    localStorage.removeItem(STORAGE_KEYS.QUOTE_TAGS);
    localStorage.removeItem('kelly_store_products_v1');
    localStorage.removeItem('kelly_store_categories_v1');
    localStorage.removeItem('kelly_future_orders_v1');
    localStorage.removeItem('kelly_store_change_history_v1');
    this.saveSettings(DEFAULT_SETTINGS);
    this.saveAllProducts([]);
  },
};
