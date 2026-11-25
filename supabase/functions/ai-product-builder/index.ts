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
    dimensions: { type: 'string', description: 'Dimensões somente quando fornecidas; caso contrário, string vazia.' },
    personalization_options: { type: 'array', items: { type: 'string' } },
    sale_unit: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
    additional_info: { type: 'string' },
    sale_price: { type: ['number', 'null'] },
    production_cost: { type: ['number', 'null'] },
    material_cost: { type: ['number', 'null'] },
    labor_cost: { type: ['number', 'null'] },
    other_costs: { type: ['number', 'null'] },
    margin_percent: { type: ['number', 'null'] },
  },
  required: [
    'name', 'description', 'category', 'product_type', 'materials', 'technical_specs',
    'dimensions', 'personalization_options', 'sale_unit', 'keywords', 'additional_info',
    'sale_price', 'production_cost', 'material_cost', 'labor_cost', 'other_costs', 'margin_percent',
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

function parseBrazilianNumber(raw: string): number {
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : /\.\d{3}(?:$|\D)/.test(raw) ? raw.replace(/\./g, '') : raw;
  return Number(normalized);
}

const CURRENCY_FIELD_LABELS: Array<{ field: string; pattern: RegExp }> = [
  { field: 'salePrice', pattern: /pre[cç]o(?:\s+de\s+venda)?|valor\s+(?:de\s+venda|final)/i },
  { field: 'productionCost', pattern: /custo\s+(?:de\s+)?produ[cç][aã]o|custo\s+total(?:\s+de\s+produ[cç][aã]o)?/i },
  { field: 'materialCost', pattern: /custo\s+(?:de\s+)?materia(?:l|is)|materia(?:l|is)\s+(?:custam|custa)/i },
  { field: 'laborCost', pattern: /custo\s+(?:de\s+)?m[aã]o\s+de\s+obra|m[aã]o\s+de\s+obra\s+(?:custa|custo)/i },
  { field: 'otherCosts', pattern: /outras?\s+despesas|outros?\s+custos|custo\s+de\s+(?:embalagem|energia|acabamento)/i },
];

function nearestCurrencyField(description: string, beforeIndex: number): string | null {
  const start = Math.max(0, beforeIndex - 90);
  const context = description.slice(start, beforeIndex);
  let nearest: { field: string; index: number } | null = null;
  for (const { field, pattern } of CURRENCY_FIELD_LABELS) {
    const matcher = new RegExp(pattern.source, 'gi');
    for (const match of context.matchAll(matcher)) {
      const index = match.index ?? 0;
      if (!nearest || index > nearest.index) nearest = { field, index };
    }
  }
  return nearest?.field ?? null;
}

function explicitCurrencyAmounts(description: string, field: string): number[] {
  const values: number[] = [];
  const matches = description.matchAll(/R\$\s*(\d{1,7}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d.,])/gi);
  for (const match of matches) {
    const index = match.index ?? 0;
    if (nearestCurrencyField(description, index) !== field) continue;
    const value = parseBrazilianNumber(match[1]);
    if (Number.isFinite(value) && value >= 0) values.push(value);
  }
  return values;
}

function explicitMargins(description: string): number[] {
  const values: number[] = [];
  const matches = description.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)\s*%(?!\d)/g);
  for (const match of matches) {
    const index = match.index ?? 0;
    const context = description.slice(Math.max(0, index - 70), index);
    const concepts = [...context.matchAll(/\b(margem|desconto|markup|perda|desperd[ií]cio)\b/gi)];
    const nearestConcept = concepts.at(-1);
    const afterNumber = description.slice(index + match[0].length, index + match[0].length + 24);
    const marginBefore = nearestConcept?.[1].toLocaleLowerCase('pt-BR') === 'margem' &&
      !/[,.!?;\n]/.test(context.slice((nearestConcept.index ?? 0) + nearestConcept[0].length));
    const marginAfter = !nearestConcept && /^\s*(?:de\s+)?margem\b/i.test(afterNumber);
    if (!marginBefore && !marginAfter) continue;
    const value = parseBrazilianNumber(match[1]);
    if (Number.isFinite(value) && value >= 0 && value <= 100) values.push(value);
  }
  return values;
}

