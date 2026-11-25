import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, LoaderCircle, PackagePlus, RefreshCw, Save, ShieldCheck, Sparkles } from 'lucide-react';
import { AiProductDraft, AiProductModel, StoreCategory, StoreProduct } from '../../types';
import {
  AiProductProvider,
  generateAiProductDraft,
  getAiProductBuilderStatus,
  saveAiProductBuilderFallbackAttempts,
  saveAiProductBuilderGroqKey,
  saveAiProductBuilderKey,
} from '../../services/aiProductBuilderService';
import { storeRepository } from '../../services/storeRepository';
import { flushPendingCloudData } from '../../services/appDataSync';
import { storageService } from '../../services/storage';
import { CustomModal } from '../ui/CustomModal';
import { CustomSelect } from '../ui/CustomSelect';
import { useToast } from '../ui/Toast';

interface CreateAiProductPanelProps {
  onClose: () => void;
}

const SAMPLE_DESCRIPTION = 'Crie uma sacola personalizada de papel 180g, com alça de cordão, tamanho médio, para lembrancinhas.';
const AI_SUGGESTION_FIELDS = ['salePrice', 'productionCost', 'materialCost', 'laborCost', 'otherCosts', 'marginPercent', 'estimatedProductionMinutes', 'dimensions'] as const;

