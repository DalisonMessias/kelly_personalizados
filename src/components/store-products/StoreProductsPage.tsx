import React, { useMemo, useState } from 'react';
import { 
  Package,
  Search,
  Plus,
  Edit3,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Calculator,
  Settings,
  Tag,
  Clock,
  Image,
} from 'lucide-react';
import {
  PersonalizationOption,
  PersonalizationFieldType,
  ProductCategory,
  ProductService,
  StoreProduct,
  StoreProductAddon,
  StoreProductStatus,
  StoreCategory,
} from '../../types';
import { storeRepository } from '../../services/storeRepository';
import { storageService } from '../../services/storage';
import { formatCurrency } from '../../utils/calculations';
import { CurrencyInput } from '../ui/CurrencyInput';
import { PercentInput } from '../ui/PercentInput';
import { CustomModal } from '../ui/CustomModal';
import { CustomSelect } from '../ui/CustomSelect';
import { CustomSwitch } from '../ui/CustomSwitch';
import { getStoreProductImageUrl, uploadStoreProductImages } from '../../services/storefrontService';
import { useToast } from '../ui/Toast';

interface StoreProductsPageProps {
  onSendToCalculator: (product: ProductService) => void;
}

const categoryLabels: Record<ProductCategory, string> = {
  adesivos: 'Adesivos',
  topo_bolo: 'Topo de bolo',
  lembrancinhas: 'Lembrancinhas',
  etiquetas: 'Etiquetas',
  convites: 'Convites',
  papelaria_festa: 'Papelaria de festa',
  outro: 'Outro',
};

const blankStoreProduct = (): StoreProduct => ({
  id: '',
  name: '',
  publicDescription: '',
  internalDescription: '',
  category: 'outro',
  imageIds: [],
  minimumQuantity: 1,
  productionDeadline: '',
  salePrice: 0,
  marginPercent: 0,
  productionCost: 0,
  laborCost: 0,
  materialCost: 0,
  otherCosts: 0,
  estimatedProductionTime: 0,
  timeUnit: 'minutes',
  status: 'inativo',
  showInFutureStore: false,
  observations: '',
  personalizationOptions: [],
  addons: [],
  createdAt: '',
  updatedAt: '',
});

