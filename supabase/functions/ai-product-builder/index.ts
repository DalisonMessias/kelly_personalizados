import { corsHeaders, FunctionError, jsonResponse, requireAdministrator } from '../_shared/admin.ts';

const API_KEY_TABLE = 'api_keys';
const GEMINI_API_KEY_NAME = 'gemini_product_creator_v1';
const GROQ_API_KEY_NAME = 'groq_product_creator_v1';
const DEFAULT_MODEL = 'gemini-3.1-pro';
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_FALLBACK_MAX_ATTEMPTS = 4;
const MIN_FALLBACK_MAX_ATTEMPTS = 2;
const MAX_FALLBACK_MAX_ATTEMPTS = 6;

const MODEL_IDS: Record<string, string> = {
  'gemini-3.1-pro': 'gemini-3.1-pro-preview',
  'gemini-3.0-flash': 'gemini-3-flash-preview',
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'gemini-2.5-flash': 'gemini-2.5-flash',
};

const PRODUCT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Nome comercial claro e natural em português.' },
    description: { type: 'string', description: 'Descrição completa baseada apenas nos dados informados.' },
    category: { type: 'string', description: 'Categoria existente adequada ou nome de nova categoria.' },
    product_type: { type: 'string' },
    materials: { type: 'array', items: { type: 'string' } },
    technical_specs: { type: 'string', description: 'Gramatura, acabamento, alças e demais especificações informadas.' },
    dimensions: { type: 'string', description: 'Dimensões em centímetros. Se não foram informadas, incluir uma recomendação marcada como sugestão da IA.' },
    personalization_options: { type: 'array', items: { type: 'string' } },
    sale_unit: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
    additional_info: { type: 'string' },
    sale_price: { type: 'number', description: 'Preço de venda sugerido em reais, coerente com custos e margem.' },
    production_cost: { type: 'number', description: 'Custo total estimado de produção em reais.' },
    material_cost: { type: 'number', description: 'Custo estimado dos materiais em reais.' },
    labor_cost: { type: 'number', description: 'Custo estimado da mão de obra em reais, considerando o valor-hora informado.' },
    other_costs: { type: 'number', description: 'Estimativa positiva de embalagem, impressão, acabamento e outros custos em reais.' },
    margin_percent: { type: 'number', description: 'Margem sugerida em percentual, considerando o parâmetro do ateliê.' },
    estimated_production_minutes: { type: 'number', description: 'Tempo estimado de produção em minutos.' },
    suggestion_notes: { type: 'string', description: 'Explicação das estimativas e do que o administrador deve confirmar.' },
  },
  required: [
    'name', 'description', 'category', 'product_type', 'materials', 'technical_specs',
    'dimensions', 'personalization_options', 'sale_unit', 'keywords', 'additional_info',
    'sale_price', 'production_cost', 'material_cost', 'labor_cost', 'other_costs', 'margin_percent',
    'estimated_production_minutes', 'suggestion_notes',
  ],
};

const GROQ_PRODUCT_SCHEMA = {
  ...PRODUCT_SCHEMA,
  additionalProperties: false,
};

function response(request: Request, body: unknown, status = 200): Response {
  const result = jsonResponse(body, status);
  const headers = new Headers(result.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
  return new Response(result.body, { status: result.status, headers });
}

function selectedModel(value: unknown): string {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MODEL_IDS, value)
    ? value
    : DEFAULT_MODEL;
}

type AiProvider = 'gemini' | 'groq';

interface StoredAiProviderKey {
  apiKey: string;
  modelName: string;
  fallbackMaxAttempts: number;
}

function normalizeFallbackMaxAttempts(value: unknown): number {
  const parsed = typeof value === 'number' ? Math.floor(value) : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_FALLBACK_MAX_ATTEMPTS;
  return Math.min(MAX_FALLBACK_MAX_ATTEMPTS, Math.max(MIN_FALLBACK_MAX_ATTEMPTS, parsed));
}

