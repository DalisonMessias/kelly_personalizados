export type ProductCategory = 
  | 'adesivos' 
  | 'topo_bolo' 
  | 'lembrancinhas' 
  | 'etiquetas' 
  | 'convites' 
  | 'papelaria_festa' 
  | 'outro';

export type MeasurementUnit = 
  | 'folha' 
  | 'unidade' 
  | 'metro' 
  | 'cm' 
  | 'rolo' 
  | 'pacote' 
  | 'g' 
  | 'kg' 
  | 'ml';

export interface MaterialItem {
  id: string;
  name: string;
  unit: MeasurementUnit;
  purchasePrice: number; // Preço pago na compra do pacote (ex: 38.90)
  purchaseQuantity: number; // Quantidade adquirida no pacote (ex: 100 folhas)
  usedQuantity: number; // Quantidade gasta neste serviço (ex: 1 folha)
  calculatedCost: number; // Custo proporcional calculado
}

/** Material simples: apenas nome + custo direto em R$ */
export interface SimpleMaterial {
  id: string;
  name: string;
  cost: number; // Custo direto informado pela artesã (ex: R$ 1,60)
}

export type InkCostMode = 'per_sheet' | 'per_job';

export interface InkCostConfig {
  mode: InkCostMode;
  costPerSheet: number; // Custo estimado de tinta por folha impressa (ex: R$ 0,15)
  costPerJob: number; // Custo fixo por serviço (ex: R$ 1,50)
  sheetCount: number; // Quantidade de folhas impressas
}

export type ArtCostMode = 'full' | 'shared';

export interface ArtCostConfig {
  mode: ArtCostMode;
  totalArtPrice: number; // Valor da criação/adaptação da arte (ex: R$ 15,00)
  sheetsCount: number; // Quantidade de folhas/unidades para divisão do valor
}

export type TimeUnit = 'minutes' | 'hours';

export interface LaborCostConfig {
  hourlyRate: number; // Valor desejado da hora de trabalho (ex: R$ 20,00)
  timeSpent: number; // Tempo gasto (ex: 15)
  timeUnit: TimeUnit; // 'minutes' ou 'hours'
}

export interface CustomExpense {
  id: string;
  name: string;
  amount: number;
}

export interface OtherCostsConfig {
  packaging: number; // Custo de embalagem (saquinho, laço, caixa)
  electricity: number; // Estimativa de energia elétrica
  printing: number; // Impressão terceirizada ou extra
  finishing: number; // Acabamentos especiais (laminação Bopp, ilhós)
  customExpenses: CustomExpense[]; // Outros gastos personalizados adicionais
}

export interface WasteConfig {
  percentage: number; // Percentual de perda ou desperdício (ex: 5%)
}

export type PricingMethod = 'margin' | 'markup' | 'manual';

export interface PricingConfig {
  method: PricingMethod;
  targetMargin: number; // Margem de lucro desejada (% sobre a venda, ex: 40%)
  targetMarkup: number; // Markup desejado (% sobre o custo, ex: 70%)
  manualPrice: number; // Preço informado manualmente
  discountPercent?: number; // Campo opcional de Desconto (%) entre 0 e 100
}

export interface QuantityTier {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discountPercent: number;
  estimatedProfit: number;
}

export interface CalculationResult {
  // Custos de Produção
  materialsCost: number;
  inkCost: number;
  artCost: number;
  laborCost: number;
  otherCosts: number;
  subtotalCost: number;
  wasteCost: number;
  totalServiceCost: number;
  totalSheetsOrUnits: number;
  unitCost: number;

  // Precificação com Desconto Opcional
  originalSalePrice: number; // Preço original antes do desconto (ex: R$ 50,00)
  originalUnitPrice: number; // Preço unitário original
  discountPercent: number; // Percentual de desconto aplicado (0% a 100%, ex: 20%)
  discountAmount: number; // Valor em reais do desconto (ex: R$ 10,00)
  finalSalePrice: number; // Preço final com desconto aplicado (ex: R$ 40,00)
  finalUnitPrice: number; // Preço final por folha/unidade

  // Lucro e Indicadores Restantes
  estimatedProfit: number; // Lucro líquido restante após conceder o desconto
  profitMarginPercent: number; // Margem de lucro real restante sobre a venda final
  markupPercent: number; // Markup real obtido sobre o custo de produção
}

export interface ProductService {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  sheetCount: number; // Quantidade base do serviço (ex: 1 folha, 10 lembrancinhas)
  createdAt: string;
  updatedAt: string;
  simpleMaterials: SimpleMaterial[]; // Lista simplificada: nome + custo direto
  materials: MaterialItem[];
  ink: InkCostConfig;
  art: ArtCostConfig;
  labor: LaborCostConfig;
  otherCosts: OtherCostsConfig;
  waste: WasteConfig;
  pricing: PricingConfig;
  quantityTiers: QuantityTier[];
  calculationResult: CalculationResult;
}

export interface CalculationRecord {
  id: string;
  productId?: string;
  productName: string;
  category: ProductCategory;
  date: string;
  sheetCount: number;
  calculationResult: CalculationResult;
  notes?: string;
  simpleMaterials?: SimpleMaterial[];
  materials?: MaterialItem[];
  ink?: InkCostConfig;
  art?: ArtCostConfig;
  labor?: LaborCostConfig;
  otherCosts?: OtherCostsConfig;
  waste?: WasteConfig;
  pricing?: PricingConfig;
  quantityTiers?: QuantityTier[];
}

export interface AppSettings {
  shopName: string;
  ownerName: string;
  defaultHourlyRate: number;
  defaultWastePercentage: number;
  defaultMarginPercentage: number;
  defaultMarkupPercentage: number;
  defaultInkCostPerSheet: number;
  currencySymbol: string;
}

export interface AppBackupData {
  version: string;
  exportedAt: string;
  products: ProductService[];
  calculations: CalculationRecord[];
  settings: AppSettings;
}
