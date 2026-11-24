import { AppBackupData, AppSettings, CalculationRecord, ProductService } from '../types';

const STORAGE_KEYS = {
  PRODUCTS: 'kelly_calc_products_v4',
  CALCULATIONS: 'kelly_calc_history_v4',
  SETTINGS: 'kelly_calc_settings_v4',
};

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

  // Backup e Restauração de Dados
  generateBackupData(): AppBackupData {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      products: this.getProducts(),
      calculations: this.getCalculations(),
      settings: this.getSettings(),
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
    this.saveSettings(DEFAULT_SETTINGS);
    this.saveAllProducts([]);
  },
};