function safeText(value: unknown, maxLength = 1000): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function safeList(value: unknown, maxCount = 20): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, maxCount)
    : [];
}

function safePrice(value: unknown, allowedAmounts: number[]): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return allowedAmounts.some((amount) => Math.abs(amount - value) < 0.005) ? Number(value.toFixed(2)) : null;
}

function normalizeProduct(value: Record<string, unknown>, description: string) {
  const name = safeText(value.name, 160);
  const productDescription = safeText(value.description, 2000);
  const category = safeText(value.category, 80);
  if (!name || !productDescription || !category) {
    throw new FunctionError(502, 'A IA não preencheu os campos obrigatórios. Revise a descrição e tente novamente.');
  }

  const salePriceAmounts = explicitCurrencyAmounts(description, 'salePrice');
  const productionCostAmounts = explicitCurrencyAmounts(description, 'productionCost');
  const materialCostAmounts = explicitCurrencyAmounts(description, 'materialCost');
  const laborCostAmounts = explicitCurrencyAmounts(description, 'laborCost');
  const otherCostAmounts = explicitCurrencyAmounts(description, 'otherCosts');
  const marginAmounts = explicitMargins(description);
  const dimensions = safeText(value.dimensions, 120);
  const marginPercent = safePrice(value.margin_percent, marginAmounts);
  return {
    name,
    description: productDescription,
    category,
    productType: safeText(value.product_type, 120),
    materials: safeList(value.materials),
    technicalSpecs: safeText(value.technical_specs, 800),
    dimensions,
    personalizationOptions: safeList(value.personalization_options, 20),
    saleUnit: safeText(value.sale_unit, 50) || 'Unidade',
    keywords: safeList(value.keywords, 20),
    additionalInfo: safeText(value.additional_info, 1200),
    salePrice: safePrice(value.sale_price, salePriceAmounts),
    productionCost: safePrice(value.production_cost, productionCostAmounts),
    materialCost: safePrice(value.material_cost, materialCostAmounts),
    laborCost: safePrice(value.labor_cost, laborCostAmounts),
    otherCosts: safePrice(value.other_costs, otherCostAmounts),
    marginPercent: marginPercent !== null && marginPercent <= 100 ? marginPercent : null,
  };
}

function buildPrompt(description: string, categories: string[]): string {
  return `Você transforma descrições de produtos personalizados em cadastros estruturados para um ateliê brasileiro.
Use português do Brasil. Preserve apenas características fornecidas pelo administrador ou claramente contidas no pedido. Nunca invente dimensões, materiais, gramaturas, custos, preços, margens, prazos ou quantidades.
Se o usuário não informar dimensões, retorne dimensions como string vazia. Só preencha preços, custos ou margem quando valores monetários explícitos forem fornecidos e puderem ser associados com segurança ao campo; caso contrário, retorne null em todos esses campos. Nunca estime valores.
Para personalização sem detalhes fornecidos, use ["Conforme solicitação do cliente"]. Se a unidade não for indicada, use "Unidade".
Use uma categoria existente se ela representar bem o produto. Caso nenhuma seja adequada, proponha uma categoria nova, curta e específica. Categorias existentes: ${JSON.stringify(categories)}.
Crie palavras-chave relevantes a partir da descrição, sem adicionar características não informadas.

Exemplo de entrada: "Crie uma sacola personalizada de papel 180g, com alça de cordão, tamanho médio, para lembrancinhas."
Resultado esperado: nome "Sacola Personalizada para Lembrancinhas"; descrição "Sacola personalizada confeccionada em papel de 180g, com alça de cordão, indicada para lembrancinhas, presentes e embalagens especiais."; categoria "Sacolas Personalizadas"; materials ["Papel 180g", "Cordão"]; technical_specs "Gramatura: 180g. Alça: cordão. Tamanho: médio."; dimensions ""; personalization_options ["Conforme solicitação do cliente"]; sale_unit "Unidade"; todos os campos de preço e custo null.

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
        systemInstruction: { parts: [{ text: 'Siga as instruções com rigor e não crie dados comerciais ou técnicos ausentes.' }] },
        contents: [{ role: 'user', parts: [{ text: buildPrompt(description, categories) }] }],
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

    return normalizeProduct(parseJsonResponse(text), description);
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