async function readStoredKey(
  admin: Awaited<ReturnType<typeof requireAdministrator>>['admin'],
  provider: AiProvider,
): Promise<StoredAiProviderKey | null> {
  const isGemini = provider === 'gemini';
  const { data, error } = await admin.from(API_KEY_TABLE)
    .select('api_key,model_name,provider,ai_fallback_max_attempts')
    .eq('key_name', isGemini ? GEMINI_API_KEY_NAME : GROQ_API_KEY_NAME)
    .eq('provider', isGemini ? 'google_gemini' : 'groq')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new FunctionError(502, 'Não foi possível carregar as configurações de IA em api_keys. Aplique a atualização do esquema e tente novamente.');
  if (!data || typeof data.api_key !== 'string' || !data.api_key.trim()) return null;
  return {
    apiKey: data.api_key.trim(),
    modelName: isGemini ? selectedModel(data.model_name) : (typeof data.model_name === 'string' && data.model_name.trim() ? data.model_name.trim() : DEFAULT_GROQ_MODEL),
    fallbackMaxAttempts: normalizeFallbackMaxAttempts(data.ai_fallback_max_attempts),
  };
}

async function readBuilderConfiguration(admin: Awaited<ReturnType<typeof requireAdministrator>>['admin']) {
  const [gemini, groq] = await Promise.all([
    readStoredKey(admin, 'gemini'),
    readStoredKey(admin, 'groq'),
  ]);
  return {
    gemini,
    groq,
    fallbackMaxAttempts: gemini?.fallbackMaxAttempts ?? groq?.fallbackMaxAttempts ?? DEFAULT_FALLBACK_MAX_ATTEMPTS,
  };
}

async function getBuilderStatus(admin: Awaited<ReturnType<typeof requireAdministrator>>['admin']) {
  const configuration = await readBuilderConfiguration(admin);
  return {
    configured: Boolean(configuration.gemini || configuration.groq),
    geminiConfigured: Boolean(configuration.gemini),
    groqConfigured: Boolean(configuration.groq),
    modelName: configuration.gemini?.modelName ?? DEFAULT_MODEL,
    groqModelName: configuration.groq?.modelName ?? DEFAULT_GROQ_MODEL,
    fallbackMaxAttempts: configuration.fallbackMaxAttempts,
  };
}

function parseJsonResponse(value: string): Record<string, unknown> {
  const clean = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(clean);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new FunctionError(502, 'A IA não retornou um cadastro de produto válido. Tente gerar novamente.');
  }
  return parsed as Record<string, unknown>;
}

interface PricingContext {
  defaultHourlyRate: number;
  defaultWastePercentage: number;
  defaultMarginPercentage: number;
  defaultMarkupPercentage: number;
  defaultInkCostPerSheet: number;
}

const SYSTEM_PRICING_DEFAULTS: PricingContext = {
  defaultHourlyRate: 20,
  defaultWastePercentage: 5,
  defaultMarginPercentage: 40,
  defaultMarkupPercentage: 70,
  defaultInkCostPerSheet: 0.15,
};

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function normalizePricingContext(value: unknown): PricingContext {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    defaultHourlyRate: boundedNumber(input.defaultHourlyRate, SYSTEM_PRICING_DEFAULTS.defaultHourlyRate, 0, 10000),
    defaultWastePercentage: boundedNumber(input.defaultWastePercentage, SYSTEM_PRICING_DEFAULTS.defaultWastePercentage, 0, 100),
    defaultMarginPercentage: boundedNumber(input.defaultMarginPercentage, SYSTEM_PRICING_DEFAULTS.defaultMarginPercentage, 1, 90),
    defaultMarkupPercentage: boundedNumber(input.defaultMarkupPercentage, SYSTEM_PRICING_DEFAULTS.defaultMarkupPercentage, 1, 500),
    defaultInkCostPerSheet: boundedNumber(input.defaultInkCostPerSheet, SYSTEM_PRICING_DEFAULTS.defaultInkCostPerSheet, 0, 1000),
  };
}

