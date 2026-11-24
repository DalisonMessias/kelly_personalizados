import {
  ArtCostConfig,
  CalculationResult,
  InkCostConfig,
  LaborCostConfig,
  MaterialItem,
  OtherCostsConfig,
  PricingConfig,
  QuantityTier,
  SimpleMaterial,
  WasteConfig,
} from '../types';

/**
 * Formata um valor numérico para a moeda brasileira (R$ 0,00)
 */
export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata um valor numérico para percentual (0,0%)
 */
export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0,0%';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

/**
 * Calcula o custo unitário proporcional de um item de material
 * Ex: Se 50 folhas custaram R$ 48,00 e usei 2 folhas => (48 / 50) * 2 = R$ 1,92
 */
export function calculateMaterialCost(item: Omit<MaterialItem, 'calculatedCost' | 'id'>): number {
  if (item.purchaseQuantity <= 0 || item.purchasePrice < 0 || item.usedQuantity <= 0) {
    return 0;
  }
  const unitCost = item.purchasePrice / item.purchaseQuantity;
  return Number((unitCost * item.usedQuantity).toFixed(4));
}

/**
 * Calcula o custo de tinta
 */
export function calculateInkCost(config: InkCostConfig): number {
  if (config.mode === 'per_sheet') {
    const sheets = Math.max(0, config.sheetCount);
    const costPerSheet = Math.max(0, config.costPerSheet);
    return Number((sheets * costPerSheet).toFixed(4));
  } else {
    return Number(Math.max(0, config.costPerJob).toFixed(4));
  }
}

/**
 * Calcula o custo da arte
 * Integral: cobra o valor total da criação
 * Rateado: divide o valor da arte pela quantidade de folhas ou peças do pedido
 */
export function calculateArtCost(config: ArtCostConfig): number {
  const totalArt = Math.max(0, config.totalArtPrice);
  if (config.mode === 'full') {
    return Number(totalArt.toFixed(4));
  } else {
    const count = Math.max(1, config.sheetsCount);
    return Number((totalArt / count).toFixed(4));
  }
}

/**
 * Calcula o custo da mão de obra com base nas horas ou minutos gastos
 */
export function calculateLaborCost(config: LaborCostConfig): number {
  const hourlyRate = Math.max(0, config.hourlyRate);
  const time = Math.max(0, config.timeSpent);

  const hours = config.timeUnit === 'minutes' ? time / 60 : time;
  return Number((hours * hourlyRate).toFixed(4));
}

/**
 * Calcula outros custos combinados
 */
export function calculateOtherCosts(config: OtherCostsConfig): number {
  const packaging = Math.max(0, config.packaging);
  const electricity = Math.max(0, config.electricity);
  const printing = Math.max(0, config.printing);
  const finishing = Math.max(0, config.finishing);

  const customTotal = (config.customExpenses || []).reduce((acc, curr) => {
    return acc + Math.max(0, curr.amount || 0);
  }, 0);

  return Number((packaging + electricity + printing + finishing + customTotal).toFixed(4));
}

/**
 * Realiza o cálculo completo e transparente de custos e precificação com desconto percentual opcional
 * 
 * Regra do Desconto:
 * - O desconto percentual é opcional (0% se vazio).
 * - É aplicado exclusivamente sobre o preço de venda, nunca sobre o custo.
 * - Recalcula o preço final, o valor descontado em R$ e o lucro líquido restante.
 */
