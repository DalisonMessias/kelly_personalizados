import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  Plus, 
  Trash2, 
  Save, 
  RotateCcw, 
  FolderPlus, 
  Clock, 
  Palette, 
  Printer, 
  Layers, 
  DollarSign, 
  Percent, 
  BookOpen, 
  Search, 
  Check,
  PackageOpen,
  Tag,
  Sparkles,
  ShoppingBag,
  PlusCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  ArtCostConfig, 
  InkCostConfig, 
  LaborCostConfig, 
  MaterialItem, 
  MeasurementUnit, 
  OtherCostsConfig, 
  PricingConfig, 
  ProductCategory, 
  ProductService, 
  QuantityTier, 
  SimpleMaterial,
  WasteConfig 
} from '../../types';
import { 
  calculateCompleteService, 
  calculateMaterialCost, 
  formatCurrency, 
  formatPercent 
} from '../../utils/calculations';
import { storageService } from '../../services/storage';
import { REAL_MATERIALS_DATABASE, PresetMaterial } from '../../data/realMaterials';
import { CostSummaryCard } from './CostSummaryCard';
import { QuantityTiersSection } from './QuantityTiersSection';
import { CustomSelect } from '../ui/CustomSelect';
import { CustomSwitch } from '../ui/CustomSwitch';
import { CustomModal } from '../ui/CustomModal';
import { Tooltip } from '../ui/Tooltip';
import { useToast } from '../ui/Toast';
import { NavTab } from '../layout/Sidebar';

interface CalculatorPageProps {
  initialProduct?: ProductService | null;
  onClearInitialProduct?: () => void;
  onNavigate: (tab: NavTab) => void;
  onProductSaved: (product: ProductService) => void;
}