function safeText(value: unknown, maxLength = 1000): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function safeList(value: unknown, maxCount = 20): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, maxCount)
    : [];
}

function safeSuggestedAmount(value: unknown, fallback: number, min = 0.01, max = 1000000): number {
  return Number(boundedNumber(value, fallback, min, max).toFixed(2));
}

function normalizeProduct(
  value: Record<string, unknown>,
  description: string,
  categories: string[],
  pricingContext: PricingContext,
) {
  const fallbackName = safeText(description.replace(/^(?:crie|criar|monte|fa[cç]a|desenvolva|quero)\s+(?:um|uma)?\s*/i, ''), 120) || 'Produto personalizado';
  const name = safeText(value.name, 160) || `Produto Personalizado ${fallbackName}`.slice(0, 160);
  const productDescription = safeText(value.description, 2000) || `${name}. Cadastro sugerido pela IA com base na solicitação: ${safeText(description, 1200)}`;
  const inputCategory = categories.find((item) => description.toLocaleLowerCase('pt-BR').includes(item.toLocaleLowerCase('pt-BR')));
  const category = safeText(value.category, 80) || inputCategory || 'Produtos Personalizados';
  const productType = safeText(value.product_type, 120) || 'Produto personalizado';
  const materials = safeList(value.materials);
  if (!materials.length) materials.push('Sugestão da IA: material adequado ao uso descrito; confirmar fornecedor e composição antes da produção.');
  const technicalSpecs = safeText(value.technical_specs, 800) || 'Sugestão da IA: confirmar material, acabamento e especificações finais antes da produção.';
  const dimensions = safeText(value.dimensions, 160) || 'Sugestão da IA: definir medidas finais adequadas ao porte descrito e confirmar com o cliente.';
  const personalizationOptions = safeList(value.personalization_options, 20);
  if (!personalizationOptions.length) personalizationOptions.push('Personalização conforme preferência do cliente');
  const saleUnit = safeText(value.sale_unit, 50) || 'Unidade';
  const keywords = safeList(value.keywords, 20);
  if (!keywords.length) keywords.push(...[name, category].filter(Boolean));
  const estimatedProductionMinutes = safeSuggestedAmount(value.estimated_production_minutes, 30, 1, 600);
  const marginPercent = safeSuggestedAmount(value.margin_percent, pricingContext.defaultMarginPercentage, 1, 90);
  const materialCost = safeSuggestedAmount(value.material_cost, Math.max(0.01, pricingContext.defaultInkCostPerSheet * 4));
  const laborCost = Number((pricingContext.defaultHourlyRate * estimatedProductionMinutes / 60).toFixed(2));
  const otherCosts = safeSuggestedAmount(value.other_costs, Math.max(0.01, pricingContext.defaultInkCostPerSheet));
  const componentEstimate = materialCost + laborCost + otherCosts;
  const fallbackProductionCost = componentEstimate * (1 + pricingContext.defaultWastePercentage / 100);
  const productionCost = Math.max(fallbackProductionCost, safeSuggestedAmount(value.production_cost, fallbackProductionCost));
  const fallbackSalePrice = marginPercent < 95
    ? productionCost / (1 - marginPercent / 100)
    : productionCost * (1 + pricingContext.defaultMarkupPercentage / 100);
  const calculatedMinimumPrice = productionCost / (1 - marginPercent / 100);
  const salePrice = Number(Math.max(safeSuggestedAmount(value.sale_price, fallbackSalePrice), calculatedMinimumPrice).toFixed(2));
  const suggestionNotes = safeText(value.suggestion_notes, 1200) ||
    'Custos, preço, margem, dimensões e tempo são sugestões aproximadas da IA. Confirme materiais e custos locais antes de publicar.';
  const additionalInfo = safeText(value.additional_info, 1200) || suggestionNotes;
  return {
    name,
    description: productDescription,
    category,
    productType,
    materials,
    technicalSpecs,
    dimensions,
    personalizationOptions,
    saleUnit,
    keywords,
    additionalInfo,
    salePrice,
    productionCost,
    materialCost,
    laborCost,
    otherCosts,
    marginPercent,
    estimatedProductionMinutes,
    suggestionNotes,
    aiSuggestedFields: ['salePrice', 'productionCost', 'materialCost', 'laborCost', 'otherCosts', 'marginPercent', 'estimatedProductionMinutes', 'dimensions'],
  };
}