export function calculateCompleteService(
  materials: MaterialItem[],
  simpleMaterials: SimpleMaterial[],
  ink: InkCostConfig,
  art: ArtCostConfig,
  labor: LaborCostConfig,
  otherCosts: OtherCostsConfig,
  waste: WasteConfig,
  pricing: PricingConfig,
  sheetCount: number = 1
): CalculationResult {
  const totalSheets = Math.max(1, sheetCount);

  // 1. Materiais proporcional (sistema avançado)
  const advancedMaterialsCost = materials.reduce((acc, item) => {
    const cost = typeof item.calculatedCost === 'number' && !isNaN(item.calculatedCost)
      ? item.calculatedCost
      : (calculateMaterialCost(item) || 0);
    return acc + Math.max(0, cost);
  }, 0);

  // 1b. Materiais simples (nome + custo direto)
  const simpleMaterialsCost = (simpleMaterials || []).reduce((acc, item) => {
    return acc + Math.max(0, item.cost || 0);
  }, 0);

  const materialsCost = advancedMaterialsCost + simpleMaterialsCost;

  // 2. Tinta
  const inkCost = calculateInkCost(ink);

  // 3. Arte
  const artCost = calculateArtCost(art);

  // 4. Mão de Obra
  const laborCost = calculateLaborCost(labor);

  // 5. Outros Custos
  const otherTotalCost = calculateOtherCosts(otherCosts);

  // 6. Subtotal antes de perdas
  const subtotalCost = materialsCost + inkCost + artCost + laborCost + otherTotalCost;

  // 7. Custo de Perdas (Desperdício)
  const wastePercentage = Math.max(0, waste.percentage);
  const wasteCost = subtotalCost * (wastePercentage / 100);

  // 8. Custo Total do Serviço
  const totalServiceCost = subtotalCost + wasteCost;
  const unitCost = totalServiceCost / totalSheets;

  // 9. Preço Original de Venda (antes do desconto opcional)
  let originalSalePrice = 0;
  const targetMargin = Math.max(0, Math.min(99.9, pricing.targetMargin || 0));
  const targetMarkup = Math.max(0, pricing.targetMarkup || 0);

  if (pricing.method === 'margin') {
    // Margem de Lucro sobre a Venda: Preço Original = Custo / (1 - Margem)
    if (targetMargin >= 100) {
      originalSalePrice = totalServiceCost * 2;
    } else {
      originalSalePrice = totalServiceCost / (1 - targetMargin / 100);
    }
  } else if (pricing.method === 'markup') {
    // Markup sobre o Custo: Preço Original = Custo * (1 + Markup)
    originalSalePrice = totalServiceCost * (1 + targetMarkup / 100);
  } else {
    // Preço Manual
    originalSalePrice = Math.max(0, pricing.manualPrice || totalServiceCost);
  }

  const originalUnitPrice = originalSalePrice / totalSheets;

  // 10. Aplicação do Campo Opcional "Desconto (%)"
  // Se vazio, nulo ou não informado -> 0%
  const rawDiscount = pricing.discountPercent;
  const discountPercent = (rawDiscount !== undefined && rawDiscount !== null && !isNaN(rawDiscount))
    ? Math.max(0, Math.min(100, Number(rawDiscount)))
    : 0;

  // Valor do desconto em R$ aplicado sobre o preço original de venda
  const discountAmount = originalSalePrice * (discountPercent / 100);
  const finalSalePrice = Math.max(0, originalSalePrice - discountAmount);
  const finalUnitPrice = finalSalePrice / totalSheets;

  // 11. Lucro Estimado e Margem Restantes após o Desconto
  const estimatedProfit = finalSalePrice - totalServiceCost;

  let profitMarginPercent = 0;
  if (finalSalePrice > 0) {
    profitMarginPercent = (estimatedProfit / finalSalePrice) * 100;
  }

  let markupPercent = 0;
  if (totalServiceCost > 0) {
    markupPercent = (estimatedProfit / totalServiceCost) * 100;
  }

  return {
    materialsCost: Number(materialsCost.toFixed(2)),
    inkCost: Number(inkCost.toFixed(2)),
    artCost: Number(artCost.toFixed(2)),
    laborCost: Number(laborCost.toFixed(2)),
    otherCosts: Number(otherTotalCost.toFixed(2)),
    subtotalCost: Number(subtotalCost.toFixed(2)),
    wasteCost: Number(wasteCost.toFixed(2)),
    totalServiceCost: Number(totalServiceCost.toFixed(2)),
    totalSheetsOrUnits: totalSheets,
    unitCost: Number(unitCost.toFixed(2)),
    
    // Desconto e Preços
    originalSalePrice: Number(originalSalePrice.toFixed(2)),
    originalUnitPrice: Number(originalUnitPrice.toFixed(2)),
    discountPercent: Number(discountPercent.toFixed(1)),
    discountAmount: Number(discountAmount.toFixed(2)),
    finalSalePrice: Number(finalSalePrice.toFixed(2)),
    finalUnitPrice: Number(finalUnitPrice.toFixed(2)),
    
    // Lucro Restante
    estimatedProfit: Number(estimatedProfit.toFixed(2)),
    profitMarginPercent: Number(profitMarginPercent.toFixed(1)),
    markupPercent: Number(markupPercent.toFixed(1)),
  };
}

/**
 * Calcula faixas de desconto por quantidade a partir de um preço unitário base e custo unitário
 */
export function calculateQuantityTiers(
  baseUnitPrice: number,
  unitCost: number,
  tiers: { id: string; quantity: number; discountPercent?: number; customUnitPrice?: number }[]
): QuantityTier[] {
  return tiers.map((tier) => {
    let unitPrice = baseUnitPrice;
    let discount = 0;

    if (tier.customUnitPrice !== undefined && tier.customUnitPrice > 0) {
      unitPrice = tier.customUnitPrice;
      discount = baseUnitPrice > 0 ? Math.max(0, ((baseUnitPrice - unitPrice) / baseUnitPrice) * 100) : 0;
    } else if (tier.discountPercent !== undefined && tier.discountPercent > 0) {
      discount = tier.discountPercent;
      unitPrice = baseUnitPrice * (1 - discount / 100);
    }

    const totalPrice = unitPrice * tier.quantity;
    const totalCostForTier = unitCost * tier.quantity;
    const estimatedProfit = totalPrice - totalCostForTier;

    return {
      id: tier.id,
      quantity: tier.quantity,
      unitPrice: Number(unitPrice.toFixed(2)),
      totalPrice: Number(totalPrice.toFixed(2)),
      discountPercent: Number(discount.toFixed(1)),
      estimatedProfit: Number(estimatedProfit.toFixed(2)),
    };
  });
}
