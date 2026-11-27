import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, ImagePlus, LoaderCircle, Search, ShoppingBag, Sparkles, Tag } from 'lucide-react';
import { CustomModal } from '../ui/CustomModal';
import { CustomNumberInput } from '../ui/CustomNumberInput';
import { useToast } from '../ui/Toast';
import {
  createStorefrontRequestId,
  getStoreProductImageUrl,
  getStorefrontCatalog,
  MAX_STORE_REFERENCE_SIZE,
  StorefrontProduct,
  submitStorefrontOrder,
  uploadStorefrontReference,
} from '../../services/storefrontService';
import { customQuotePath, productDetailPath, productOrderPath, resolveStorefrontRoute, STORE_ROUTES } from '../../routes';
import { CustomQuoteRequestForm } from './CustomQuoteRequestForm';

interface StorefrontPageProps {
  pathname: string;
  search: string;
  onNavigate: (path: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  adesivos: 'Adesivos', topo_bolo: 'Topo de bolo', lembrancinhas: 'Lembrancinhas', etiquetas: 'Etiquetas',
  convites: 'Convites', papelaria_festa: 'Papelaria para festa', outro: 'Outros',
};

function currency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function unitEstimate(product: StorefrontProduct): number | null {
  if (product.salePrice === null || product.salePrice <= 0) return null;
  return Math.round((product.salePrice / Math.max(1, product.minimumQuantity)) * 100) / 100;
}

function ProductImage({ product, className = '' }: { product: StorefrontProduct; className?: string }) {
  const imageUrl = product.imageIds.map((imageId) => getStoreProductImageUrl(product.id, imageId)).find(Boolean);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [imageUrl]);
  return (
    <div className={`relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-rose-100 via-pink-50 to-orange-50 ${className}`}>
      {imageUrl && !imageFailed ? <img src={imageUrl} alt={product.name} className="absolute inset-0 h-full w-full object-cover" onError={() => setImageFailed(true)} /> : null}
      {(!imageUrl || imageFailed) && <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-rose-300"><ShoppingBag className="h-12 w-12" /></div>}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-900/20 to-transparent" />
    </div>
  );
}

export function StorefrontPage({ pathname, search, onNavigate }: StorefrontPageProps) {
  const { success, error } = useToast();
  const [catalog, setCatalog] = useState<{ products: StorefrontProduct[]; categories: Array<{ id: string; name: string }> }>({ products: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [loadMessage, setLoadMessage] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [orderConfirmation, setOrderConfirmation] = useState<{ orderNumber: string; estimatedTotal: number | null; referenceUploaded: boolean } | null>(null);
  const route = resolveStorefrontRoute(pathname, search);
  const selectedProduct = catalog.products.find((product) => product.id === (route.productId || route.orderProductId)) || null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    getStorefrontCatalog()
      .then((result) => {
        if (!active) return;
        setCatalog(result);
        setLoadMessage('');
      })
      .catch(() => {
        if (!active) return;
        setLoadMessage('Não foi possível carregar os produtos agora. Atualize a página ou tente novamente em instantes.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setOrderConfirmation(null);
  }, [pathname, search]);

  const categories = useMemo(() => {
    const fromProducts = catalog.products.map((product) => product.category);
    const fromSettings = catalog.categories.map((category) => category.id);
    return Array.from(new Set([...fromSettings, ...fromProducts]));
  }, [catalog]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return catalog.products.filter((product) => {
      const matchesQuery = !normalized || `${product.name} ${product.publicDescription} ${CATEGORY_LABELS[product.category] || product.category}`.toLocaleLowerCase('pt-BR').includes(normalized);
      return matchesQuery && (categoryFilter === 'todos' || product.category === categoryFilter);
    });
  }, [catalog.products, query, categoryFilter]);

  const goToCatalog = () => onNavigate(STORE_ROUTES.catalog);
  const goToProduct = (product: StorefrontProduct) => onNavigate(productDetailPath(product.name, product.id));

  return (
    <div className="min-h-screen bg-[#fffafc] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-rose-100/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button type="button" onClick={goToCatalog} className="flex items-center gap-3 text-left" aria-label="Ir ao catálogo">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-600 to-rose-400 text-white shadow-lg shadow-pink-500/20"><Sparkles className="h-5 w-5" /></span>
            <span><strong className="block text-sm font-black tracking-tight">Kelly Personalizados</strong><small className="block text-[11px] font-semibold text-pink-600">Feito com carinho para você</small></span>
          </button>
          <nav className="flex items-center gap-2 sm:gap-5">
            <button type="button" onClick={goToCatalog} className="hidden text-sm font-semibold text-slate-600 hover:text-pink-700 sm:block">Produtos</button>
            <button type="button" onClick={() => onNavigate(customQuotePath())} className="shrink-0 rounded-xl bg-pink-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-pink-700 sm:px-4 sm:text-sm"><span className="sm:hidden">Orçamento</span><span className="hidden sm:inline">Orçamento personalizado</span></button>
            <button type="button" onClick={() => onNavigate(STORE_ROUTES.adminLogin)} className="shrink-0 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50 sm:px-4 sm:text-sm"><span className="sm:hidden">Admin</span><span className="hidden sm:inline">Acesso administrativo</span></button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        {route.isCustomQuotePage ? (
          <CustomQuoteRequestForm products={catalog.products} initialProductId={route.quoteProductId} onBack={goToCatalog} />
        ) : route.isOrderPage && selectedProduct ? (
          <OrderRequestForm product={selectedProduct} onBack={() => goToProduct(selectedProduct)} onSubmitted={(result) => { setOrderConfirmation(result); success('Solicitação registrada', `Seu protocolo é ${result.orderNumber}.`); }} onError={(message) => error('Não foi possível enviar', message)} />
        ) : route.isOrderPage && !loading ? (
          <EmptyMessage title="Produto não encontrado" description="Esse produto não está disponível para solicitação." onBack={goToCatalog} />
        ) : route.isProductPage && selectedProduct ? (
          <ProductDetails product={selectedProduct} onBack={goToCatalog} onOrder={() => onNavigate(productOrderPath(selectedProduct.id))} onCustomQuote={() => onNavigate(customQuotePath(selectedProduct.id))} />
        ) : route.isProductPage && !loading ? (
          <EmptyMessage title="Produto não encontrado" description="Esse produto pode ter sido removido ou não está mais publicado." onBack={goToCatalog} />
        ) : (
          <CatalogHome
            products={filteredProducts}
            categories={categories}
            loading={loading}
            loadMessage={loadMessage}
            query={query}
            categoryFilter={categoryFilter}
            onQueryChange={setQuery}
            onCategoryChange={setCategoryFilter}
            onProductClick={goToProduct}
            onCustomQuote={() => onNavigate(customQuotePath())}
            onRetry={() => { setLoading(true); setLoadMessage(''); void getStorefrontCatalog().then(setCatalog).catch(() => setLoadMessage('Não foi possível carregar os produtos agora.')).finally(() => setLoading(false)); }}
          />
        )}
      </main>

      {orderConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-[2rem] border border-rose-100 bg-white p-7 text-center shadow-2xl" role="dialog" aria-modal="true">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-7 w-7" /></span>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Solicitação recebida</p>
            <h2 className="mt-2 text-2xl font-black">Obrigada pelo pedido!</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Seu número de protocolo é <strong className="text-slate-900">{orderConfirmation.orderNumber}</strong>. A Kelly vai analisar os detalhes e entrar em contato pelo WhatsApp informado.</p>
            {orderConfirmation.estimatedTotal !== null && <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-900">Estimativa inicial: <strong>{currency(orderConfirmation.estimatedTotal)}</strong>. O valor final será confirmado após a análise.</p>}
            {orderConfirmation.estimatedTotal === null && <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Este pedido precisa de orçamento. A equipe confirmará o valor pelo WhatsApp.</p>}
            {!orderConfirmation.referenceUploaded && <p className="mt-3 text-xs text-amber-700">A solicitação foi salva; a imagem de referência não pôde ser enviada. Você poderá encaminhá-la depois pelo WhatsApp.</p>}
            <button type="button" onClick={() => { setOrderConfirmation(null); onNavigate(STORE_ROUTES.catalog); }} className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-pink-600 px-5 text-sm font-bold text-white shadow-lg shadow-pink-600/20 transition hover:bg-pink-700">Voltar ao catálogo</button>
          </section>
        </div>
      )}

      <footer className="border-t border-rose-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-7 text-center text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Kelly Personalizados · Peças criadas especialmente para você.</span>
          <button type="button" onClick={() => onNavigate(STORE_ROUTES.adminLogin)} className="font-semibold text-slate-500 hover:text-pink-700">Área administrativa</button>
        </div>
      </footer>
    </div>
  );
}

function CatalogHome({
  products, categories, loading, loadMessage, query, categoryFilter, onQueryChange, onCategoryChange, onProductClick, onCustomQuote, onRetry,
}: {
  products: StorefrontProduct[];
  categories: string[];
  loading: boolean;
  loadMessage: string;
  query: string;
  categoryFilter: string;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onProductClick: (product: StorefrontProduct) => void;
  onCustomQuote: () => void;
  onRetry: () => void;
}) {
  return (
    <>
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-rose-100 via-pink-50 to-orange-50 px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
        <div aria-hidden="true" className="absolute -right-10 -top-16 h-72 w-72 rounded-full bg-white/50 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-pink-700"><Sparkles className="h-3.5 w-3.5" /> Papelaria personalizada</span>
          <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">Detalhes que deixam sua comemoração inesquecível.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">Explore os produtos da Kelly Personalizados e peça uma criação com o seu tema, suas cores e o seu jeito.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 text-sm font-bold text-white shadow-lg shadow-pink-600/20 transition hover:-translate-y-0.5 hover:bg-pink-700">Ver produtos <ArrowRight className="h-4 w-4" /></button><button type="button" onClick={onCustomQuote} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white bg-white/80 px-5 text-sm font-bold text-pink-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"><Sparkles className="h-4 w-4" /> Criar algo personalizado</button></div>
        </div>
      </section>

      <section id="catalogo" className="pt-12 sm:pt-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-pink-600">Catálogo</p><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Encontre sua próxima ideia</h2></div>
          <span className="text-sm text-slate-500">{products.length} {products.length === 1 ? 'produto disponível' : 'produtos disponíveis'}</span>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label className="relative block flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar produtos..." className="input-base pl-10" aria-label="Buscar produtos" /></label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onCategoryChange('todos')} aria-pressed={categoryFilter === 'todos'} className={`rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${categoryFilter === 'todos' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-pink-200 hover:text-pink-700'}`}>Todos</button>
            {categories.map((category) => <button key={category} type="button" onClick={() => onCategoryChange(category)} aria-pressed={categoryFilter === category} className={`rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${categoryFilter === category ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-pink-200 hover:text-pink-700'}`}>{CATEGORY_LABELS[category] || category}</button>)}
          </div>
        </div>

        {loading ? <div className="grid min-h-52 place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-pink-600" /></div>
          : loadMessage ? <div className="mt-8 rounded-2xl border border-rose-100 bg-white p-8 text-center"><p className="text-sm text-slate-600">{loadMessage}</p><button type="button" onClick={onRetry} className="mt-4 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white">Tentar novamente</button></div>
          : products.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-rose-200 bg-white/70 px-5 py-14 text-center"><ShoppingBag className="mx-auto h-9 w-9 text-rose-300" /><h3 className="mt-4 text-lg font-bold">Nenhum produto encontrado</h3><p className="mt-1 text-sm text-slate-500">Tente outra busca ou volte em breve para conferir as novidades.</p></div>
          : <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <ProductCard key={product.id} product={product} onClick={() => onProductClick(product)} />)}</div>}
      </section>
    </>
  );
}