function buildPrompt(description: string, categories: string[], pricingContext: PricingContext): string {
  return `Você transforma descrições de produtos personalizados em cadastros completos para um ateliê brasileiro.
Use português do Brasil. Preencha todos os campos: não devolva textos vazios, listas vazias ou valores nulos. Para características que o administrador não informou, ofereça uma recomendação prática e identifique-a claramente como sugestão da IA; nunca apresente uma suposição como fato confirmado.
Se não houver dimensões, sugira medidas aproximadas em centímetros coerentes com o produto e o porte descrito. Complete ficha técnica, materiais, personalização, palavras-chave e informações adicionais; diferencie dados informados das recomendações.
Gere estimativas positivas para preço de venda, custo total de produção, materiais, mão de obra, outras despesas, margem e tempo em minutos. Os valores devem ser plausíveis para produção artesanal personalizada no Brasil. Use o valor-hora, a margem, o markup, o desperdício e o custo de tinta abaixo como parâmetros reais do ateliê. Estime os materiais de acordo com o produto; calcule mão de obra a partir do tempo e do valor-hora; inclua embalagem, acabamento e impressão em outras despesas quando fizer sentido; considere o desperdício no custo de produção. O preço de venda deve ser coerente com o custo e com a margem sugerida. Não trate estimativas como valores confirmados.
Parâmetros atuais do ateliê: ${JSON.stringify(pricingContext)}.
Para personalização sem detalhes fornecidos, use ["Conforme solicitação do cliente"]. Se a unidade não for indicada, use "Unidade".
Use uma categoria existente se ela representar bem o produto. Caso nenhuma seja adequada, proponha uma categoria nova, curta e específica. Categorias existentes: ${JSON.stringify(categories)}.
Crie palavras-chave relevantes para busca. Em suggestion_notes, explique que valores e dados recomendados precisam ser revisados conforme os materiais e custos reais do ateliê.

Exemplo de entrada: "Crie uma sacola personalizada de papel 180g, com alça de cordão, tamanho médio, para lembrancinhas."
Resultado esperado: nome "Sacola Personalizada para Lembrancinhas"; descrição completa em português; categoria "Sacolas Personalizadas"; materiais incluindo papel 180g e cordão; especificações com gramatura, alça e tamanho; dimensões numéricas aproximadas identificadas como sugestão; personalização conforme solicitação do cliente; unidade "Unidade"; palavras-chave e informações adicionais preenchidas; todos os custos, preço, margem e tempo preenchidos como estimativas identificadas, coerentes com os parâmetros do ateliê.

Retorne somente o objeto JSON solicitado pelo esquema. Descrição do administrador: ${description}`;
}