export function StoreProductsPage({ onSendToCalculator }: StoreProductsPageProps) {
  const { success, warning, error } = useToast();
  const [products, setProducts] = useState<StoreProduct[]>(() => storeRepository.getProducts());
  const [categories, setCategories] = useState<StoreCategory[]>(() => storeRepository.getCategories());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | StoreProductStatus>('todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [editorOpen, setEditorOpen] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [form, setForm] = useState<StoreProduct>(blankStoreProduct());
  const [deleteTarget, setDeleteTarget] = useState<StoreProduct | null>(null);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<StoreCategory | null>(null);

  const adminProducts = storageService.getProducts();

  const filtered = useMemo(() => products.filter((product) => {
    const matchesSearch = `${product.name} ${product.publicDescription} ${product.internalDescription}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || product.status === statusFilter;
    const matchesCategory = categoryFilter === 'todos' || product.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  }), [products, search, statusFilter, categoryFilter]);

  const openEditor = (product?: StoreProduct) => {
    setForm(product ? JSON.parse(JSON.stringify(product)) : blankStoreProduct());
    setEditorOpen(true);
  };

  const handleUploadImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;
    if (!form.id || !products.some((product) => product.id === form.id)) {
      warning('Salve o produto primeiro', 'Depois, abra novamente o cadastro para adicionar as fotos.');
      return;
    }

    setUploadingImages(true);
    try {
      const imageIds = await uploadStoreProductImages(form.id, files);
      setForm((current) => ({ ...current, imageIds: [...current.imageIds, ...imageIds] }));
      success('Fotos enviadas', 'Salve o produto para publicar as imagens na loja.');
    } catch (cause) {
      error('Não foi possível enviar as fotos', cause instanceof Error ? cause.message : 'Confira os arquivos e tente novamente.');
    } finally {
      setUploadingImages(false);
    }
  };

  const saveProduct = () => {
    if (uploadingImages) { warning('Aguarde o envio', 'As fotos ainda estão sendo enviadas.'); return; }
    if (!form.name.trim()) {
      warning('Informe o nome', 'O nome do produto é obrigatório.');
      return;
    }

    const now = new Date().toISOString();
    const normalized: StoreProduct = {
      ...form,
      id: form.id || `store-product-${Date.now()}`,
      name: form.name.trim(),
      publicDescription: form.publicDescription.trim(),
      internalDescription: form.internalDescription.trim(),
      createdAt: form.createdAt || now,
      updatedAt: now,
    };

    const updated = storeRepository.saveProduct(normalized);
    setProducts(updated);
    setEditorOpen(false);
    success(form.id ? 'Produto atualizado!' : 'Produto criado!', `${normalized.name} foi salvo no catálogo da loja virtual.`);
  };

  const duplicateProduct = (product: StoreProduct) => {
    const duplicate = storeRepository.duplicateProduct(product.id);
    if (duplicate) {
      setProducts(storeRepository.getProducts());
      success('Produto duplicado!', `${duplicate.name} foi criado como rascunho.`);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setProducts(storeRepository.deleteProduct(deleteTarget.id));
    setDeleteTarget(null);
    success('Produto excluído', 'A versão do catálogo futuro foi removida.');
  };

  const createFromAdminProduct = (source: ProductService) => {
    const now = new Date().toISOString();
    const result = source.calculationResult;
    openEditor({
      ...blankStoreProduct(),
      id: '',
      name: source.name,
      publicDescription: source.description || '',
      internalDescription: '',
      category: source.category,
      linkedServiceId: source.id,
      minimumQuantity: source.sheetCount || 1,
      productionDeadline: '',
      salePrice: result?.finalSalePrice || 0,
      marginPercent: result?.profitMarginPercent || 0,
      productionCost: result?.totalServiceCost || 0,
      laborCost: result?.laborCost || 0,
      materialCost: result?.materialsCost || 0,
      otherCosts: result?.otherCosts || 0,
      estimatedProductionTime: source.labor?.timeSpent || 0,
      timeUnit: source.labor?.timeUnit || 'minutes',
      status: 'inativo',
      showInFutureStore: false,
      createdAt: now,
      updatedAt: now,
    });
  };

  const sendToCalculator = (storeProduct: StoreProduct) => {
    const source = adminProducts.find((product) => product.id === storeProduct.linkedServiceId);
    if (source) {
      onSendToCalculator(JSON.parse(JSON.stringify(source)));
      return;
    }

    const now = new Date().toISOString();
    onSendToCalculator({
      id: `store-link-${storeProduct.id}`,
      name: storeProduct.name,
      category: storeProduct.category,
      description: storeProduct.publicDescription,
      sheetCount: storeProduct.minimumQuantity,
      createdAt: now,
      updatedAt: now,
      simpleMaterials: [],
      materials: [],
      ink: { mode: 'per_job', costPerSheet: 0, costPerJob: 0, sheetCount: storeProduct.minimumQuantity },
      art: { mode: 'full', totalArtPrice: 0, sheetsCount: 1 },
      labor: { hourlyRate: 0, timeSpent: storeProduct.estimatedProductionTime, timeUnit: storeProduct.timeUnit },
      otherCosts: { packaging: 0, electricity: 0, printing: 0, finishing: 0, customExpenses: [] },
      waste: { percentage: 0 },
      pricing: { method: 'manual', targetMargin: storeProduct.marginPercent, targetMarkup: 0, manualPrice: storeProduct.salePrice },
      quantityTiers: [],
      calculationResult: {
        materialsCost: storeProduct.materialCost,
        inkCost: 0,
        artCost: 0,
        laborCost: storeProduct.laborCost,
        otherCosts: storeProduct.otherCosts,
        subtotalCost: storeProduct.productionCost,
        wasteCost: 0,
        totalServiceCost: storeProduct.productionCost,
        totalSheetsOrUnits: storeProduct.minimumQuantity,
        unitCost: storeProduct.minimumQuantity ? storeProduct.productionCost / storeProduct.minimumQuantity : storeProduct.productionCost,
        originalSalePrice: storeProduct.salePrice,
        originalUnitPrice: storeProduct.minimumQuantity ? storeProduct.salePrice / storeProduct.minimumQuantity : storeProduct.salePrice,
        discountPercent: 0,
        discountAmount: 0,
        finalSalePrice: storeProduct.salePrice,
        finalUnitPrice: storeProduct.minimumQuantity ? storeProduct.salePrice / storeProduct.minimumQuantity : storeProduct.salePrice,
        estimatedProfit: storeProduct.salePrice - storeProduct.productionCost,
        profitMarginPercent: storeProduct.marginPercent,
        markupPercent: 0,
      },
    });
  };

  const addPersonalization = () => {
    setForm((current) => ({
      ...current,
      personalizationOptions: [...current.personalizationOptions, storeRepository.createPersonalizationOption()],
    }));
  };

  const updatePersonalization = (id: string, updates: Partial<PersonalizationOption>) => {
    setForm((current) => ({
      ...current,
      personalizationOptions: current.personalizationOptions.map((option) => option.id === id ? { ...option, ...updates } : option),
    }));
  };

  const removePersonalization = (id: string) => {
    setForm((current) => ({
      ...current,
      personalizationOptions: current.personalizationOptions.filter((option) => option.id !== id),
    }));
  };

  const addAddon = () => {
    setForm((current) => ({
      ...current,
      addons: [...current.addons, storeRepository.createAddon()],
    }));
  };

  const updateAddon = (id: string, updates: Partial<StoreProductAddon>) => {
    setForm((current) => ({
      ...current,
      addons: current.addons.map((addon) => addon.id === id ? { ...addon, ...updates } : addon),
    }));
  };

  const removeAddon = (id: string) => {
    setForm((current) => ({
      ...current,
      addons: current.addons.filter((addon) => addon.id !== id),
    }));
  };

  const saveCategory = () => {
    if (!categoryName.trim()) {
      warning('Informe a categoria', 'Digite um nome para a categoria.');
      return;
    }
    const now = new Date().toISOString();
    const normalized: StoreCategory = {
      id: editingCategory?.id || `store-category-${Date.now()}`,
      name: categoryName.trim(),
      active: true,
      createdAt: editingCategory?.createdAt || now,
      updatedAt: now,
    };
    setCategories(storeRepository.saveCategory(normalized));
    setCategoryEditorOpen(false);
    setEditingCategory(null);
    setCategoryName('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-pink-100 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Catálogo de Produtos</h2>
          <p className="text-xs text-slate-500 mt-1">Organização comercial preparada para uma futura loja virtual.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setEditingCategory(null); setCategoryName(''); setCategoryEditorOpen(true); }} className="px-4 py-2.5 rounded-xl border border-pink-200 bg-pink-50 text-brand-700 font-bold text-xs">Nova categoria</button>
          <button type="button" onClick={() => openEditor()} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md"><Plus className="w-4 h-4" />Novo produto</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto ou descrição..." className="input-base pl-10" />
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'todos' | StoreProductStatus)} className="input-base sm:col-span-3">
          <option value="todos">Todos os status</option><option value="ativo">Ativo</option><option value="inativo">Inativo</option>
        </select>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="input-base sm:col-span-3">
          <option value="todos">Todas as categorias</option>
          {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          {categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </div>

      {adminProducts.length > 0 && (
        <div className="card-base p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><h3 className="text-sm font-black text-slate-800">Criar catálogo a partir da calculadora</h3><p className="text-xs text-slate-500">Reutilize um serviço já calculado sem misturar histórico e catálogo futuro.</p></div>
          <select className="input-base sm:max-w-xs" defaultValue="" onChange={(event) => { const source = adminProducts.find((product) => product.id === event.target.value); if (source) createFromAdminProduct(source); event.target.value = ''; }}>
            <option value="" disabled>Selecione um produto calculado</option>
            {adminProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center"><Package className="w-10 h-10 text-pink-200 mx-auto mb-3" /><h3 className="font-black text-slate-800">Nenhum produto cadastrado</h3><p className="text-xs text-slate-500 mt-1">Cadastre um novo produto ou reutilize um cálculo existente.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((product) => (
            <div key={product.id} className="card-base p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 truncate">{product.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{product.publicDescription || 'Sem descrição pública.'}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${product.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{product.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-pink-50 border border-pink-100"><span className="text-slate-500 block">Preço</span><strong className="text-brand-700">{formatCurrency(product.salePrice)}</strong></div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100"><span className="text-slate-500 block">Loja futura</span><strong className="text-slate-700">{product.showInFutureStore ? 'Exibir' : 'Oculto'}</strong></div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-pink-100">
                <div className="flex gap-1">
                  <button type="button" onClick={() => openEditor(product)} className="p-2 rounded-lg text-slate-500 hover:bg-pink-50" title="Editar"><Edit3 className="w-4 h-4" /></button>
                  <button type="button" onClick={() => duplicateProduct(product)} className="p-2 rounded-lg text-slate-500 hover:bg-pink-50" title="Duplicar"><Copy className="w-4 h-4" /></button>
                  <button type="button" onClick={() => sendToCalculator(product)} className="p-2 rounded-lg text-brand-700 hover:bg-pink-50" title="Enviar à calculadora"><Calculator className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setDeleteTarget(product)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                </div>
                <span className="text-[11px] text-slate-400">{product.personalizationOptions.length} opções • {product.addons.length} adicionais</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {editorOpen && (
        <CustomModal isOpen={editorOpen} onClose={() => setEditorOpen(false)} title={form.id ? 'Editar produto' : 'Novo produto'} confirmText="Salvar produto" onConfirm={saveProduct}>
          <div className="space-y-5 max-h-[72vh] overflow-y-auto pr-1">
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-brand-700">Dados comerciais</h3>
              <div><label className="text-xs font-bold text-slate-700">Nome do produto</label><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="input-base mt-1" /></div>
              <div><label className="text-xs font-bold text-slate-700">Descrição pública</label><textarea value={form.publicDescription} onChange={(event) => setForm({ ...form, publicDescription: event.target.value })} className="input-base mt-1" rows={3} /></div>
              <section className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><h4 className="text-xs font-black uppercase tracking-wide text-slate-700">Galeria de imagens</h4><p className="mt-1 text-xs text-slate-500">Fotos públicas do produto · PNG, JPG ou WEBP · até 8 MB cada.</p></div>
                  <label className={uploadingImages ? 'inline-flex min-h-10 pointer-events-none items-center justify-center gap-2 rounded-xl border border-pink-200 bg-white px-3 text-xs font-bold text-pink-700 opacity-60' : 'inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-pink-200 bg-white px-3 text-xs font-bold text-pink-700 transition hover:bg-pink-50'}>
                    <Image className="h-4 w-4" />{uploadingImages ? 'Enviando...' : 'Adicionar fotos'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploadingImages} onChange={handleUploadImages} className="sr-only" />
                  </label>
                </div>
                {!products.some((product) => product.id === form.id) && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-amber-700">Salve o produto e abra novamente o cadastro para liberar o envio de fotos.</p>}
                {form.imageIds.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{form.imageIds.map((imageId) => { const imageUrl = getStoreProductImageUrl(form.id, imageId); return <div key={imageId} className="relative aspect-square overflow-hidden rounded-xl border border-rose-100 bg-white">{imageUrl && <img src={imageUrl} alt="Foto do produto" className="h-full w-full object-cover" />}<button type="button" onClick={() => setForm((current) => ({ ...current, imageIds: current.imageIds.filter((id) => id !== imageId) }))} className="absolute inset-x-1 bottom-1 rounded-lg bg-white/95 px-2 py-1.5 text-[10px] font-bold text-rose-700 shadow" title="Remover da galeria">Remover da galeria</button></div>; })}</div>}
              </section>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-bold text-slate-700">Categoria</label><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ProductCategory })} className="input-base mt-1"><option value="outro">Outro</option>{Object.entries(categoryLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                <div><label className="text-xs font-bold text-slate-700">Quantidade mínima</label><input type="number" min={1} value={form.minimumQuantity} onChange={(event) => setForm({ ...form, minimumQuantity: Math.max(1, Number(event.target.value)) })} className="input-base mt-1" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-bold text-slate-700">Preço de venda</label><CurrencyInput value={form.salePrice} onChange={(value) => setForm({ ...form, salePrice: value })} className="input-base mt-1" /></div>
                <div><label className="text-xs font-bold text-slate-700">Margem</label><PercentInput value={form.marginPercent} onChange={(value) => setForm({ ...form, marginPercent: value || 0 })} className="input-base pr-10 mt-1" /></div>
              </div>
              <div><label className="text-xs font-bold text-slate-700">Prazo de produção</label><input value={form.productionDeadline} onChange={(event) => setForm({ ...form, productionDeadline: event.target.value })} className="input-base mt-1" placeholder="Ex: 3 a 5 dias úteis" /></div>
            </section>

            <section className="space-y-3 pt-4 border-t border-pink-100">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Dados internos</h3>
              <div><label className="text-xs font-bold text-slate-700">Descrição administrativa</label><textarea value={form.internalDescription} onChange={(event) => setForm({ ...form, internalDescription: event.target.value })} className="input-base mt-1" rows={2} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-bold text-slate-700">Custo de materiais</label><CurrencyInput value={form.materialCost} onChange={(value) => setForm({ ...form, materialCost: value })} className="input-base mt-1" /></div>
                <div><label className="text-xs font-bold text-slate-700">Mão de obra</label><CurrencyInput value={form.laborCost} onChange={(value) => setForm({ ...form, laborCost: value })} className="input-base mt-1" /></div>
                <div><label className="text-xs font-bold text-slate-700">Custo de produção</label><CurrencyInput value={form.productionCost} onChange={(value) => setForm({ ...form, productionCost: value })} className="input-base mt-1" /></div>
                <div><label className="text-xs font-bold text-slate-700">Outras despesas</label><CurrencyInput value={form.otherCosts} onChange={(value) => setForm({ ...form, otherCosts: value })} className="input-base mt-1" /></div>
              </div>
              <div><label className="text-xs font-bold text-slate-700">Observações internas</label><textarea value={form.observations} onChange={(event) => setForm({ ...form, observations: event.target.value })} className="input-base mt-1" rows={2} /></div>
            </section>

            <section className="space-y-3 pt-4 border-t border-pink-100">
              <div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Personalizações</h3><button type="button" onClick={addPersonalization} className="text-xs font-bold text-brand-700">+ Adicionar opção</button></div>
              {form.personalizationOptions.map((option) => (
                <div key={option.id} className="p-3 rounded-xl border border-pink-100 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input value={option.name} onChange={(event) => updatePersonalization(option.id, { name: event.target.value })} placeholder="Nome da opção" className="input-base" />
                    <select value={option.type} onChange={(event) => updatePersonalization(option.id, { type: event.target.value as PersonalizationFieldType })} className="input-base"><option value="texto">Texto</option><option value="numero">Número</option><option value="selecao">Seleção</option><option value="multipla_escolha">Múltipla escolha</option><option value="sim_nao">Sim/não</option></select>
                  </div>
                  {(option.type === 'selecao' || option.type === 'multipla_escolha') && <input value={option.values.join(', ')} onChange={(event) => updatePersonalization(option.id, { values: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} placeholder="Valores separados por vírgula" className="input-base" />}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                    <CurrencyInput value={option.priceAdjustment} onChange={(value) => updatePersonalization(option.id, { priceAdjustment: value })} className="input-base" />
                    <CustomSwitch label="Obrigatória" checked={option.required} onChange={(checked) => updatePersonalization(option.id, { required: checked })} />
                    <button type="button" onClick={() => removePersonalization(option.id)} className="text-xs font-bold text-rose-600">Remover</button>
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-3 pt-4 border-t border-pink-100">
              <div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Adicionais</h3><button type="button" onClick={addAddon} className="text-xs font-bold text-brand-700">+ Adicionar adicional</button></div>
              {form.addons.map((addon) => (
                <div key={addon.id} className="p-3 rounded-xl border border-pink-100 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><input value={addon.name} onChange={(event) => updateAddon(addon.id, { name: event.target.value })} placeholder="Nome do adicional" className="input-base" /><CurrencyInput value={addon.price} onChange={(value) => updateAddon(addon.id, { price: value })} className="input-base" /></div>
                  <textarea value={addon.description} onChange={(event) => updateAddon(addon.id, { description: event.target.value })} placeholder="Descrição" className="input-base" rows={2} />
                  <div className="flex items-center justify-between"><CustomSwitch label="Ativo" checked={addon.active} onChange={(checked) => updateAddon(addon.id, { active: checked })} /><button type="button" onClick={() => removeAddon(addon.id)} className="text-xs font-bold text-rose-600">Remover</button></div>
                </div>
              ))}
            </section>

            <section className="pt-4 border-t border-pink-100 space-y-3">
              <CustomSwitch label="Ativo no sistema" checked={form.status === 'ativo'} onChange={(checked) => setForm({ ...form, status: checked ? 'ativo' : 'inativo' })} />
              <CustomSwitch label="Exibir na loja virtual" checked={form.showInFutureStore} onChange={(checked) => setForm({ ...form, showInFutureStore: checked })} />
            </section>
          </div>
        </CustomModal>
      )}

      <CustomModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir produto?" description="A versão do catálogo futuro será removida; os cálculos históricos não serão alterados." confirmText="Excluir" variant="danger" onConfirm={confirmDelete} />

      {categoryEditorOpen && (
        <CustomModal isOpen={categoryEditorOpen} onClose={() => setCategoryEditorOpen(false)} title={editingCategory ? 'Editar categoria' : 'Nova categoria'} confirmText="Salvar categoria" onConfirm={saveCategory}>
          <div><label className="text-xs font-bold text-slate-700">Nome da categoria</label><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} className="input-base mt-1" /></div>
        </CustomModal>
      )}
    </div>
  );
}