export function CalculatorPage({
  initialProduct,
  onClearInitialProduct,
  onNavigate,
  onProductSaved,
}: CalculatorPageProps) {
  const { success, info, warning } = useToast();
  const settings = storageService.getSettings();

  // Estados do serviço
  const [productName, setProductName] = useState(initialProduct?.name || '');
  const [category, setCategory] = useState<ProductCategory>(initialProduct?.category || 'adesivos');
  const [description, setDescription] = useState(initialProduct?.description || '');
  const [sheetCount, setSheetCount] = useState<number>(initialProduct?.sheetCount || 1);

  // Materiais Simples (nome + custo direto) — aparecem automaticamente com 1 campo inicial
  const makeBlankSimple = (): SimpleMaterial => ({
    id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: '',
    cost: 0,
  });

  const [simpleMaterials, setSimpleMaterials] = useState<SimpleMaterial[]>(
    initialProduct?.simpleMaterials && initialProduct.simpleMaterials.length > 0
      ? initialProduct.simpleMaterials
      : [makeBlankSimple()]
  );

  const handleAddSimpleMaterial = () => {
    setSimpleMaterials((prev) => [...prev, makeBlankSimple()]);
  };

  const handleUpdateSimpleMaterial = (id: string, field: 'name' | 'cost', value: string | number) => {
    setSimpleMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleRemoveSimpleMaterial = (id: string) => {
    setSimpleMaterials((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      return updated.length === 0 ? [makeBlankSimple()] : updated;
    });
  };

  const simpleMaterialsTotal = simpleMaterials.reduce((acc, m) => acc + Math.max(0, m.cost || 0), 0);

  // 1. Materiais Avançados (proporcionais)
  const [materials, setMaterials] = useState<MaterialItem[]>(initialProduct?.materials || []);

  // 2. Tinta
  const [ink, setInk] = useState<InkCostConfig>(
    initialProduct?.ink || {
      mode: 'per_sheet',
      costPerSheet: settings.defaultInkCostPerSheet || 0.15,
      costPerJob: 0,
      sheetCount: 1,
    }
  );

  // 3. Arte
  const [art, setArt] = useState<ArtCostConfig>(
    initialProduct?.art || {
      mode: 'shared',
      totalArtPrice: 0,
      sheetsCount: 1,
    }
  );

  // 4. Mão de Obra
  const [labor, setLabor] = useState<LaborCostConfig>(
    initialProduct?.labor || {
      hourlyRate: settings.defaultHourlyRate || 20.0,
      timeSpent: 0,
      timeUnit: 'minutes',
    }
  );

  // 5. Outros Custos
  const [otherCosts, setOtherCosts] = useState<OtherCostsConfig>(
    initialProduct?.otherCosts || {
      packaging: 0,
      electricity: 0,
      printing: 0,
      finishing: 0,
      customExpenses: [],
    }
  );

  // 6. Perdas / Desperdício
  const [waste, setWaste] = useState<WasteConfig>(
    initialProduct?.waste || {
      percentage: settings.defaultWastePercentage || 5.0,
    }
  );

  // 7. Precificação & Campo Opcional de Desconto (%)
  const [pricing, setPricing] = useState<PricingConfig>(
    initialProduct?.pricing || {
      method: 'margin',
      targetMargin: settings.defaultMarginPercentage || 40.0,
      targetMarkup: settings.defaultMarkupPercentage || 70.0,
      manualPrice: 0,
      discountPercent: undefined, // Opcional (0% se vazio)
    }
  );

  // 8. Faixas de quantidade
  const [quantityTiers, setQuantityTiers] = useState<QuantityTier[]>(
    initialProduct?.quantityTiers || []
  );

  // Modais de confirmação e seleção de insumos
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isDeleteMatModalOpen, setIsDeleteMatModalOpen] = useState(false);
  const [matToDeleteId, setMatToDeleteId] = useState<string | null>(null);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [presetSearch, setPresetSearch] = useState('');
  const [presetCategory, setPresetCategory] = useState<string>('todos');

  // Sincroniza quantidade com folhas de tinta
  useEffect(() => {
    setInk((prev) => ({ ...prev, sheetCount }));
  }, [sheetCount]);

  // Cálculo Geral em Tempo Real
  const calculationResult = useMemo(() => {
    return calculateCompleteService(
      materials,
      simpleMaterials,
      ink,
      art,
      labor,
      otherCosts,
      waste,
      pricing,
      sheetCount
    );
  }, [materials, simpleMaterials, ink, art, labor, otherCosts, waste, pricing, sheetCount]);

  // Adicionar Insumo do Catálogo Real
  const handleSelectPresetMaterial = (preset: PresetMaterial) => {
    const newMat: MaterialItem = {
      id: `mat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: preset.name,
      unit: preset.unit,
      purchasePrice: preset.defaultPurchasePrice,
      purchaseQuantity: preset.defaultPurchaseQuantity,
      usedQuantity: preset.typicalUsedQuantity,
      calculatedCost: Number(
        ((preset.defaultPurchasePrice / preset.defaultPurchaseQuantity) * preset.typicalUsedQuantity).toFixed(4)
      ),
    };

    setMaterials([...materials, newMat]);
    setIsPresetModalOpen(false);
    success('Insumo Adicionado!', `"${preset.name}" foi inserido com os preços reais.`);
  };

  // Adicionar Material Manual
  const handleAddManualMaterial = () => {
    const newMat: MaterialItem = {
      id: `mat-${Date.now()}`,
      name: '',
      unit: 'unidade',
      purchasePrice: 0,
      purchaseQuantity: 1,
      usedQuantity: 1,
      calculatedCost: 0,
    };
    setMaterials([...materials, newMat]);
  };

  const handleUpdateMaterial = (id: string, updates: Partial<MaterialItem>) => {
    setMaterials(
      materials.map((mat) => {
        if (mat.id === id) {
          const updated = { ...mat, ...updates };
          updated.calculatedCost = calculateMaterialCost(updated);
          return updated;
        }
        return mat;
      })
    );
  };

  const confirmDeleteMaterial = () => {
    if (matToDeleteId) {
      setMaterials(materials.filter((m) => m.id !== matToDeleteId));
      setMatToDeleteId(null);
    }
  };

  // Despesas personalizadas extras
  const handleAddCustomExpense = () => {
    setOtherCosts((prev) => ({
      ...prev,
      customExpenses: [
        ...prev.customExpenses,
        { 
          id: `exp-${Date.now()}`, 
          name: '', 
          amount: 0 
        },
      ],
    }));
  };

  const handleRemoveCustomExpense = (id: string) => {
    setOtherCosts((prev) => ({
      ...prev,
      customExpenses: prev.customExpenses.filter((e) => e.id !== id),
    }));
  };

  // Salvar Produto no Catálogo
  const handleSaveToCatalog = () => {
    if (!productName.trim()) {
      warning('Informe o Nome', 'Por favor, digite o nome do produto ou serviço antes de salvar.');
      return;
    }

    const productToSave: ProductService = {
      id: initialProduct?.id || `prod-${Date.now()}`,
      name: productName.trim(),
      category,
      description: description.trim(),
      sheetCount,
      createdAt: initialProduct?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      simpleMaterials: simpleMaterials.filter((m) => m.name.trim() !== '' || m.cost > 0),
      materials,
      ink,
      art,
      labor,
      otherCosts,
      waste,
      pricing,
      quantityTiers,
      calculationResult,
    };

    storageService.saveProduct(productToSave);
    onProductSaved(productToSave);

    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 },
    });

    success(
      'Salvo no Catálogo!',
      `O produto "${productToSave.name}" foi salvo com preço de ${formatCurrency(calculationResult.finalSalePrice)}.`
    );
  };

  // Salvar no Histórico de Orçamentos
  const handleSaveToHistory = () => {
    if (!productName.trim()) {
      warning('Informe o Nome', 'Dê um nome ao orçamento antes de registrar no histórico.');
      return;
    }

    storageService.saveCalculation({
      productId: initialProduct?.id,
      productName: productName.trim(),
      category,
      sheetCount,
      calculationResult,
      simpleMaterials: simpleMaterials.filter((m) => m.name.trim() !== '' || m.cost > 0),
      notes: description.trim() || `Orçamento calculado em ${new Date().toLocaleDateString('pt-BR')}.`,
    });

    success('Orçamento Registrado!', 'O cálculo foi arquivado no histórico de consultas.');
  };

  // Limpar formulário
  const handleResetForm = () => {
    setProductName('');
    setCategory('adesivos');
    setDescription('');
    setSheetCount(1);
    setSimpleMaterials([makeBlankSimple()]);
    setMaterials([]);
    setInk({
      mode: 'per_sheet',
      costPerSheet: settings.defaultInkCostPerSheet || 0.15,
      costPerJob: 0,
      sheetCount: 1,
    });
    setArt({
      mode: 'shared',
      totalArtPrice: 0,
      sheetsCount: 1,
    });
    setLabor({
      hourlyRate: settings.defaultHourlyRate || 20.0,
      timeSpent: 0,
      timeUnit: 'minutes',
    });
    setOtherCosts({
      packaging: 0,
      electricity: 0,
      printing: 0,
      finishing: 0,
      customExpenses: [],
    });
    setPricing({
      method: 'margin',
      targetMargin: settings.defaultMarginPercentage || 40.0,
      targetMarkup: settings.defaultMarkupPercentage || 70.0,
      manualPrice: 0,
      discountPercent: undefined,
    });
    setQuantityTiers([]);
    if (onClearInitialProduct) onClearInitialProduct();
    info('Calculadora limpa', 'Pronta para um novo cálculo.');
  };

  const categoryOptions = [
    { value: 'adesivos', label: 'Folhas de Adesivos (A4/Vinil)' },
    { value: 'topo_bolo', label: 'Topo de Bolo (Camadas/3D)' },
    { value: 'lembrancinhas', label: 'Lembrancinhas / Caixinhas' },
    { value: 'etiquetas', label: 'Etiquetas Escolares / Comerciais' },
    { value: 'convites', label: 'Convites Especiais' },
    { value: 'papelaria_festa', label: 'Kits de Papelaria de Festa' },
    { value: 'outro', label: 'Outro Serviço Personalizado' },
  ];

  const unitOptions: { value: MeasurementUnit; label: string }[] = [
    { value: 'folha', label: 'Folha' },
    { value: 'unidade', label: 'Unidade' },
    { value: 'metro', label: 'Metro' },
    { value: 'cm', label: 'Centímetro (cm)' },
    { value: 'rolo', label: 'Rolo' },
    { value: 'pacote', label: 'Pacote' },
    { value: 'g', label: 'Gramas (g)' },
    { value: 'kg', label: 'Quilos (kg)' },
    { value: 'ml', label: 'Mililitros (ml)' },
  ];

  const filteredPresets = REAL_MATERIALS_DATABASE.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(presetSearch.toLowerCase()) ||
      item.description.toLowerCase().includes(presetSearch.toLowerCase());
    const matchesCat = presetCategory === 'todos' || item.category === presetCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Barra de Ações do Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Calculadora de Custos & Precificação
            </h2>
            <Tooltip content="Insira seus materiais e tempo de produção para calcular o custo exato e definir o melhor preço de venda." />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {initialProduct ? `Editando o produto: "${initialProduct.name}"` : 'Preencha os dados reais do seu serviço para calcular o custo, o preço ideal e o lucro restante.'}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Limpar Campos</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToHistory}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs shadow-sm transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Salvar no Histórico</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToCatalog}
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-500/20 active:scale-95 transition-all"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Salvar no Catálogo</span>
          </button>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Coluna da Esquerda: Formulários */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* Bloco 1: Identificação Básica */}
          <div className="card-base p-6 space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              <span>1. Identificação do Produto / Serviço</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                  Nome do Produto ou Serviço
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="input-base font-medium"
                  placeholder="Ex: Topo de Bolo 3D Jardim, Folha de Adesivos Lembrancinha, Caixa Milk..."
                />
              </div>

              <div>
                <CustomSelect
                  label="Categoria"
                  options={categoryOptions}
                  value={category}
                  onChange={(val) => setCategory(val as ProductCategory)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                  Quantidade Base (Folhas / Peças)
                </label>
                <input
                  type="number"
                  min={1}
                  value={sheetCount}
                  onChange={(e) => setSheetCount(Math.max(1, Number(e.target.value)))}
                  className="input-base"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                  Observações / Descrição do Serviço
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="input-base"
                  placeholder="Anotações sobre tipo de papel, medidas, cores, detalhes do corte ou requisitos do cliente..."
                />
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────
              BLOCO: MATERIAIS UTILIZADOS (Simplificado)
              ─────────────────────────────────────────── */}
          <div className="card-base p-6 space-y-4">
            {/* Cabeçalho */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-brand-600" />
                  <span>2. Materiais Utilizados</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Informe cada material e seu custo direto. O total é somado automaticamente ao custo do serviço.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddSimpleMaterial}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-sm active:scale-95 transition-all self-start sm:self-auto whitespace-nowrap"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Adicionar material</span>
              </button>
            </div>

            {/* Lista de materiais simples */}
            <div className="space-y-3">
              {simpleMaterials.map((mat, index) => (
                <div
                  key={mat.id}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-slate-50/60 group"
                >
                  <span className="text-[11px] font-bold text-slate-400 w-5 shrink-0 text-center">
                    {index + 1}
                  </span>

                  <input
                    type="text"
                    value={mat.name}
                    onChange={(e) => handleUpdateSimpleMaterial(mat.id, 'name', e.target.value)}
                    placeholder="Nome do material (ex: Folha de adesivo)"
                    className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 transition-colors"
                  />

                  <div className="relative shrink-0 w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                      R$
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={mat.cost || ''}
                      onChange={(e) => handleUpdateSimpleMaterial(mat.id, 'cost', Number(e.target.value))}
                      placeholder="0,00"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-brand-700 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 transition-colors text-right"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveSimpleMaterial(mat.id)}
                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                    title="Remover material"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Rodapé com total */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-600">
                Total dos materiais utilizados:
              </span>
              <span className="text-sm font-black text-brand-700">
                {formatCurrency(simpleMaterialsTotal)}
              </span>
            </div>
          </div>

          {/* Bloco 3: Insumos com Cálculo Proporcional (avançado) */}
          <div className="card-base p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Palette className="w-4 h-4 text-brand-600" />
                  <span>3. Insumos com Cálculo Proporcional</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Opcional — informe o preço e a quantidade do pacote comprado e quanto usou para cálculo exato por unidade.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPresetModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all active:scale-95"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Insumo do Catálogo</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddManualMaterial}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Material Manual</span>
                </button>
              </div>
            </div>

            {materials.length === 0 ? (
              <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-center space-y-3">
                <PackageOpen className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-700 text-sm">Nenhum material adicionado</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Clique em <strong>"Insumo do Catálogo"</strong> para escolher insumos reais com preço de mercado ou em <strong>"Material Manual"</strong> para digitar o seu.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {materials.map((mat, index) => (
                  <div
                    key={mat.id}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-slate-400">
                        Insumo #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMatToDeleteId(mat.id);
                          setIsDeleteMatModalOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                        title="Excluir insumo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-5">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Nome do Insumo
                        </label>
                        <input
                          type="text"
                          value={mat.name}
                          onChange={(e) => handleUpdateMaterial(mat.id, { name: e.target.value })}
                          className="input-base text-xs py-2 font-medium"
                          placeholder="Ex: Papel Offset 180g Chambril"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <CustomSelect
                          label="Unidade"
                          options={unitOptions}
                          value={mat.unit}
                          onChange={(val) => handleUpdateMaterial(mat.id, { unit: val as MeasurementUnit })}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Preço Compra
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={mat.purchasePrice || ''}
                          onChange={(e) => handleUpdateMaterial(mat.id, { purchasePrice: Number(e.target.value) })}
                          className="input-base text-xs py-2 font-semibold"
                          placeholder="R$ 0,00"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Qtde Pacote
                        </label>
                        <input
                          type="number"
                          min={0.01}
                          step={0.1}
                          value={mat.purchaseQuantity || ''}
                          onChange={(e) => handleUpdateMaterial(mat.id, { purchaseQuantity: Number(e.target.value) })}
                          className="input-base text-xs py-2"
                          placeholder="Ex: 50"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/50 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 font-medium">Quantidade gasta neste serviço:</span>
                        <input
                          type="number"
                          min={0.01}
                          step={0.1}
                          value={mat.usedQuantity || ''}
                          onChange={(e) => handleUpdateMaterial(mat.id, { usedQuantity: Number(e.target.value) })}
                          className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-500"
                          placeholder="1"
                        />
                        <span className="text-slate-500 font-semibold">{mat.unit}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-slate-500 mr-2 text-[11px]">Custo Proporcional:</span>
                        <strong className="text-brand-700 text-sm">
                          {formatCurrency(mat.calculatedCost)}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bloco 4: Tinta e Arte */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Tinta */}
            <div className="card-base p-6 space-y-4">
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                <Printer className="w-4 h-4 text-brand-600" />
                <span>4. Tinta de Impressão</span>
              </h3>

              <div className="flex items-center gap-2">
                <CustomSwitch
                  label="Cobrar por folha impressa"
                  description="Alterna entre custo por folha ou valor fixo total"
                  checked={ink.mode === 'per_sheet'}
                  onChange={(checked) => setInk({ ...ink, mode: checked ? 'per_sheet' : 'per_job' })}
                />
              </div>

              {ink.mode === 'per_sheet' ? (
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                    Custo de tinta por folha (R$)
                  </label>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    value={ink.costPerSheet || ''}
                    onChange={(e) => setInk({ ...ink, costPerSheet: Number(e.target.value) })}
                    className="input-base"
                    placeholder="Ex: 0.15"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Total para {sheetCount} folhas: <strong>{formatCurrency(ink.costPerSheet * sheetCount)}</strong>
                  </span>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                    Valor fixo de tinta no serviço (R$)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={ink.costPerJob || ''}
                    onChange={(e) => setInk({ ...ink, costPerJob: Number(e.target.value) })}
                    className="input-base"
                    placeholder="R$ 0,00"
                  />
                </div>
              )}
            </div>

            {/* Criação da Arte */}
            <div className="card-base p-6 space-y-4">
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-600" />
                <span>5. Criação da Arte</span>
              </h3>

              <div className="flex items-center gap-2">
                <CustomSwitch
                  label="Dividir valor da arte entre folhas"
                  description="Desmarque para cobrar o valor total da arte neste pedido"
                  checked={art.mode === 'shared'}
                  onChange={(checked) => setArt({ ...art, mode: checked ? 'shared' : 'full' })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                    Valor da Arte (R$)
                  </label>
                  <input
                    type="number"
                    step={1}
                    min={0}
                    value={art.totalArtPrice || ''}
                    onChange={(e) => setArt({ ...art, totalArtPrice: Number(e.target.value) })}
                    className="input-base"
                    placeholder="0,00"
                  />
                </div>

                {art.mode === 'shared' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                      Dividir em quantas folhas?
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={art.sheetsCount || ''}
                      onChange={(e) => setArt({ ...art, sheetsCount: Math.max(1, Number(e.target.value)) })}
                      className="input-base"
                      placeholder="1"
                    />
                  </div>
                )}
              </div>

              <span className="text-[11px] text-slate-400 block">
                Custo de arte computado: <strong>{formatCurrency(art.mode === 'full' ? art.totalArtPrice : art.totalArtPrice / Math.max(1, art.sheetsCount))}</strong>
              </span>
            </div>
          </div>

          {/* Bloco 4: Tempo de Trabalho & Mão de Obra */}
          <div className="card-base p-6 space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-600" />
              <span>5. Tempo de Trabalho & Mão de Obra</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                  Tempo Gasto
                </label>
                <input
                  type="number"
                  min={0}
                  value={labor.timeSpent || ''}
                  onChange={(e) => setLabor({ ...labor, timeSpent: Number(e.target.value) })}
                  className="input-base"
                  placeholder="0"
                />
              </div>

              <div>
                <CustomSelect
                  label="Unidade de Tempo"
                  options={[
                    { value: 'minutes', label: 'Minutos' },
                    { value: 'hours', label: 'Horas' },
                  ]}
                  value={labor.timeUnit}
                  onChange={(val) => setLabor({ ...labor, timeUnit: val as 'minutes' | 'hours' })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                  Seu Valor / Hora (R$)
                </label>
                <input
                  type="number"
                  step={1}
                  min={0}
                  value={labor.hourlyRate || ''}
                  onChange={(e) => setLabor({ ...labor, hourlyRate: Number(e.target.value) })}
                  className="input-base font-semibold"
                  placeholder="Ex: 20"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-600">
                Mão de obra ({labor.timeSpent} {labor.timeUnit === 'minutes' ? 'minutos' : 'horas'} a R$ {labor.hourlyRate}/h):
              </span>
              <strong className="text-brand-700 text-sm font-extrabold">
                {formatCurrency(calculationResult.laborCost)}
              </strong>
            </div>
          </div>

          {/* Bloco 5: Outros Custos & Desperdício */}
          <div className="card-base p-6 space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-brand-600" />
              <span>6. Outros Custos & Margem de Perdas</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                  Embalagem
                </label>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={otherCosts.packaging || ''}
                  onChange={(e) => setOtherCosts({ ...otherCosts, packaging: Number(e.target.value) })}
                  className="input-base"
                  placeholder="R$ 0,00"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                  Energia / Manutenção
                </label>
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  value={otherCosts.electricity || ''}
                  onChange={(e) => setOtherCosts({ ...otherCosts, electricity: Number(e.target.value) })}
                  className="input-base"
                  placeholder="R$ 0,00"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                  Perdas / Desperdício (%)
                </label>
                <input
                  type="number"
                  step={1}
                  min={0}
                  max={40}
                  value={waste.percentage || ''}
                  onChange={(e) => setWaste({ percentage: Number(e.target.value) })}
                  className="input-base"
                  placeholder="Ex: 5%"
                />
              </div>
            </div>

            {/* Outros Gastos Dinâmicos */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Outros Gastos Personalizados</span>
                <button
                  type="button"
                  onClick={handleAddCustomExpense}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Outro Gasto</span>
                </button>
              </div>

              {otherCosts.customExpenses.map((exp) => (
                <div key={exp.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={exp.name}
                    onChange={(e) => {
                      const updated = otherCosts.customExpenses.map((item) =>
                        item.id === exp.id ? { ...item, name: e.target.value } : item
                      );
                      setOtherCosts({ ...otherCosts, customExpenses: updated });
                    }}
                    placeholder="Descrição do gasto"
                    className="input-base text-xs py-1.5 flex-1"
                  />
                  <input
                    type="number"
                    step={0.5}
                    value={exp.amount || ''}
                    onChange={(e) => {
                      const updated = otherCosts.customExpenses.map((item) =>
                        item.id === exp.id ? { ...item, amount: Number(e.target.value) } : item
                      );
                      setOtherCosts({ ...otherCosts, customExpenses: updated });
                    }}
                    placeholder="R$ 0,00"
                    className="input-base text-xs py-1.5 w-28"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomExpense(exp.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Bloco 6: Precificação & Campo Opcional de Desconto */}
          <div className="card-base p-6 space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <Percent className="w-4 h-4 text-brand-600" />
              <span>7. Estratégia de Precificação & Desconto</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'margin',
                  title: 'Margem de Lucro',
                  desc: 'Calcula o lucro sobre o preço de venda final',
                },
                {
                  id: 'markup',
                  title: 'Markup sobre o Custo',
                  desc: 'Aplica percentual de acréscimo sobre os custos',
                },
                {
                  id: 'manual',
                  title: 'Preço Manual',
                  desc: 'Você define o preço final e o app mostra a margem',
                },
              ].map((method) => {
                const isSelected = pricing.method === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPricing({ ...pricing, method: method.id as any })}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-100 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-sm">{method.title}</span>
                      {isSelected && <Check className="w-4 h-4 text-brand-600" />}
                    </div>
                    <p className="text-xs text-slate-500 leading-snug">{method.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {pricing.method === 'margin' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                    Margem de Lucro Desejada (%)
                  </label>
                  <input
                    type="number"
                    step={1}
                    min={1}
                    max={90}
                    value={pricing.targetMargin || ''}
                    onChange={(e) => setPricing({ ...pricing, targetMargin: Number(e.target.value) })}
                    className="input-base"
                    placeholder="Ex: 40%"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Fórmula: Preço = Custo / (1 - Margem)
                  </span>
                </div>
              )}

              {pricing.method === 'markup' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                    Markup sobre o Custo (%)
                  </label>
                  <input
                    type="number"
                    step={5}
                    min={0}
                    value={pricing.targetMarkup || ''}
                    onChange={(e) => setPricing({ ...pricing, targetMarkup: Number(e.target.value) })}
                    className="input-base"
                    placeholder="Ex: 70%"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Fórmula: Preço = Custo * (1 + Markup)
                  </span>
                </div>
              )}

              {pricing.method === 'manual' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                    Preço Manual de Venda (R$)
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    value={pricing.manualPrice || ''}
                    onChange={(e) => setPricing({ ...pricing, manualPrice: Number(e.target.value) })}
                    className="input-base font-bold text-brand-700"
                    placeholder="R$ 0,00"
                  />
                </div>
              )}

              {/* Campo Requisitado: Desconto (%) Opcional */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-brand-600" />
                    <span>Desconto (%)</span>
                    <span className="text-[10px] font-normal text-slate-400 capitalize">(opcional)</span>
                  </label>
                  <Tooltip content="Informe uma porcentagem entre 0% e 100%. O desconto será aplicado sobre o preço de venda e o lucro restante será recalculado automaticamente." />
                </div>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  max={100}
                  value={pricing.discountPercent !== undefined ? pricing.discountPercent : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPricing({
                      ...pricing,
                      discountPercent: val === '' ? undefined : Math.max(0, Math.min(100, Number(val))),
                    });
                  }}
                  className="input-base font-semibold text-brand-700"
                  placeholder="0% (deixe vazio para 0%)"
                />
                <span className="text-[11px] text-slate-500 mt-1.5 block leading-tight">
                  {pricing.discountPercent && pricing.discountPercent > 0 ? (
                    <span className="text-emerald-700 font-semibold">
                      Desconto de {pricing.discountPercent}% reduzirá {formatCurrency(calculationResult.discountAmount)} do preço original.
                    </span>
                  ) : (
                    'Nenhum desconto aplicado. O preço de venda permanecerá integral.'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Bloco 7: Faixas de Desconto por Quantidade */}
          <QuantityTiersSection
            tiers={quantityTiers}
            unitCost={calculationResult.unitCost}
            baseUnitPrice={calculationResult.finalUnitPrice}
            onChangeTiers={setQuantityTiers}
          />
        </div>

        {/* Coluna da Direita: Card Fixo de Resumo de Custos e Venda */}
        <div className="lg:col-span-5 xl:col-span-4">
          <CostSummaryCard
            result={calculationResult}
            pricing={pricing}
            sheetCount={sheetCount}
          />
        </div>
      </div>

      {/* Modal de Catálogo de Insumos Reais */}
      {isPresetModalOpen && (
        <CustomModal
          isOpen={isPresetModalOpen}
          onClose={() => setIsPresetModalOpen(false)}
          title="Catálogo de Insumos de Papelaria"
          description="Selecione um insumo para preencher os dados de compra na calculadora:"
          showCancelButton={true}
          cancelText="Fechar"
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Buscar papel, fita, cola..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: 'todos', label: 'Todos' },
                  { id: 'papeis', label: 'Papéis' },
                  { id: 'acessorios', label: 'Acessórios' },
                  { id: 'colas', label: 'Colas' },
                  { id: 'embalagens', label: 'Embalagens' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPresetCategory(c.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      presetCategory === c.id
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredPresets.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPresetMaterial(preset)}
                  className="p-3 rounded-xl border border-slate-100 hover:border-brand-300 hover:bg-brand-50/30 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-slate-800 text-xs group-hover:text-brand-600 transition-colors">
                      {preset.name}
                    </h5>
                    <p className="text-[11px] text-slate-500">{preset.description}</p>
                    <span className="text-[11px] text-brand-700 font-semibold block">
                      Pacote: {formatCurrency(preset.defaultPurchasePrice)} com {preset.defaultPurchaseQuantity} {preset.unit}s
                    </span>
                  </div>

                  <button
                    type="button"
                    className="flex-shrink-0 px-3 py-1.5 bg-brand-50 group-hover:bg-brand-600 text-brand-700 group-hover:text-white rounded-lg font-bold text-xs transition-colors"
                  >
                    Selecionar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </CustomModal>
      )}

      {/* Modal para confirmação de limpeza do formulário */}
      <CustomModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="Limpar Calculadora?"
        description="Tem certeza de que deseja limpar os campos para iniciar um novo cálculo do zero?"
        confirmText="Sim, Limpar Tudo"
        cancelText="Cancelar"
        variant="warning"
        onConfirm={handleResetForm}
      />

      {/* Modal para confirmação de exclusão de material */}
      <CustomModal
        isOpen={isDeleteMatModalOpen}
        onClose={() => {
          setIsDeleteMatModalOpen(false);
          setMatToDeleteId(null);
        }}
        title="Remover Insumo?"
        description="Deseja remover este insumo da lista de materiais do produto?"
        confirmText="Remover"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={confirmDeleteMaterial}
      />
    </div>
  );
}