const MODEL_OPTIONS: Array<{ value: AiProductModel; label: string; hint: string }> = [
  { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', hint: 'Mais detalhado' },
  { value: 'gemini-3.0-flash', label: 'Gemini 3.0 Flash', hint: 'Mais rápido' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', hint: 'Raciocínio avançado' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: 'Ágil' },
];

const BUILT_IN_CATEGORIES = [
  { id: 'adesivos', name: 'Adesivos' },
  { id: 'topo_bolo', name: 'Topo de bolo' },
  { id: 'lembrancinhas', name: 'Lembrancinhas' },
  { id: 'etiquetas', name: 'Etiquetas' },
  { id: 'convites', name: 'Convites' },
  { id: 'papelaria_festa', name: 'Papelaria de festa' },
  { id: 'outro', name: 'Outro' },
];

function createProductId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `store-product-ai-${crypto.randomUUID()}`
    : `store-product-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toLineList(value: string): string[] {
  return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 20);
}

function normalizeCategory(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function resolveCategoryId(name: string, categories: StoreCategory[]): string {
  const normalized = normalizeCategory(name);
  const builtIn = BUILT_IN_CATEGORIES.find((category) => category.id === name || normalizeCategory(category.name) === normalized);
  if (builtIn) return builtIn.id;

  const existing = categories.find((category) => normalizeCategory(category.name) === normalized);
  if (existing) return existing.id;

  const now = new Date().toISOString();
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nova-categoria';
  const usedIds = new Set(categories.map((category) => category.id));
  let id = `categoria-${slug}`;
  if (usedIds.has(id)) id = `${id}-${Date.now().toString(36)}`;

  storeRepository.saveCategory({ id, name: name.trim(), active: true, createdAt: now, updatedAt: now });
  return id;
}

export function CreateAiProductPanel({ onClose }: CreateAiProductPanelProps) {
  const { success, warning, error, info } = useToast();
  const [description, setDescription] = useState(SAMPLE_DESCRIPTION);
  const [draft, setDraft] = useState<AiProductDraft | null>(null);
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [groqConfigured, setGroqConfigured] = useState(false);
  const [configurationError, setConfigurationError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [modelName, setModelName] = useState<AiProductModel>('gemini-3.1-pro');
  const [groqModelName, setGroqModelName] = useState('openai/gpt-oss-120b');
  const [fallbackMaxAttempts, setFallbackMaxAttempts] = useState(4);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isSavingGroqKey, setIsSavingGroqKey] = useState(false);
  const [isSavingRetrySettings, setIsSavingRetrySettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const saveProductIdRef = useRef<string | null>(null);

  const categories = useMemo(() => storeRepository.getCategories(), [draft]);
  const categoryNames = useMemo(() => [
    ...BUILT_IN_CATEGORIES.map((category) => category.name),
    ...categories.filter((category) => category.active).map((category) => category.name),
  ], [categories]);

  useEffect(() => {
    let active = true;
    void getAiProductBuilderStatus()
      .then((status) => {
        if (!active) return;
        setIsConfigured(status.configured);
        setGeminiConfigured(status.geminiConfigured);
        setGroqConfigured(status.groqConfigured);
        setModelName(status.modelName);
        setGroqModelName(status.groqModelName);
        setFallbackMaxAttempts(status.fallbackMaxAttempts);
      })
      .catch((statusError) => {
        if (!active) return;
        setConfigurationError(statusError instanceof Error ? statusError.message : 'Não foi possível carregar a configuração da IA.');
      })
      .finally(() => {
        if (active) setIsCheckingKey(false);
      });
    return () => { active = false; };
  }, []);

  const updateDraft = <K extends keyof AiProductDraft>(key: K, value: AiProductDraft[K]) => {
    setDraft((current) => {
      if (!current) return current;
      const updated = { ...current, [key]: value };
      if (AI_SUGGESTION_FIELDS.some((field) => field === key)) {
        updated.aiSuggestedFields = current.aiSuggestedFields.filter((field) => field !== key);
      }
      return updated;
    });
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      warning('Informe a chave Gemini', 'A chave será enviada apenas ao Supabase e não ficará visível depois de salva.');
      return;
    }

    setIsSavingKey(true);
    setConfigurationError('');
    try {
      const status = await saveAiProductBuilderKey(apiKey, modelName, fallbackMaxAttempts);
      setIsConfigured(status.configured);
      setGeminiConfigured(status.geminiConfigured);
      setGroqConfigured(status.groqConfigured);
      setModelName(status.modelName);
      setGroqModelName(status.groqModelName);
      setFallbackMaxAttempts(status.fallbackMaxAttempts);
      setApiKey('');
      success('Configuração Gemini salva', 'A chave ficou protegida em api_keys e não será devolvida ao navegador.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Não foi possível salvar a configuração Gemini.';
      setConfigurationError(message);
      error('Não foi possível salvar a chave Gemini', message);
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleSaveGroqKey = async () => {
    if (!groqApiKey.trim()) {
      warning('Informe a chave Groq', 'A chave será enviada apenas ao Supabase e não ficará visível depois de salva.');
      return;
    }
    setIsSavingGroqKey(true);
    setConfigurationError('');
    try {
      const status = await saveAiProductBuilderGroqKey(groqApiKey, fallbackMaxAttempts);
      setIsConfigured(status.configured);
      setGeminiConfigured(status.geminiConfigured);
      setGroqConfigured(status.groqConfigured);
      setModelName(status.modelName);
      setGroqModelName(status.groqModelName);
      setFallbackMaxAttempts(status.fallbackMaxAttempts);
      setGroqApiKey('');
      success('Configuração Groq salva', 'A chave ficou protegida em api_keys e não será devolvida ao navegador.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Não foi possível salvar a configuração Groq.';
      setConfigurationError(message);
      error('Não foi possível salvar a chave Groq', message);
    } finally {
      setIsSavingGroqKey(false);
    }
  };

  const handleSaveFallbackAttempts = async () => {
    if (!isConfigured) {
      warning('Configure um provedor primeiro', 'Salve a chave do Gemini ou do Groq antes de ajustar as tentativas.');
      return;
    }
    setIsSavingRetrySettings(true);
    setConfigurationError('');
    try {
      const status = await saveAiProductBuilderFallbackAttempts(fallbackMaxAttempts);
      setIsConfigured(status.configured);
      setGeminiConfigured(status.geminiConfigured);
      setGroqConfigured(status.groqConfigured);
      setModelName(status.modelName);
      setGroqModelName(status.groqModelName);
      setFallbackMaxAttempts(status.fallbackMaxAttempts);
      success('Limite de tentativas salvo', `A geração poderá fazer até ${status.fallbackMaxAttempts} tentativas alternadas.`);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Não foi possível salvar o limite de tentativas.';
      setConfigurationError(message);
      error('Não foi possível salvar o limite', message);
    } finally {
      setIsSavingRetrySettings(false);
    }
  };

  const handleGenerate = async () => {
    if (!description.trim()) {
      warning('Descreva o produto', 'Escreva o que deseja criar para a IA montar o cadastro.');
      return;
    }
    const availableProviders: AiProductProvider[] = [
      ...(geminiConfigured ? ['gemini' as const] : []),
      ...(groqConfigured ? ['groq' as const] : []),
    ];
    if (!availableProviders.length) {
      warning('Configure um provedor primeiro', 'Salve uma chave Gemini ou Groq nesta tela antes de gerar o produto.');
      return;
    }

    setIsGenerating(true);
    setConfigurationError('');
    setGenerationMessage('');
    try {
      const settings = storageService.getSettings();
      const pricingContext = {
        defaultHourlyRate: settings.defaultHourlyRate,
        defaultWastePercentage: settings.defaultWastePercentage,
        defaultMarginPercentage: settings.defaultMarginPercentage,
        defaultMarkupPercentage: settings.defaultMarkupPercentage,
        defaultInkCostPerSheet: settings.defaultInkCostPerSheet,
      };
      const failures: string[] = [];
      for (let attempt = 0; attempt < fallbackMaxAttempts; attempt += 1) {
        const provider = availableProviders[attempt % availableProviders.length];
        const providerLabel = provider === 'gemini' ? 'Gemini' : 'Groq';
        setGenerationMessage(`Tentativa ${attempt + 1} de ${fallbackMaxAttempts}: gerando pelo ${providerLabel}...`);
        try {
          const generated = await generateAiProductDraft(description, categoryNames, pricingContext, provider);
          setDraft(generated.product);
          saveProductIdRef.current = null;
          setGenerationMessage(`Cadastro gerado pelo ${generated.providerLabel} na tentativa ${attempt + 1} de ${fallbackMaxAttempts}.`);
          success(`Prévia pronta pelo ${generated.providerLabel}`, 'Revise e edite os campos antes de salvar o produto no catálogo.');
          return;
        } catch (providerError) {
          const message = providerError instanceof Error ? providerError.message : 'A resposta não foi válida.';
          failures.push(`${providerLabel}: ${message}`);
          if (attempt + 1 >= fallbackMaxAttempts) break;

          const nextProvider = availableProviders[(attempt + 1) % availableProviders.length];
          const nextProviderLabel = nextProvider === 'gemini' ? 'Gemini' : 'Groq';
          const isProviderSwitch = nextProvider !== provider;
          const waitSeconds = Math.floor(Math.random() * 6) + 5;
          setGenerationMessage(isProviderSwitch
            ? `${providerLabel} falhou. Alternando automaticamente para ${nextProviderLabel} em ${waitSeconds} segundos...`
            : `${providerLabel} falhou. Nova tentativa pelo mesmo provedor em ${waitSeconds} segundos...`);
          if (isProviderSwitch) info('Alternância automática de IA', `${providerLabel} não retornou uma resposta válida. A próxima tentativa será pelo ${nextProviderLabel}.`);
          for (let remaining = waitSeconds; remaining > 0; remaining -= 1) {
            setGenerationMessage(isProviderSwitch
              ? `${providerLabel} falhou. Alternando para ${nextProviderLabel} em ${remaining} ${remaining === 1 ? 'segundo' : 'segundos'}...`
              : `${providerLabel} falhou. Nova tentativa em ${remaining} ${remaining === 1 ? 'segundo' : 'segundos'}...`);
            await new Promise<void>((resolve) => window.setTimeout(resolve, 1000));
          }
        }
      }
      throw new Error(`Todos os provedores disponíveis falharam após ${fallbackMaxAttempts} tentativas. ${failures.join(' · ')}`);
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : 'Não foi possível gerar o cadastro.';
      setConfigurationError(message);
      setGenerationMessage(`Geração interrompida após ${fallbackMaxAttempts} tentativas.`);
      error('Não foi possível gerar o produto', message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!draft || isGenerating) return;
    const requiredTexts = [draft.name, draft.description, draft.category, draft.productType, draft.technicalSpecs,
      draft.dimensions, draft.saleUnit, draft.additionalInfo, draft.suggestionNotes];
    const requiredNumbers = [draft.salePrice, draft.productionCost, draft.materialCost, draft.laborCost,
      draft.otherCosts, draft.marginPercent, draft.estimatedProductionMinutes];
    if (requiredTexts.some((value) => !value.trim()) || !draft.materials.length || !draft.personalizationOptions.length ||
      !draft.keywords.length || requiredNumbers.some((value) => !Number.isFinite(value) || value < 0)) {
      warning('Revise o cadastro completo', 'Preencha todos os campos e mantenha os valores sugeridos antes de salvar.');
      return;
    }

    setIsSavingProduct(true);
    try {
      const now = new Date().toISOString();
      const currentCategories = storeRepository.getCategories();
      const categoryId = resolveCategoryId(draft.category, currentCategories);
      const productId = saveProductIdRef.current || createProductId();
      saveProductIdRef.current = productId;

      const product: StoreProduct = {
        id: productId,
        name: draft.name.trim(),
        publicDescription: draft.description.trim(),
        internalDescription: '',
        category: categoryId,
        productType: draft.productType.trim(),
        materials: draft.materials.map((item) => item.trim()).filter(Boolean),
        technicalSpecs: draft.technicalSpecs.trim(),
        dimensions: draft.dimensions.trim(),
        personalizationInstructions: draft.personalizationOptions.join(', '),
        saleUnit: draft.saleUnit.trim() || 'Unidade',
        keywords: draft.keywords.map((item) => item.trim()).filter(Boolean),
        additionalInfo: draft.additionalInfo.trim(),
        suggestionNotes: draft.suggestionNotes.trim(),
        aiSuggestedFields: [...draft.aiSuggestedFields],
        creationOrigin: 'ia',
        pricingProvided: true,
        salePriceProvided: true,
        salePriceSuggested: draft.aiSuggestedFields.includes('salePrice'),
        imageIds: [],
        minimumQuantity: 1,
        productionDeadline: '',
        salePrice: draft.salePrice,
        marginPercent: draft.marginPercent,
        productionCost: draft.productionCost,
        laborCost: draft.laborCost,
        materialCost: draft.materialCost,
        otherCosts: draft.otherCosts,
        estimatedProductionTime: draft.estimatedProductionMinutes,
        timeUnit: 'minutes',
        status: 'rascunho',
        showInFutureStore: false,
        observations: draft.additionalInfo.trim(),
        personalizationOptions: draft.personalizationOptions.map((name, index) => ({
          id: `${productId}-personalization-${index + 1}`,
          name,
          type: 'texto',
          required: false,
          values: [],
          priceAdjustment: 0,
          active: true,
        })),
        addons: [],
        createdAt: now,
        updatedAt: now,
      };

      storeRepository.saveProduct(product);
      await flushPendingCloudData();
      success('Produto salvo no catálogo', `${product.name} está como rascunho e não foi publicado na loja.`);
      onClose();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Não foi possível confirmar a gravação no Supabase.';
      error('Não foi possível confirmar o salvamento', `${message} O rascunho local foi mantido para nova tentativa.`);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleCancel = () => {
    if (isGenerating || isSavingProduct) return;
    if (draft) setIsCancelModalOpen(true);
    else onClose();
  };

  const confirmCancel = () => {
    setIsCancelModalOpen(false);
    onClose();
  };

  const categoriesForPrompt = categoryNames.join(', ');

  return (
    <div className="h-[calc(100dvh-7.5rem)] lg:h-[calc(100vh-4.25rem)] min-h-0 overflow-y-auto rounded-2xl border border-pink-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-pink-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-pink-100 bg-pink-50 text-brand-600"><PackagePlus className="h-5 w-5" /></div>
            <div><h1 className="text-xl font-black text-slate-900">Criar Produto com IA</h1><p className="mt-1 text-xs text-slate-500">Descreva o produto, revise os campos e salve como rascunho no catálogo.</p></div>
          </div>
          <button type="button" onClick={handleCancel} disabled={isGenerating || isSavingProduct} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"><ArrowLeft className="h-4 w-4" /> Voltar ao Assistente</button>
        </header>

        <section className="rounded-2xl border border-pink-100 bg-pink-50/30 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-600" /><h2 className="text-sm font-black text-slate-800">Descrição do produto</h2></div>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={4000} className="input-base min-h-28 resize-none" placeholder="Ex.: Sacola personalizada de papel 180g, com alça de cordão, tamanho médio, para lembrancinhas." />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] text-slate-500">A IA completa os campos e identifica estimativas para você revisar.</span>
            <button type="button" onClick={() => void handleGenerate()} disabled={isGenerating || isCheckingKey || !isConfigured} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
              {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{draft ? 'Gerar novamente' : 'Gerar cadastro'}
            </button>
          </div>
          {generationMessage && <p role="status" aria-live="polite" className={`mt-3 flex items-center gap-2 rounded-xl border p-3 text-xs ${isGenerating ? 'border-sky-100 bg-sky-50 text-sky-800' : 'border-emerald-100 bg-emerald-50 text-emerald-800'}`}>{isGenerating && <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />}{generationMessage}</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3"><div className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-600"><KeyRound className="h-4 w-4" /></div><div><h2 className="text-sm font-black text-slate-800">Configuração da IA</h2><p className="mt-1 text-xs text-slate-500">A chave fica na tabela api_keys e nunca é enviada de volta ao navegador.</p></div></div>
            {isCheckingKey ? <span className="inline-flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Conferindo configuração...</span> : <div className="flex flex-wrap gap-2 text-[10px] font-bold"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${geminiConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><CheckCircle2 className="h-3.5 w-3.5" />Gemini {geminiConfigured ? 'configurado' : 'sem chave'}</span><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${groqConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><CheckCircle2 className="h-3.5 w-3.5" />Groq {groqConfigured ? 'configurado' : 'sem chave'}</span></div>}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] sm:items-end">
            <div><label className="mb-1 block text-xs font-bold text-slate-700">Chave de API Gemini</label><input type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="input-base" placeholder={geminiConfigured ? 'Digite uma nova chave para substituir' : 'Cole a chave Gemini aqui'} /><span className="mt-1 block text-[10px] text-slate-400">Ela é transmitida por conexão segura e salva somente no banco.</span></div>
            <CustomSelect label="Modelo de texto" value={modelName} onChange={(value) => setModelName(value as AiProductModel)} options={MODEL_OPTIONS} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> A chave não aparece no histórico nem na prévia.</span>
            <button type="button" onClick={() => void handleSaveKey()} disabled={isSavingKey || isGenerating || !apiKey.trim()} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">{isSavingKey ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{geminiConfigured ? 'Atualizar Gemini' : 'Salvar Gemini'}</button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] sm:items-end">
            <div><label className="mb-1 block text-xs font-bold text-slate-700">Chave de API Groq</label><input type="password" autoComplete="new-password" value={groqApiKey} onChange={(event) => setGroqApiKey(event.target.value)} className="input-base" placeholder={groqConfigured ? 'Digite uma nova chave para substituir' : 'Cole a chave Groq aqui'} /><span className="mt-1 block text-[10px] text-slate-400">A chave é armazenada em api_keys e não retorna ao navegador.</span></div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Modelo de contingência</span><strong className="mt-1 block text-sm text-slate-800">Groq · {groqModelName}</strong></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={() => void handleSaveGroqKey()} disabled={isSavingGroqKey || isGenerating || !groqApiKey.trim()} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">{isSavingGroqKey ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{groqConfigured ? 'Atualizar Groq' : 'Salvar Groq'}</button>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
              <CustomSelect label="Limite de tentativas" value={String(fallbackMaxAttempts)} onChange={(value) => setFallbackMaxAttempts(Number(value))} options={[2, 3, 4, 5, 6].map((value) => ({ value: String(value), label: `${value} tentativas` }))} />
              <p className="text-[11px] leading-5 text-slate-500">Gemini é tentado primeiro quando está configurado. Entre falhas, o sistema aguarda de 5 a 10 segundos antes de alternar.</p>
            </div>
            <button type="button" onClick={() => void handleSaveFallbackAttempts()} disabled={isSavingRetrySettings || isGenerating || !isConfigured} className="inline-flex min-h-9 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:self-auto">{isSavingRetrySettings ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Salvar limite</button>
          </div>
          {configurationError && <p role="alert" className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">{configurationError}</p>}
        </section>

        {draft ? (
          <section className="space-y-5 rounded-2xl border border-brand-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="flex items-center gap-2"><h2 className="text-sm font-black text-slate-900">Prévia do cadastro</h2><span className="rounded-full bg-pink-50 px-2 py-1 text-[10px] font-bold text-brand-700">Criado por IA</span></div><p className="mt-1 text-xs text-slate-500">A IA completa os campos e identifica estimativas. Confira os dados antes de salvar; o produto ficará oculto da loja.</p></div>
              <button type="button" onClick={() => void handleGenerate()} disabled={isGenerating || !isConfigured} className="inline-flex min-h-9 items-center justify-center gap-2 self-start rounded-lg border border-pink-200 px-3 text-xs font-bold text-brand-700 transition hover:bg-pink-50 disabled:opacity-50 sm:self-auto">{isGenerating ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Solicitar nova geração</button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="mb-1 block text-xs font-bold text-slate-700">Nome comercial</label><input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} className="input-base" /></div>
              <div className="sm:col-span-2"><label className="mb-1 block text-xs font-bold text-slate-700">Descrição completa</label><textarea value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} rows={4} className="input-base resize-none" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-700">Categoria</label><input value={draft.category} onChange={(event) => updateDraft('category', event.target.value)} list="ai-product-categories" className="input-base" /><datalist id="ai-product-categories">{categoryNames.map((name) => <option key={name} value={name} />)}</datalist><span className="mt-1 block text-[10px] text-slate-400">Categorias atuais: {categoriesForPrompt || 'Nenhuma personalizada'}</span></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-700">Tipo de produto</label><input value={draft.productType} onChange={(event) => updateDraft('productType', event.target.value)} className="input-base" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-700">Materiais</label><textarea value={draft.materials.join('\n')} onChange={(event) => updateDraft('materials', toLineList(event.target.value))} rows={3} className="input-base resize-none" placeholder="Um material por linha" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-700">Gramatura e especificações técnicas</label><textarea value={draft.technicalSpecs} onChange={(event) => updateDraft('technicalSpecs', event.target.value)} rows={3} className="input-base resize-none" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-700">Dimensões sugeridas</label><input value={draft.dimensions} onChange={(event) => updateDraft('dimensions', event.target.value)} className="input-base" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-700">Unidade de venda</label><input value={draft.saleUnit} onChange={(event) => updateDraft('saleUnit', event.target.value)} className="input-base" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-700">Opções de personalização</label><textarea value={draft.personalizationOptions.join('\n')} onChange={(event) => updateDraft('personalizationOptions', toLineList(event.target.value))} rows={3} className="input-base resize-none" placeholder="Uma opção por linha" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-700">Palavras-chave</label><textarea value={draft.keywords.join(', ')} onChange={(event) => updateDraft('keywords', toLineList(event.target.value))} rows={3} className="input-base resize-none" placeholder="Separe por vírgula ou linha" /></div>
              <div className="sm:col-span-2"><label className="mb-1 block text-xs font-bold text-slate-700">Informações adicionais</label><textarea value={draft.additionalInfo} onChange={(event) => updateDraft('additionalInfo', event.target.value)} rows={3} className="input-base resize-none" /></div>
            </div>

            <section className="space-y-3 border-t border-slate-100 pt-4">
              <div><h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Custos e preços sugeridos</h3><p className="mt-1 text-[11px] text-slate-500">São estimativas da IA, calculadas considerando os parâmetros do ateliê. Confira os custos reais antes de publicar.</p></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {([
                  ['salePrice', 'Preço de venda (R$)'],
                  ['productionCost', 'Custo de produção (R$)'],
                  ['materialCost', 'Custo de materiais (R$)'],
                  ['laborCost', 'Custo de mão de obra (R$)'],
                  ['otherCosts', 'Outras despesas (R$)'],
                  ['marginPercent', 'Margem (%)'],
                ] as const).map(([key, label]) => <div key={key}><label className="mb-1 block text-xs font-bold text-slate-700">{label}{draft.aiSuggestedFields.includes(key) && <span className="ml-1 font-medium text-brand-600">· Sugestão da IA</span>}</label><input type="number" min="0" max={key === 'marginPercent' ? 100 : undefined} step="0.01" value={draft[key]} onChange={(event) => updateDraft(key, Number(event.target.value))} className="input-base" /></div>)}
                <div><label className="mb-1 block text-xs font-bold text-slate-700">Tempo estimado (minutos){draft.aiSuggestedFields.includes('estimatedProductionMinutes') && <span className="ml-1 font-medium text-brand-600">· Sugestão da IA</span>}</label><input type="number" min="0" step="1" value={draft.estimatedProductionMinutes} onChange={(event) => updateDraft('estimatedProductionMinutes', Number(event.target.value))} className="input-base" /></div>
              </div>
              <div><label className="mb-1 block text-xs font-bold text-slate-700">Base das sugestões</label><textarea value={draft.suggestionNotes} onChange={(event) => updateDraft('suggestionNotes', event.target.value)} rows={2} className="input-base resize-none" /></div>
            </section>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={handleCancel} disabled={isSavingProduct || isGenerating} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Cancelar cadastro</button>
              <button type="button" onClick={() => void handleSaveProduct()} disabled={isSavingProduct || isGenerating} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50">{isSavingProduct ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{isSavingProduct ? 'Salvando e sincronizando...' : 'Salvar como rascunho'}</button>
            </div>
          </section>
        ) : (
          <section className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <PackagePlus className="h-8 w-8 text-pink-300" /><h2 className="mt-3 text-sm font-black text-slate-800">A prévia aparecerá aqui</h2><p className="mt-1 max-w-md text-xs text-slate-500">Depois de configurar a chave, gere o cadastro. Você poderá revisar e editar cada campo antes de salvar.</p>
          </section>
        )}
      </div>

      <CustomModal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancelar este cadastro?" description="A prévia e as edições serão descartadas. Nenhum produto será salvo no catálogo." confirmText="Descartar prévia" cancelText="Continuar editando" variant="warning" onConfirm={confirmCancel} />
    </div>
  );
}