function ProductCard({ product, onClick }: { product: StorefrontProduct; onClick: () => void }) {
  const price = unitEstimate(product);
  return (
    <article className="group overflow-hidden rounded-[1.5rem] border border-rose-100 bg-white p-3 shadow-[0_8px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(190,24,93,0.11)]">
      <button type="button" onClick={onClick} className="w-full text-left">
        <ProductImage product={product} className="aspect-[4/3] transition duration-500 group-hover:scale-[1.01]" />
        <div className="px-2 pb-2 pt-4">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-pink-600"><Tag className="h-3 w-3" />{CATEGORY_LABELS[product.category] || product.category}</span>
          <h3 className="mt-2 line-clamp-1 text-lg font-extrabold tracking-tight text-slate-900">{product.name}</h3>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{product.publicDescription || 'Uma criação feita especialmente para o seu momento.'}</p>
          <div className="mt-4 flex items-end justify-between gap-2"><span>{price === null ? <strong className="text-sm font-bold text-pink-700">Peça um orçamento</strong> : <><small className="block text-[10px] font-semibold text-slate-400">estimativa por unidade</small><strong className="text-base font-black text-slate-900">{currency(price)}</strong></>}</span><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-pink-700 transition group-hover:bg-pink-600 group-hover:text-white"><ArrowRight className="h-4 w-4" /></span></div>
        </div>
      </button>
    </article>
  );
}