async function saveApiKey(
  admin: Awaited<ReturnType<typeof requireAdministrator>>['admin'],
  body: Record<string, unknown>,
) {
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (apiKey.length < 20 || apiKey.length > 500) {
    throw new FunctionError(400, 'Informe uma chave Gemini válida. A chave não será exibida novamente após o salvamento.');
  }

  const modelName = selectedModel(body.modelName);
  const fallbackMaxAttempts = normalizeFallbackMaxAttempts(body.fallbackMaxAttempts);
  const { data: existing, error: lookupError } = await admin.from(API_KEY_TABLE)
    .select('key_name')
    .eq('key_name', GEMINI_API_KEY_NAME)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw new FunctionError(502, 'Não foi possível acessar a tabela api_keys. Aplique a atualização do esquema e tente novamente.');

  const values = {
    key_name: GEMINI_API_KEY_NAME,
    provider: 'google_gemini',
    api_key: apiKey,
    model_name: modelName,
    ai_fallback_max_attempts: fallbackMaxAttempts,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await admin.from(API_KEY_TABLE).update(values).eq('key_name', GEMINI_API_KEY_NAME)
    : await admin.from(API_KEY_TABLE).insert({ ...values, created_at: values.updated_at });
  if (error) throw new FunctionError(502, 'Não foi possível salvar a chave Gemini em api_keys. Confira o esquema e tente novamente.');

  return getBuilderStatus(admin);
}

async function saveGroqApiKey(
  admin: Awaited<ReturnType<typeof requireAdministrator>>['admin'],
  body: Record<string, unknown>,
) {
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (apiKey.length < 20 || apiKey.length > 500) {
    throw new FunctionError(400, 'Informe uma chave Groq válida. A chave não será exibida novamente após o salvamento.');
  }

  const { data: existing, error: lookupError } = await admin.from(API_KEY_TABLE)
    .select('key_name')
    .eq('key_name', GROQ_API_KEY_NAME)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw new FunctionError(502, 'Não foi possível acessar a tabela api_keys. Aplique a atualização do esquema e tente novamente.');

  const values = {
    key_name: GROQ_API_KEY_NAME,
    provider: 'groq',
    api_key: apiKey,
    model_name: DEFAULT_GROQ_MODEL,
    ai_fallback_max_attempts: normalizeFallbackMaxAttempts(body.fallbackMaxAttempts),
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await admin.from(API_KEY_TABLE).update(values).eq('key_name', GROQ_API_KEY_NAME)
    : await admin.from(API_KEY_TABLE).insert({ ...values, created_at: values.updated_at });
  if (error) throw new FunctionError(502, 'Não foi possível salvar a chave Groq em api_keys. Confira o esquema e tente novamente.');

  return getBuilderStatus(admin);
}

async function saveFallbackAttempts(
  admin: Awaited<ReturnType<typeof requireAdministrator>>['admin'],
  body: Record<string, unknown>,
) {
  const rawAttempts = typeof body.fallbackMaxAttempts === 'number' ? Math.floor(body.fallbackMaxAttempts) : Number.NaN;
  if (!Number.isInteger(rawAttempts) || rawAttempts < MIN_FALLBACK_MAX_ATTEMPTS || rawAttempts > MAX_FALLBACK_MAX_ATTEMPTS) {
    throw new FunctionError(400, `O limite deve ficar entre ${MIN_FALLBACK_MAX_ATTEMPTS} e ${MAX_FALLBACK_MAX_ATTEMPTS} tentativas.`);
  }

  const { data, error } = await admin.from(API_KEY_TABLE)
    .update({ ai_fallback_max_attempts: rawAttempts, updated_at: new Date().toISOString() })
    .in('key_name', [GEMINI_API_KEY_NAME, GROQ_API_KEY_NAME])
    .eq('is_active', true)
    .select('key_name');
  if (error) throw new FunctionError(502, 'Não foi possível salvar o limite de tentativas em api_keys. Confira o esquema e tente novamente.');
  if (!data?.length) throw new FunctionError(409, 'Configure pelo menos um provedor antes de salvar o limite de tentativas.');
  return getBuilderStatus(admin);
}

async function generateProduct(
  admin: Awaited<ReturnType<typeof requireAdministrator>>['admin'],
  body: Record<string, unknown>,
) {
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length < 8 || description.length > 4000) {
    throw new FunctionError(400, 'Descreva o produto com pelo menos 8 caracteres e no máximo 4.000.');
  }

  const providerValue = body.provider ?? 'gemini';
  if (providerValue !== 'gemini' && providerValue !== 'groq') throw new FunctionError(400, 'O provedor de IA solicitado não é válido.');
  const provider = providerValue as AiProvider;
  const configuration = await readStoredKey(admin, provider);
  const providerLabel = provider === 'gemini' ? 'Gemini' : 'Groq';
  if (!configuration) throw new FunctionError(409, `Configure a chave ${providerLabel} nesta ferramenta antes de gerar produtos.`);

  const categories = Array.isArray(body.categories)
    ? body.categories.filter((item): item is string => typeof item === 'string').map((item) => item.trim().slice(0, 80)).filter(Boolean).slice(0, 40)
    : [];
  const pricingContext = normalizePricingContext(body.pricingContext);
  const modelId = provider === 'gemini'
    ? MODEL_IDS[configuration.modelName]
    : (configuration.modelName === DEFAULT_GROQ_MODEL ? configuration.modelName : DEFAULT_GROQ_MODEL);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = provider === 'gemini'
      ? await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': configuration.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: 'Preencha todos os campos do cadastro. Quando faltar uma informação, forneça uma recomendação prática, indique que é uma sugestão da IA e nunca a apresente como dado confirmado.' }] },
          contents: [{ role: 'user', parts: [{ text: buildPrompt(description, categories, pricingContext) }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2200,
            responseMimeType: 'application/json',
            responseJsonSchema: PRODUCT_SCHEMA,
          },
        }),
        signal: controller.signal,
      })
      : await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${configuration.apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: 'Preencha todos os campos do cadastro. Quando faltar uma informação, forneça uma recomendação prática, indique que é uma sugestão da IA e nunca a apresente como dado confirmado.' },
            { role: 'user', content: buildPrompt(description, categories, pricingContext) },
          ],
          temperature: 0.2,
          max_completion_tokens: 2200,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'ai_product_draft',
              strict: true,
              schema: GROQ_PRODUCT_SCHEMA,
            },
          },
        }),
        signal: controller.signal,
      });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new FunctionError(502, `A chave ${providerLabel} não foi aceita. Confira a chave e tente novamente.`);
      if (response.status === 429) throw new FunctionError(429, `O limite de uso do ${providerLabel} foi atingido.`);
      if (response.status === 404) throw new FunctionError(502, `O modelo configurado do ${providerLabel} não está disponível para esta chave.`);
      throw new FunctionError(502, `${providerLabel} não conseguiu gerar um cadastro válido agora.`);
    }

    const text = provider === 'gemini'
      ? result?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: unknown }) => typeof part.text === 'string' ? part.text : '')
        .join('') ?? ''
      : result?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new FunctionError(502, `${providerLabel} não retornou um cadastro de produto válido.`);

    return {
      product: normalizeProduct(parseJsonResponse(text), description, categories, pricingContext),
      provider,
      providerLabel,
      modelName: configuration.modelName,
    };
  } catch (error) {
    if (error instanceof FunctionError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new FunctionError(504, 'A geração excedeu o tempo de resposta. Tente novamente.');
    throw new FunctionError(502, `Não foi possível conectar ao ${providerLabel}. Verifique a conexão e tente novamente.`);
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return response(request, { ok: true });
  if (request.method !== 'POST') return response(request, { error: 'Método não permitido.' }, 405);

  try {
    const { admin } = await requireAdministrator(request);
    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      throw new FunctionError(400, 'O pedido enviado é inválido.');
    }

    if (body.action === 'status') {
      return response(request, await getBuilderStatus(admin));
    }
    if (body.action === 'save_key') {
      return response(request, await saveApiKey(admin, body));
    }
    if (body.action === 'save_groq_key') {
      return response(request, await saveGroqApiKey(admin, body));
    }
    if (body.action === 'save_fallback_attempts') {
      return response(request, await saveFallbackAttempts(admin, body));
    }
    if (body.action === 'generate') {
      return response(request, { product: await generateProduct(admin, body) });
    }
    throw new FunctionError(400, 'Ação do Criador de Produtos com IA desconhecida.');
  } catch (error) {
    const status = error instanceof FunctionError ? error.status : 500;
    const message = error instanceof FunctionError ? error.message : 'Não foi possível concluir a solicitação ao Criador de Produtos com IA.';
    return response(request, { error: message }, status);
  }
});
