import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, PackageCheck, RefreshCw, Search, ShoppingBag, Clock3, ChevronRight, ExternalLink, LoaderCircle } from 'lucide-react';
import { CustomModal } from '../ui/CustomModal';
import { useToast } from '../ui/Toast';
import { getStorefrontOrders, getStorefrontReferenceUrl, setStorefrontOrderStatus, StorefrontOrder, StorefrontOrderStatus } from '../../services/storefrontService';

const STATUS_LABELS: Record<StorefrontOrderStatus, string> = {
  novo: 'Novo', em_analise: 'Em análise', aguardando_confirmacao: 'Aguardando confirmação',
  em_producao: 'Em produção', pronto: 'Pronto', entregue: 'Entregue', cancelado: 'Cancelado',
};
const STATUS_ORDER: StorefrontOrderStatus[] = ['novo','em_analise','aguardando_confirmacao','em_producao','pronto','entregue','cancelado'];
const STATUS_STYLES: Record<StorefrontOrderStatus, string> = {
  novo: 'bg-sky-50 text-sky-700 ring-sky-200', em_analise: 'bg-amber-50 text-amber-700 ring-amber-200',
  aguardando_confirmacao: 'bg-violet-50 text-violet-700 ring-violet-200', em_producao: 'bg-pink-50 text-pink-700 ring-pink-200',
  pronto: 'bg-emerald-50 text-emerald-700 ring-emerald-200', entregue: 'bg-slate-100 text-slate-700 ring-slate-200',
  cancelado: 'bg-rose-50 text-rose-700 ring-rose-200',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function displayAnswer(value: unknown): string {
  if (Array.isArray(value)) return value.map(displayAnswer).join(', ');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

export function StorefrontOrdersPage() {
  const { success, error } = useToast();
  const [orders, setOrders] = useState<StorefrontOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | StorefrontOrderStatus>('todos');
  const [selectedOrder, setSelectedOrder] = useState<StorefrontOrder | null>(null);
  const [nextStatus, setNextStatus] = useState<StorefrontOrderStatus>('novo');
  const [statusNote, setStatusNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);

  const refreshOrders = async () => {
    setLoading(true);
    setLoadError('');
    try { setOrders(await getStorefrontOrders()); }
    catch { setLoadError('Não foi possível carregar os pedidos. Confira a conexão e tente novamente.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refreshOrders(); }, []);

  useEffect(() => {
    if (!selectedOrder?.referencePath) { setReferenceUrl(null); return; }
    let active = true;
    getStorefrontReferenceUrl(selectedOrder.referencePath).then((url) => { if (active) setReferenceUrl(url); });
    return () => { active = false; };
  }, [selectedOrder?.id, selectedOrder?.referencePath]);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'todos' || order.status === statusFilter;
      const matchesQuery = !normalized || `${order.orderNumber} ${order.customerName} ${order.customerWhatsapp} ${order.productName}`.toLocaleLowerCase('pt-BR').includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [orders, query, statusFilter]);

  const openOrder = (order: StorefrontOrder) => {
    setSelectedOrder(order);
    setNextStatus(order.status);
    setStatusNote('');
  };

  const saveStatus = async () => {
    if (!selectedOrder || saving) return;
    if (nextStatus === selectedOrder.status) { setSelectedOrder(null); return; }
    setSaving(true);
    try {
      await setStorefrontOrderStatus(selectedOrder.id, nextStatus, statusNote);
      await refreshOrders();
      setSelectedOrder(null);
      success('Situação atualizada', `O pedido ${selectedOrder.orderNumber} agora está “${STATUS_LABELS[nextStatus]}”.`);
    } catch (cause) {
      error('Não foi possível atualizar', cause instanceof Error ? cause.message : 'Tente novamente em instantes.');
    } finally { setSaving(false); }
  };

  const statusCounts = useMemo(() => orders.reduce((counts, order) => { counts[order.status] = (counts[order.status] || 0) + 1; return counts; }, {} as Partial<Record<StorefrontOrderStatus, number>>), [orders]);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-pink-600">Loja virtual</p><h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Pedidos recebidos</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Acompanhe solicitações, preferências dos clientes e o histórico de atendimento.</p></div>
        <button type="button" onClick={() => void refreshOrders()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 sm:self-auto"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total" value={orders.length} />
        <SummaryCard label="Novos" value={statusCounts.novo || 0} />
        <SummaryCard label="Em produção" value={statusCounts.em_producao || 0} />
        <SummaryCard label="Prontos" value={statusCounts.pronto || 0} />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar número, cliente ou produto" className="input-base pl-10" aria-label="Buscar pedidos" /></label>
        <div className="flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setStatusFilter('todos')} aria-pressed={statusFilter === 'todos'} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${statusFilter === 'todos' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Todos</button>{STATUS_ORDER.map((status) => <button key={status} type="button" onClick={() => setStatusFilter(status)} aria-pressed={statusFilter === status} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${statusFilter === status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{STATUS_LABELS[status]}</button>)}</div>
      </div>

      {loading && orders.length === 0 ? <div className="grid min-h-60 place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-pink-600" /></div>
        : loadError ? <div className="rounded-2xl border border-rose-100 bg-white p-8 text-center"><p className="text-sm text-slate-600">{loadError}</p><button type="button" onClick={() => void refreshOrders()} className="mt-4 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white">Tentar novamente</button></div>
        : filteredOrders.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center"><ShoppingBag className="mx-auto h-9 w-9 text-slate-300" /><h2 className="mt-4 text-lg font-bold text-slate-800">Nenhum pedido nesta lista</h2><p className="mt-1 text-sm text-slate-500">Os novos pedidos enviados pela loja aparecerão aqui.</p></div>
        : <div className="grid gap-3">{filteredOrders.map((order) => <button type="button" key={order.id} onClick={() => openOrder(order)} className="group flex w-full flex-col gap-4 rounded-2xl border border-rose-100 bg-white p-4 text-left shadow-sm transition hover:border-pink-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-5"><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="text-sm font-black text-slate-900">{order.orderNumber}</strong><StatusBadge status={order.status} /></span><span className="mt-2 block truncate text-sm font-bold text-slate-700">{order.customerName} <span className="font-medium text-slate-400">· {order.productName}</span></span><span className="mt-1 block text-xs text-slate-500">{order.quantity} unidades · {formatDate(order.createdAt)}</span></span><span className="flex items-center justify-between gap-4 sm:justify-end"><span className="text-right"><small className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Estimativa</small><strong className="text-sm font-black text-slate-900">{order.estimatedTotal === null ? 'Orçamento' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(order.estimatedTotal)}</strong></span><ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-pink-600" /></span></button>)}</div>}

      <CustomModal isOpen={Boolean(selectedOrder)} onClose={() => !saving && setSelectedOrder(null)} title={selectedOrder ? `Pedido ${selectedOrder.orderNumber}` : 'Detalhes do pedido'} description="Dados enviados pelo cliente e andamento da solicitação." confirmText={saving ? 'Salvando...' : 'Salvar situação'} cancelText="Fechar" onConfirm={() => { void saveStatus(); }}>
        {selectedOrder && <div className="max-h-[62vh] space-y-5 overflow-y-auto pr-1">
          <section className="grid gap-3 sm:grid-cols-2"><InfoCell label="Cliente" value={selectedOrder.customerName} /><InfoCell label="WhatsApp" value={selectedOrder.customerWhatsapp} /><InfoCell label="Produto" value={selectedOrder.productName} /><InfoCell label="Quantidade" value={`${selectedOrder.quantity} unidades`} /><InfoCell label="Recebido em" value={formatDate(selectedOrder.createdAt)} /><InfoCell label="Estimativa" value={selectedOrder.estimatedTotal === null ? 'Orçamento sob consulta' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(selectedOrder.estimatedTotal)} /></section>
          <a href={`https://wa.me/${selectedOrder.customerWhatsapp}?text=Olá%20${encodeURIComponent(selectedOrder.customerName)},%20sobre%20sua%20solicitação%20${encodeURIComponent(selectedOrder.orderNumber)}` } target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700"><MessageCircle className="h-4 w-4" /> Conversar pelo WhatsApp <ExternalLink className="h-3.5 w-3.5" /></a>
          <section className="space-y-2 rounded-xl border border-slate-100 p-3"><h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Personalizações</h3>{Object.keys(selectedOrder.personalizations || {}).length === 0 ? <p className="text-sm text-slate-400">Nenhuma opção preenchida.</p> : Object.entries(selectedOrder.personalizations || {}).map(([key,value]) => <p key={key} className="text-sm text-slate-700"><strong>{key}:</strong> {displayAnswer(value)}</p>)}{selectedOrder.selectedAddons?.length > 0 && <p className="text-sm text-slate-700"><strong>Adicionais:</strong> {selectedOrder.selectedAddons.map((addon) => addon.name).join(', ')}</p>}{selectedOrder.customerText && <p className="text-sm text-slate-700"><strong>Texto no produto:</strong> {selectedOrder.customerText}</p>}{selectedOrder.themeColors && <p className="text-sm text-slate-700"><strong>Tema e cores:</strong> {selectedOrder.themeColors}</p>}{selectedOrder.notes && <p className="whitespace-pre-wrap text-sm text-slate-700"><strong>Observações:</strong> {selectedOrder.notes}</p>}</section>
          {selectedOrder.referencePath && <section className="rounded-xl border border-slate-100 p-3"><h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Imagem de referência</h3>{referenceUrl ? <a href={referenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-pink-700"><img src={referenceUrl} alt="Referência do cliente" className="max-h-52 rounded-lg object-contain" />Abrir imagem <ExternalLink className="h-3.5 w-3.5" /></a> : <p className="text-xs text-slate-500">A imagem ainda não foi enviada ou não está disponível.</p>}</section>}
          <section><h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Atualizar situação</h3><div className="flex flex-wrap gap-2">{STATUS_ORDER.map((status) => <button key={status} type="button" aria-pressed={nextStatus === status} onClick={() => setNextStatus(status)} className={`rounded-xl px-3 py-2 text-xs font-bold ring-1 transition ${nextStatus === status ? STATUS_STYLES[status] + ' ring-2 ring-offset-1' : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50'}`}>{STATUS_LABELS[status]}</button>)}</div><label className="mt-3 block text-xs font-bold text-slate-700">Nota do histórico (opcional)<textarea maxLength={500} rows={2} value={statusNote} onChange={(event) => setStatusNote(event.target.value)} className="input-base mt-1" placeholder="Ex.: Cliente confirmou a arte" /></label></section>
          <section><h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500"><Clock3 className="h-4 w-4" /> Histórico</h3><div className="space-y-3 border-l-2 border-rose-100 pl-4">{selectedOrder.history.map((entry) => <div key={entry.id} className="relative"><span className="absolute -left-[1.38rem] top-1 h-2.5 w-2.5 rounded-full bg-pink-500 ring-4 ring-white" /><p className="text-sm font-bold text-slate-800">{STATUS_LABELS[entry.newStatus]}</p><p className="mt-0.5 text-xs text-slate-500">{formatDate(entry.createdAt)}{entry.note ? ` · ${entry.note}` : ''}</p></div>)}</div></section>
        </div>}
      </CustomModal>
    </section>
  );
}

function StatusBadge({ status }: { status: StorefrontOrderStatus }) { return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>; }
function SummaryCard({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-rose-100 bg-white p-4"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span><strong className="mt-1 block text-2xl font-black text-slate-900">{value}</strong></div>; }
function InfoCell({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><span className="block text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</span><strong className="mt-1 block break-words text-sm font-bold text-slate-800">{value}</strong></div>; }
