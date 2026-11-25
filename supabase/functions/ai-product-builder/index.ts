import { corsHeaders, FunctionError, jsonResponse, requireAdministrator } from '../_shared/admin.ts';

const API_KEY_TABLE = 'api_keys';
const API_KEY_NAME = 'gemini_product_creator_v1';
const DEFAULT_MODEL = 'gemini-3.1-pro';

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

async function readStoredKey(admin: Awaited<ReturnType<typeof requireAdministrator>>['admin']) {
  const { data, error } = await admin.from(API_KEY_TABLE)
    .select('api_key,model_name')
    .eq('key_name', API_KEY_NAME)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new FunctionError(502, 'Não foi possível carregar a configuração Gemini em api_keys. Aplique a atualização do esquema e tente novamente.');
  if (!data || typeof data.api_key !== 'string' || !data.api_key.trim()) return null;
  return { apiKey: data.api_key.trim(), modelName: selectedModel(data.model_name) };
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
  const { data: existing, error: lookupError } = await admin.from(API_KEY_TABLE)
    .select('key_name')
    .eq('key_name', API_KEY_NAME)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw new FunctionError(502, 'Não foi possível acessar a tabela api_keys. Aplique a atualização do esquema e tente novamente.');

  const values = {
    key_name: API_KEY_NAME,
    provider: 'google_gemini',
    api_key: apiKey,
    model_name: modelName,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await admin.from(API_KEY_TABLE).update(values).eq('key_name', API_KEY_NAME)
    : await admin.from(API_KEY_TABLE).insert({ ...values, created_at: values.updated_at });
  if (error) throw new FunctionError(502, 'Não foi possível salvar a chave Gemini em api_keys. Confira o esquema e tente novamente.');

  return { configured: true, modelName };
}

async function generateProduct(
  admin: Awaited<ReturnType<typeof requireAdministrator>>['admin'],
  body: Record<string, unknown>,
) {
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length < 8 || description.length > 4000) {
    throw new FunctionError(400, 'Descreva o produto com pelo menos 8 caracteres e no máximo 4.000.');
  }

  const configuration = await readStoredKey(admin);
  if (!configuration) throw new FunctionError(409, 'Configure a chave Gemini nesta ferramenta antes de gerar produtos.');

  const categories = Array.isArray(body.categories)
    ? body.categories.filter((item): item is string => typeof item === 'string').map((item) => item.trim().slice(0, 80)).filter(Boolean).slice(0, 40)
    : [];
  const pricingContext = normalizePricingContext(body.pricingContext);
  const modelId = MODEL_IDS[configuration.modelName];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`, {
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
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new FunctionError(502, 'A chave Gemini não foi aceita. Confira a chave e tente novamente.');
      if (response.status === 429) throw new FunctionError(429, 'O limite de uso da IA foi atingido. Aguarde e tente novamente.');
      if (response.status === 404) throw new FunctionError(502, 'O modelo Gemini configurado não está disponível para esta chave. Escolha outro modelo nas configurações da ferramenta.');
      throw new FunctionError(502, 'O Gemini não conseguiu gerar o cadastro agora. Tente novamente.');
    }

    const text = result?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: unknown }) => typeof part.text === 'string' ? part.text : '')
      .join('') ?? '';
    if (!text) throw new FunctionError(502, 'O Gemini não retornou um cadastro de produto. Tente novamente.');

    return normalizeProduct(parseJsonResponse(text), description, categories, pricingContext);
  } catch (error) {
    if (error instanceof FunctionError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new FunctionError(504, 'A geração excedeu o tempo de resposta. Tente novamente.');
    throw new FunctionError(502, 'Não foi possível conectar ao Gemini. Verifique a conexão e tente novamente.');
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
      const configuration = await readStoredKey(admin);
      return response(request, { configured: Boolean(configuration), modelName: configuration?.modelName ?? DEFAULT_MODEL });
    }
    if (body.action === 'save_key') {
      return response(request, await saveApiKey(admin, body));
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