function ProductDetails({ product, onBack, onOrder, onCustomQuote }: { product: StorefrontProduct; onBack: () => void; onOrder: () => void; onCustomQuote: () => void }) {
  const [activeImage, setActiveImage] = useState(0);
  const imageUrls = product.imageIds.map((id) => ({ id, url: getStoreProductImageUrl(product.id, id) })).filter((item): item is { id: string; url: string } => Boolean(item.url));
  const price = unitEstimate(product);
  return (
    <section>
      <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-pink-700"><ArrowLeft className="h-4 w-4" /> Voltar ao catálogo</button>
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <ProductImage product={{ ...product, imageIds: imageUrls.length ? [imageUrls[activeImage]?.id || imageUrls[0].id] : [] }} className="aspect-square max-h-[620px]" />
          {imageUrls.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto">{imageUrls.map((image, index) => <button key={image.id} type="button" onClick={() => setActiveImage(index)} aria-label={`Ver foto ${index + 1}`} aria-pressed={activeImage === index} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${activeImage === index ? 'border-pink-500' : 'border-transparent'}`}><img src={image.url} alt="" className="h-full w-full object-cover" /></button>)}</div>}
        </div>
        <div className="py-1 sm:py-4">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-pink-600">{CATEGORY_LABELS[product.category] || product.category}</span>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{product.name}</h1>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base">{product.publicDescription || 'Uma criação feita especialmente para o seu momento.'}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-rose-100 bg-white p-4"><span className="flex items-center gap-2 text-xs font-bold text-slate-500"><ShoppingBag className="h-4 w-4 text-pink-600" /> Quantidade mínima</span><strong className="mt-2 block text-lg font-black">{product.minimumQuantity} unidades</strong></div>
            <div className="rounded-2xl border border-rose-100 bg-white p-4"><span className="flex items-center gap-2 text-xs font-bold text-slate-500"><Clock3 className="h-4 w-4 text-pink-600" /> Prazo de produção</span><strong className="mt-2 block text-lg font-black">{product.productionDeadline || 'A combinar'}</strong></div>
          </div>
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-rose-100">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{price === null ? 'Preço sob consulta' : 'Estimativa por unidade'}</span>
            <strong className="mt-1 block text-3xl font-black text-pink-700">{price === null ? 'Solicite um orçamento' : currency(price)}</strong>
            {price !== null && <p className="mt-1 text-xs leading-5 text-slate-500">Estimativa calculada com base na quantidade mínima. O valor final será confirmado pela equipe.</p>}
          </div>
          {product.personalizationOptions.length > 0 && <div className="mt-5"><h2 className="text-sm font-extrabold">Personalize do seu jeito</h2><div className="mt-2 flex flex-wrap gap-2">{product.personalizationOptions.map((option) => <span key={option.id} className="rounded-full border border-rose-100 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{option.name}</span>)}</div></div>}
          <button type="button" onClick={onOrder} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 text-sm font-bold text-white shadow-lg shadow-pink-600/20 transition hover:-translate-y-0.5 hover:bg-pink-700">Solicitar este produto <ArrowRight className="h-4 w-4" /></button>
          <button type="button" onClick={onCustomQuote} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-pink-200 bg-white px-5 text-sm font-bold text-pink-700 transition hover:bg-pink-50"><Sparkles className="h-4 w-4" /> Pedir uma versão personalizada</button>
          <p className="mt-3 text-center text-xs text-slate-400">Sem cadastro. Você receberá o retorno pelo WhatsApp.</p>
        </div>
      </div>
    </section>
  );
}

function OrderRequestForm({ product, onBack, onSubmitted, onError }: {
  product: StorefrontProduct;
  onBack: () => void;
  onSubmitted: (result: { orderNumber: string; estimatedTotal: number | null; referenceUploaded: boolean }) => void;
  onError: (message: string) => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [quantity, setQuantity] = useState(Math.max(1, product.minimumQuantity));
  const [answers, setAnswers] = useState<Record<string, string | string[] | boolean>>({});
  const [customerText, setCustomerText] = useState('');
  const [themeColors, setThemeColors] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!referenceFile) { setPreviewUrl(''); return; }
    const objectUrl = URL.createObjectURL(referenceFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [referenceFile]);

  const baseUnitPrice = unitEstimate(product);
  const addonUnitPrice = product.addons.filter((addon) => selectedAddons.includes(addon.id)).reduce((total, addon) => total + addon.price, 0);
  const personalizationUnitAdjustment = product.personalizationOptions
    .filter((option) => {
      const answer = answers[option.id];
      if (answer === undefined) return false;
      if (option.type === 'sim_nao') return answer === true;
      return Array.isArray(answer) ? answer.length > 0 : answer !== '';
    })
    .reduce((total, option) => total + option.priceAdjustment, 0);
  const estimatedTotal = baseUnitPrice === null ? null : Math.max(0, Math.round((baseUnitPrice + addonUnitPrice + personalizationUnitAdjustment) * 100) / 100) * quantity;

  const updateAnswer = (id: string, value: string | string[] | boolean) => setAnswers((current) => ({ ...current, [id]: value }));
  const toggleAddon = (id: string) => setSelectedAddons((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const validate = (): boolean => {
    if (customerName.trim().length < 2) { onError('Informe seu nome completo.'); return false; }
    const digits = whatsapp.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) { onError('Informe um número de WhatsApp válido com DDD.'); return false; }
    if (quantity < product.minimumQuantity || quantity > 9999) { onError(`A quantidade mínima é ${product.minimumQuantity} unidades.`); return false; }
    const missing = product.personalizationOptions.find((option) => {
      if (!option.required) return false;
      const value = answers[option.id];
      return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    });
    if (missing) { onError(`Preencha a personalização “${missing.name}”.`); return false; }
    if (referenceFile) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(referenceFile.type)) { onError('Use uma imagem PNG, JPG ou WEBP como referência.'); return false; }
      if (referenceFile.size > MAX_STORE_REFERENCE_SIZE) { onError('A imagem de referência pode ter no máximo 10 MB.'); return false; }
    }
    return true;
  };

  const sendOrder = async () => {
    if (sending || !validate()) return;
    setSending(true);
    const requestId = createStorefrontRequestId();
    const extension = referenceFile?.type === 'image/png' ? 'png' : referenceFile?.type === 'image/webp' ? 'webp' : referenceFile ? 'jpg' : '';
    const referencePath = referenceFile ? requestId + '/' + createStorefrontRequestId() + '.' + extension : null;
    try {
      const submitted = await submitStorefrontOrder({
        id: requestId, customerName, customerWhatsapp: whatsapp, productId: product.id, quantity,
        personalizations: Object.fromEntries(product.personalizationOptions.filter((option) => answers[option.id] !== undefined).map((option) => [option.name, answers[option.id]])),
        customerText, themeColors, notes, referencePath, selectedAddons,
      });
      let referenceUploaded = !referenceFile;
      if (referenceFile && referencePath) {
        try { await uploadStorefrontReference(requestId, referencePath, referenceFile); referenceUploaded = true; }
        catch { referenceUploaded = false; }
      }
      setReviewOpen(false);
      onSubmitted({ orderNumber: submitted.orderNumber, estimatedTotal: submitted.estimatedTotal, referenceUploaded });
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Tente novamente em instantes.');
    } finally {
      setSending(false);
    }
  };

  const summaryPersonalizations = product.personalizationOptions
    .filter((option) => answers[option.id] !== undefined && answers[option.id] !== '')
    .map((option) => ({ name: option.name, answer: Array.isArray(answers[option.id]) ? (answers[option.id] as string[]).join(', ') : String(answers[option.id]) }));
  const addonNames = product.addons.filter((addon) => selectedAddons.includes(addon.id)).map((addon) => addon.name);

  return (
    <section className="mx-auto max-w-3xl">
      <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-pink-700"><ArrowLeft className="h-4 w-4" /> Voltar ao produto</button>
      <div className="rounded-[1.75rem] border border-rose-100 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)] sm:p-8">
        <div className="border-b border-rose-100 pb-5"><span className="text-xs font-black uppercase tracking-[0.16em] text-pink-600">Solicitação sem cadastro</span><h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{product.name}</h1><p className="mt-2 text-sm text-slate-500">Conte como você imagina o seu pedido. A equipe confirma os detalhes e o valor pelo WhatsApp.</p></div>
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="order-name" className="mb-1.5 block text-xs font-bold text-slate-700">Nome completo *</label><input id="order-name" autoComplete="name" maxLength={120} value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="input-base" placeholder="Como podemos chamar você?" /></div>
            <div><label htmlFor="order-whatsapp" className="mb-1.5 block text-xs font-bold text-slate-700">WhatsApp com DDD *</label><input id="order-whatsapp" inputMode="tel" autoComplete="tel" maxLength={20} value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} className="input-base" placeholder="(11) 99999-9999" /></div>
          </div>
          <div className="max-w-xs">
            <label htmlFor="order-quantity" className="mb-1.5 block text-xs font-bold text-slate-700">Quantidade *</label>
            <CustomNumberInput
              value={Number(quantity) || product.minimumQuantity}
              onChange={(val) => setQuantity(Math.max(product.minimumQuantity, val))}
              min={product.minimumQuantity}
              max={9999}
              step={1}
              ariaLabel="Quantidade"
            />
            <p className="mt-1.5 text-xs text-slate-400">Quantidade mínima: {product.minimumQuantity} unidades.</p>
          </div>

          {product.personalizationOptions.length > 0 && <section className="space-y-4 rounded-2xl bg-rose-50/60 p-4 sm:p-5"><div><h2 className="text-sm font-extrabold">Personalizações</h2><p className="mt-1 text-xs text-slate-500">Os campos com * são obrigatórios.</p></div>{product.personalizationOptions.map((option) => <PersonalizationInput key={option.id} option={option} value={answers[option.id]} onChange={(value) => updateAnswer(option.id, value)} />)}</section>}

          {product.addons.length > 0 && <section><h2 className="text-sm font-extrabold">Adicionais opcionais</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{product.addons.map((addon) => { const chosen = selectedAddons.includes(addon.id); return <button key={addon.id} type="button" aria-pressed={chosen} onClick={() => toggleAddon(addon.id)} className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${chosen ? 'border-pink-400 bg-pink-50 ring-2 ring-pink-100' : 'border-slate-200 bg-white hover:border-pink-200'}`}><span><strong className="block text-sm">{addon.name}</strong><small className="mt-0.5 block text-xs text-slate-500">{addon.description}</small></span><span className="shrink-0 text-xs font-bold text-pink-700">+ {currency(addon.price)}</span></button>; })}</div></section>}

          <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="order-text" className="mb-1.5 block text-xs font-bold text-slate-700">Nome ou texto para colocar no produto</label><input id="order-text" maxLength={500} value={customerText} onChange={(event) => setCustomerText(event.target.value)} className="input-base" placeholder="Ex.: nome, idade ou mensagem" /></div><div><label htmlFor="order-colors" className="mb-1.5 block text-xs font-bold text-slate-700">Tema e cores</label><input id="order-colors" maxLength={300} value={themeColors} onChange={(event) => setThemeColors(event.target.value)} className="input-base" placeholder="Ex.: jardim, rosa e verde" /></div></div>
          <div><label htmlFor="order-notes" className="mb-1.5 block text-xs font-bold text-slate-700">Observações</label><textarea id="order-notes" maxLength={2000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="input-base" placeholder="Conte qualquer outro detalhe importante" /></div>
          <div className="rounded-2xl border border-dashed border-rose-200 bg-white p-4"><label htmlFor="order-reference" className="flex cursor-pointer items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-pink-600"><ImagePlus className="h-5 w-5" /></span><span><strong className="block text-sm">Imagem de referência <span className="font-medium text-slate-400">(opcional)</span></strong><small className="block text-xs text-slate-500">PNG, JPG ou WEBP · até 10 MB</small></span></label><input id="order-reference" type="file" accept="image/png,image/jpeg,image/webp" className="mt-3 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-pink-700 hover:file:bg-rose-100" onChange={(event) => setReferenceFile(event.target.files?.[0] || null)} />{previewUrl && <img src={previewUrl} alt="Prévia da imagem de referência" className="mt-3 max-h-48 rounded-xl object-contain" />}</div>

          <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><span className="text-xs font-bold uppercase tracking-wide text-slate-400">Estimativa inicial</span><strong className="mt-1 block text-xl font-black text-slate-900">{estimatedTotal === null ? 'Orçamento sob consulta' : currency(estimatedTotal)}</strong><p className="mt-1 text-xs text-slate-500">{estimatedTotal === null ? 'A equipe enviará um valor pelo WhatsApp.' : 'O valor final será confirmado após a análise.'}</p></div><button type="button" onClick={() => { if (validate()) setReviewOpen(true); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 text-sm font-bold text-white shadow-lg shadow-pink-600/20 transition hover:bg-pink-700">Revisar solicitação <ArrowRight className="h-4 w-4" /></button></div>
        </div>
      </div>

      <CustomModal isOpen={reviewOpen} onClose={() => !sending && setReviewOpen(false)} title="Revise sua solicitação" description="Confira os dados antes de enviar para a Kelly." confirmText={sending ? 'Enviando...' : 'Enviar solicitação'} cancelText="Voltar e editar" onConfirm={() => { if (!sending) void sendOrder(); }}>
        <div className="space-y-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><p><strong>Produto:</strong> {product.name}</p><p className="mt-1"><strong>Quantidade:</strong> {quantity}</p><p className="mt-1"><strong>Contato:</strong> {customerName} · {whatsapp}</p></div>{summaryPersonalizations.map((item) => <p key={item.name}><strong>{item.name}:</strong> {item.answer}</p>)}{addonNames.length > 0 && <p><strong>Adicionais:</strong> {addonNames.join(', ')}</p>}{customerText && <p><strong>Texto:</strong> {customerText}</p>}{themeColors && <p><strong>Tema e cores:</strong> {themeColors}</p>}{notes && <p><strong>Observações:</strong> {notes}</p>}<p><strong>Imagem de referência:</strong> {referenceFile ? 'Anexada' : 'Não enviada'}</p><div className="rounded-xl bg-rose-50 p-3 font-bold text-rose-900">{estimatedTotal === null ? 'Valor a combinar em orçamento.' : `Estimativa inicial: ${currency(estimatedTotal)}. O valor final será confirmado pela equipe.`}</div></div>
      </CustomModal>
    </section>
  );
}

function PersonalizationInput({ option, value, onChange }: {
  option: StorefrontProduct['personalizationOptions'][number];
  value: string | string[] | boolean | undefined;
  onChange: (value: string | string[] | boolean) => void;
}) {
  const label = <label className="mb-1.5 block text-xs font-bold text-slate-700">{option.name}{option.required ? ' *' : ''}</label>;
  if (option.type === 'selecao') return <div>{label}<div className="flex flex-wrap gap-2">{option.values.map((item) => <button key={item} type="button" aria-pressed={value === item} onClick={() => onChange(item)} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${value === item ? 'border-pink-500 bg-pink-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-pink-300'}`}>{item}</button>)}</div></div>;
  if (option.type === 'multipla_escolha') {
    const selected = Array.isArray(value) ? value : [];
    return <div>{label}<div className="flex flex-wrap gap-2">{option.values.map((item) => { const active = selected.includes(item); return <button key={item} type="button" aria-pressed={active} onClick={() => onChange(active ? selected.filter((entry) => entry !== item) : [...selected, item])} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${active ? 'border-pink-500 bg-pink-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-pink-300'}`}>{item}</button>; })}</div></div>;
  }
  if (option.type === 'sim_nao') return <div>{label}<div className="flex gap-2">{[true, false].map((choice) => <button key={String(choice)} type="button" aria-pressed={value === choice} onClick={() => onChange(choice)} className={`rounded-xl border px-4 py-2 text-xs font-bold transition ${value === choice ? 'border-pink-500 bg-pink-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{choice ? 'Sim' : 'Não'}</button>)}</div></div>;
  return <div>{label}<input type={option.type === 'numero' ? 'number' : 'text'} maxLength={200} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className="input-base" placeholder={option.type === 'numero' ? 'Informe um número' : 'Escreva sua resposta'} /></div>;
}

function EmptyMessage({ title, description, onBack }: { title: string; description: string; onBack: () => void }) {
  return <div className="mx-auto max-w-lg rounded-[1.5rem] border border-rose-100 bg-white p-8 text-center shadow-sm"><ShoppingBag className="mx-auto h-9 w-9 text-rose-300" /><h1 className="mt-4 text-xl font-black">{title}</h1><p className="mt-2 text-sm text-slate-500">{description}</p><button type="button" onClick={onBack} className="mt-5 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white">Ver catálogo</button></div>;
}
