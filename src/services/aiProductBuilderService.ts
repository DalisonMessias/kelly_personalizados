import { supabase } from './supabase';
import { getSupabaseFunctionErrorMessage } from './supabaseFunctionErrors';
import { AiProductDraft, AiProductModel } from '../types';

const FUNCTION_NAME = 'ai-product-builder';

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

export async function generateAiProductDraft(description: string, categories: string[]): Promise<AiProductDraft> {
  const result = await invokeBuilder<{ product: AiProductDraft }>({ action: 'generate', description, categories });
  if (!result.product || typeof result.product.name !== 'string') {
    throw new Error('A IA não retornou um cadastro editável. Gere novamente.');
  }
  return result.product;
}
