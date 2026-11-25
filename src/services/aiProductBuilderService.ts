import { supabase } from './supabase';
import { getSupabaseFunctionErrorMessage } from './supabaseFunctionErrors';
import { AiProductDraft, AiProductModel, AppSettings } from '../types';

const FUNCTION_NAME = 'ai-product-builder';

export type AiProductPricingContext = Pick<AppSettings,
  'defaultHourlyRate' | 'defaultWastePercentage' | 'defaultMarginPercentage' | 'defaultMarkupPercentage' | 'defaultInkCostPerSheet'
>;

export interface AiProductBuilderStatus {
  configured: boolean;
  modelName: AiProductModel;
}

async function invokeBuilder<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body });
  if (error) throw new Error(await getSupabaseFunctionErrorMessage(error, FUNCTION_NAME));
  if (!data || typeof data !== 'object') throw new Error('O Supabase não retornou os dados esperados.');
  if ('error' in data && typeof data.error === 'string') throw new Error(data.error);
  return data as T;
}

export async function getAiProductBuilderStatus(): Promise<AiProductBuilderStatus> {
  return invokeBuilder<AiProductBuilderStatus>({ action: 'status' });
}

export async function saveAiProductBuilderKey(apiKey: string, modelName: AiProductModel): Promise<AiProductBuilderStatus> {
  return invokeBuilder<AiProductBuilderStatus>({ action: 'save_key', apiKey, modelName });
}

export async function generateAiProductDraft(
  description: string,
  categories: string[],
  pricingContext: AiProductPricingContext,
): Promise<AiProductDraft> {
  const result = await invokeBuilder<{ product: AiProductDraft }>({ action: 'generate', description, categories, pricingContext });
  const product = result.product;
  const requiredTexts = product && [product.name, product.description, product.category, product.productType,
    product.technicalSpecs, product.dimensions, product.saleUnit, product.additionalInfo, product.suggestionNotes];
  const requiredLists = product && [product.materials, product.personalizationOptions, product.keywords];
  const requiredNumbers = product && [product.salePrice, product.productionCost, product.materialCost,
    product.laborCost, product.otherCosts, product.marginPercent, product.estimatedProductionMinutes];
  if (!product || !requiredTexts?.every((value) => typeof value === 'string' && value.trim()) ||
    !requiredLists?.every((value) => Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim())) ||
    !requiredNumbers?.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0) ||
    !Array.isArray(product.aiSuggestedFields)) {
    throw new Error('A função de IA publicada está desatualizada ou retornou campos incompletos. Publique a versão mais recente e gere novamente.');
  }
  return product;
}
