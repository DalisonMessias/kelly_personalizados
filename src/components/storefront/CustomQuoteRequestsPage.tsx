import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowRight, Clock3, ExternalLink, FileText, LoaderCircle, MessageCircle, RefreshCw, Search, ShoppingBag } from 'lucide-react';
import { CustomDateInput } from '../ui/CustomDateInput';
import { CustomModal } from '../ui/CustomModal';
import { CurrencyInput } from '../ui/CurrencyInput';
import { CustomSelect } from '../ui/CustomSelect';
import { CustomNumberInput } from '../ui/CustomNumberInput';
import { useToast } from '../ui/Toast';
import {
  archiveCustomQuoteRequest,
  convertCustomQuoteRequest,
  CustomQuoteRequest,
  CustomQuoteStatus,
  getCustomQuoteRequests,
  getStorefrontReferenceUrl,
  UpdateCustomQuoteInput,
  updateCustomQuoteRequest,
} from '../../services/storefrontService';

const STATUS_LABELS: Record<CustomQuoteStatus, string> = {
  novo_orcamento: 'Novo orçamento',
  em_analise: 'Em análise',
  aguardando_informacoes: 'Aguardando informações',
  orcamento_enviado: 'Orçamento enviado',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  convertido_em_pedido: 'Convertido em pedido',
  cancelado: 'Cancelado',
};

const EDITABLE_STATUSES: CustomQuoteStatus[] = [
  'novo_orcamento', 'em_analise', 'aguardando_informacoes', 'orcamento_enviado', 'aprovado', 'recusado', 'cancelado',
];

const STATUS_STYLES: Record<CustomQuoteStatus, string> = {
  novo_orcamento: 'bg-sky-50 text-sky-700 ring-sky-200',
  em_analise: 'bg-amber-50 text-amber-700 ring-amber-200',
  aguardando_informacoes: 'bg-violet-50 text-violet-700 ring-violet-200',
  orcamento_enviado: 'bg-pink-50 text-pink-700 ring-pink-200',
  aprovado: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  recusado: 'bg-rose-50 text-rose-700 ring-rose-200',
  convertido_em_pedido: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  cancelado: 'bg-slate-100 text-slate-700 ring-slate-200',
};

function formatDate(value: string | null): string {
  if (!value) return 'Não informado';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(date);
}

function statusOptions(includeAll = false) {
  return [
    ...(includeAll ? [{ value: 'todos', label: 'Todas as situações' }] : []),
    ...EDITABLE_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
    { value: 'convertido_em_pedido', label: STATUS_LABELS.convertido_em_pedido },
  ];
}

function whatsappLink(quote: CustomQuoteRequest): string {
  const digits = quote.customerWhatsapp.replace(/\D/g, '');
  const message = `Olá, ${quote.customerName}! Estou entrando em contato sobre sua solicitação ${quote.quoteNumber} para ${quote.productName}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function makeDraft(quote: CustomQuoteRequest): UpdateCustomQuoteInput {
  return {
    id: quote.id,
    productName: quote.productName,
    quantity: quote.quantity,
    idea: quote.idea,
    material: quote.material,
    dimensions: quote.dimensions,
    colors: quote.colors,
    personalizations: quote.personalizations,
    desiredDeadline: quote.desiredDeadline,
    additionalNotes: quote.additionalNotes,
    status: quote.status === 'convertido_em_pedido' ? 'aprovado' : quote.status,
    quoteAmount: quote.quoteAmount,
    internalNotes: quote.internalNotes,
    historyNote: '',
  };
}

export function CustomQuoteRequestsPage({ onOpenOrders }: { onOpenOrders?: () => void }) {
  const { success, error } = useToast();
  const [requests, setRequests] = useState<CustomQuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selected, setSelected] = useState<CustomQuoteRequest | null>(null);
  const [draft, setDraft] = useState<UpdateCustomQuoteInput | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<CustomQuoteRequest | null>(null);
  const [convertTarget, setConvertTarget] = useState<CustomQuoteRequest | null>(null);

  const refresh = async () => {
    setLoading(true);
    setLoadError('');
    try { setRequests(await getCustomQuoteRequests(includeArchived)); }
    catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Não foi possível carregar as solicitações. Confira a conexão e tente novamente.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, [includeArchived]);

  useEffect(() => {
    if (!selected?.referencePath) { setReferenceUrl(null); return; }
    let active = true;
    getStorefrontReferenceUrl(selected.referencePath).then((url) => { if (active) setReferenceUrl(url); });
    return () => { active = false; };
  }, [selected?.id, selected?.referencePath]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return requests.filter((quote) => {
      const matchesStatus = statusFilter === 'todos' || quote.status === statusFilter;
      const matchesQuery = !normalized || `${quote.quoteNumber} ${quote.customerName} ${quote.customerWhatsapp} ${quote.productName} ${quote.idea}`.toLocaleLowerCase('pt-BR').includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [requests, query, statusFilter]);

  const counts = useMemo(() => requests.reduce((result, quote) => {
    result.total += 1;
    if (quote.status === 'novo_orcamento') result.new += 1;
    if (quote.status === 'em_analise') result.review += 1;
    if (quote.status === 'aprovado') result.approved += 1;
    return result;
  }, { total: 0, new: 0, review: 0, approved: 0 }), [requests]);

  const openRequest = (quote: CustomQuoteRequest) => {
    setSelected(quote);
    setDraft(makeDraft(quote));
  };

  const setDraftField = <K extends keyof UpdateCustomQuoteInput>(key: K, value: UpdateCustomQuoteInput[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const save = async () => {
    if (!draft || !selected || saving) return;
    setSaving(true);
    try {
      const updated = await updateCustomQuoteRequest(draft);
      setRequests((current) => current.map((quote) => quote.id === updated.id ? updated : quote));
      setSelected(updated);
      setDraft(makeDraft(updated));
      success('Solicitação atualizada', `O protocolo ${updated.quoteNumber} foi salvo no Supabase.`);
    } catch (cause) {
      error('Não foi possível salvar as alterações', cause instanceof Error ? cause.message : 'Tente novamente em instantes.');
    } finally { setSaving(false); }
  };

  const archive = async () => {
    if (!archiveTarget) return;
    const target = archiveTarget;
    try {
      const archived = await archiveCustomQuoteRequest(target.id);
      setRequests((current) => includeArchived
        ? current.map((quote) => quote.id === target.id ? archived : quote)
        : current.filter((quote) => quote.id !== target.id));
      if (selected?.id === target.id) { setSelected(null); setDraft(null); }
      success('Solicitação arquivada', 'O registro e o histórico foram preservados no banco de dados.');
    } catch (cause) {
      error('Não foi possível arquivar', cause instanceof Error ? cause.message : 'Tente novamente em instantes.');
    } finally { setArchiveTarget(null); }
  };

  const convert = async () => {
    if (!convertTarget || saving) return;
    setSaving(true);
    try {
      const result = await convertCustomQuoteRequest(convertTarget.id);
      await refresh();
      setSelected(null);
      setDraft(null);
      success(result.alreadyConverted ? 'Pedido já vinculado' : 'Orçamento convertido', result.orderNumber ? `Pedido ${result.orderNumber}.` : 'O pedido foi criado e vinculado sem duplicar o orçamento.');
      if (onOpenOrders) onOpenOrders();
    } catch (cause) {
      error('Não foi possível converter o orçamento', cause instanceof Error ? cause.message : 'Tente novamente em instantes.');
    } finally { setSaving(false); setConvertTarget(null); }
  };

  const updateDraftAmount = (value: number) => setDraftField('quoteAmount', value > 0 ? value : null);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-pink-600">Loja virtual</p><h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Solicitações de orçamento</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Analise os pedidos personalizados, combine valores pelo WhatsApp e converta os aprovados em pedidos da loja.</p></div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 sm:self-auto"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Summary label="Solicitações" value={counts.total} /><Summary label="Novas" value={counts.new} /><Summary label="Em análise" value={counts.review} /><Summary label="Aprovadas" value={counts.approved} /></div>

      <div className="rounded-2xl border border-rose-100 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-sm"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar protocolo, cliente ou produto" className="input-base pl-10" aria-label="Buscar solicitações" /></label>
          <div className="w-full lg:max-w-xs"><CustomSelect label="Filtrar por situação" options={statusOptions(true)} value={statusFilter} onChange={setStatusFilter} /></div>
        </div>
        <button type="button" role="switch" aria-checked={includeArchived} onClick={() => setIncludeArchived((current) => !current)} className="mt-4 inline-flex items-center gap-3 text-xs font-semibold text-slate-600"><span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${includeArchived ? 'bg-pink-600' : 'bg-slate-300'}`}><span className={`h-4 w-4 rounded-full bg-white shadow transition ${includeArchived ? 'translate-x-4' : ''}`} /></span>Incluir solicitações arquivadas</button>
      </div>

      {loading && requests.length === 0 ? <div className="grid min-h-60 place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-pink-600" /></div>
        : loadError ? <div className="rounded-2xl border border-rose-100 bg-white p-8 text-center"><p className="text-sm text-slate-600">Não foi possível carregar as solicitações de orçamento.</p><p className="mt-2 break-words text-xs text-slate-400">{loadError}</p><button type="button" onClick={() => void refresh()} className="mt-4 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white">Tentar novamente</button></div>
        : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center"><FileText className="mx-auto h-9 w-9 text-slate-300" /><h2 className="mt-4 text-lg font-bold text-slate-800">Nenhuma solicitação nesta lista</h2><p className="mt-1 text-sm text-slate-500">As solicitações enviadas pela loja aparecerão aqui.</p></div>
        : <div className="grid gap-3">{filtered.map((quote) => <button type="button" key={quote.id} onClick={() => openRequest(quote)} className="group flex w-full flex-col gap-3 rounded-2xl border border-rose-100 bg-white p-4 text-left shadow-sm transition hover:border-pink-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-5"><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="text-sm font-black text-slate-900">{quote.quoteNumber}</strong><StatusBadge status={quote.status} />{quote.archivedAt && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">Arquivada</span>}</span><span className="mt-2 block truncate text-sm font-bold text-slate-700">{quote.customerName} <span className="font-medium text-slate-400">· {quote.productName}</span></span><span className="mt-1 block text-xs text-slate-500">{quote.quantity} unidades · {formatDate(quote.createdAt)}</span></span><span className="flex items-center justify-between gap-4 sm:justify-end"><span className="text-right"><small className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Orçamento</small><strong className="text-sm font-black text-slate-900">{quote.quoteAmount == null ? 'A definir' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.quoteAmount)}</strong></span><ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-pink-600" /></span></button>)}</div>}

      <CustomModal isOpen={Boolean(selected && draft)} onClose={() => { if (!saving) { setSelected(null); setDraft(null); } }} title={selected ? `Solicitação ${selected.quoteNumber}` : 'Detalhes do orçamento'} description="Revise os dados recebidos, atualize o atendimento e registre o valor combinado." showCancelButton={false}>
        {selected && draft && <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2"><InfoCell label="Cliente" value={selected.customerName} /><InfoCell label="WhatsApp" value={selected.customerWhatsapp} /><InfoCell label="Recebido em" value={formatDate(selected.createdAt)} /><InfoCell label="Produto selecionado" value={selected.productId || 'Produto personalizado'} /></section>
          <a href={whatsappLink(selected)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700"><MessageCircle className="h-4 w-4" /> Abrir conversa no WhatsApp <ExternalLink className="h-3.5 w-3.5" /></a>

          <div className="grid gap-4 sm:grid-cols-2 items-end">
            <div><label htmlFor="quote-admin-product" className="mb-1.5 block text-xs font-bold text-slate-700">Produto desejado</label><input id="quote-admin-product" value={draft.productName} maxLength={160} onChange={(event) => setDraftField('productName', event.target.value)} className="input-base" /></div>
            <div>
              <label htmlFor="quote-admin-quantity" className="mb-1.5 block text-xs font-bold text-slate-700">Quantidade</label>
              <CustomNumberInput
                value={draft.quantity}
                onChange={(val) => setDraftField('quantity', val)}
                min={1}
                max={9999}
                step={1}
                ariaLabel="Quantidade"
              />
            </div>
          </div>
          <div><label htmlFor="quote-admin-idea" className="mb-1.5 block text-xs font-bold text-slate-700">Descrição da ideia</label><textarea id="quote-admin-idea" rows={4} maxLength={5000} value={draft.idea} onChange={(event) => setDraftField('idea', event.target.value)} className="input-base resize-none" /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="quote-admin-material" className="mb-1.5 block text-xs font-bold text-slate-700">Material</label><input id="quote-admin-material" value={draft.material} maxLength={500} onChange={(event) => setDraftField('material', event.target.value)} className="input-base" /></div><div><label htmlFor="quote-admin-dimensions" className="mb-1.5 block text-xs font-bold text-slate-700">Tamanho ou dimensões</label><input id="quote-admin-dimensions" value={draft.dimensions} maxLength={500} onChange={(event) => setDraftField('dimensions', event.target.value)} className="input-base" /></div></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="quote-admin-colors" className="mb-1.5 block text-xs font-bold text-slate-700">Cores ou tema</label><input id="quote-admin-colors" value={draft.colors} maxLength={500} onChange={(event) => setDraftField('colors', event.target.value)} className="input-base" /></div><div><label htmlFor="quote-admin-personalizations" className="mb-1.5 block text-xs font-bold text-slate-700">Personalização</label><input id="quote-admin-personalizations" value={draft.personalizations} maxLength={1500} onChange={(event) => setDraftField('personalizations', event.target.value)} className="input-base" /></div></div>
          <div className="grid gap-4 sm:grid-cols-2"><CustomDateInput label="Prazo desejado" value={draft.desiredDeadline || ''} onChange={(value) => setDraftField('desiredDeadline', value || null)} placeholder="Sem prazo informado" /><div><label className="mb-1.5 block text-xs font-bold text-slate-700">Valor do orçamento (R$)</label><CurrencyInput value={draft.quoteAmount || 0} onChange={updateDraftAmount} className="input-base" ariaLabel="Valor do orçamento" /><p className="mt-1 text-[11px] text-slate-500">Salve o valor no Supabase antes de converter o orçamento.</p></div></div>
          <CustomSelect label="Situação" options={statusOptions()} value={draft.status} onChange={(value) => setDraftField('status', value as CustomQuoteStatus)} disabled={selected.status === 'convertido_em_pedido' || Boolean(selected.archivedAt)} />
          <div><label htmlFor="quote-admin-additional" className="mb-1.5 block text-xs font-bold text-slate-700">Observações do cliente</label><textarea id="quote-admin-additional" rows={2} maxLength={2000} value={draft.additionalNotes} onChange={(event) => setDraftField('additionalNotes', event.target.value)} className="input-base resize-none" /></div>
          <div><label htmlFor="quote-admin-internal" className="mb-1.5 block text-xs font-bold text-slate-700">Anotações internas</label><textarea id="quote-admin-internal" rows={3} maxLength={5000} value={draft.internalNotes} onChange={(event) => setDraftField('internalNotes', event.target.value)} className="input-base resize-none" placeholder="Visível somente para a equipe" /></div>
          <div><label htmlFor="quote-admin-history-note" className="mb-1.5 block text-xs font-bold text-slate-700">Nota desta atualização (opcional)</label><input id="quote-admin-history-note" maxLength={500} value={draft.historyNote} onChange={(event) => setDraftField('historyNote', event.target.value)} className="input-base" placeholder="Ex.: cliente confirmou as cores" /></div>

          {selected.referencePath && <section className="rounded-xl border border-slate-100 p-3"><h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Imagem de referência</h3>{referenceUrl ? <a href={referenceUrl} target="_blank" rel="noreferrer" className="inline-flex flex-col gap-2 text-sm font-bold text-pink-700"><img src={referenceUrl} alt="Imagem de referência enviada pelo cliente" className="max-h-64 rounded-lg object-contain" />Abrir imagem em outra aba <ExternalLink className="h-3.5 w-3.5" /></a> : <p className="text-xs text-slate-500">A imagem privada ainda não está disponível.</p>}</section>}

          {selected.convertedOrderId && <InfoCell label="Pedido vinculado" value={selected.convertedOrderId} />}
          <section><h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500"><Clock3 className="h-4 w-4" /> Histórico</h3><div className="max-h-48 space-y-3 overflow-y-auto border-l-2 border-rose-100 pl-4">{selected.statusHistory.map((entry, index) => <div key={`${entry.createdAt}-${index}`} className="relative"><span className="absolute -left-[1.38rem] top-1 h-2.5 w-2.5 rounded-full bg-pink-500 ring-4 ring-white" /><p className="text-sm font-bold text-slate-800">{STATUS_LABELS[entry.newStatus] || entry.newStatus}{entry.archived ? ' · arquivada' : ''}</p><p className="mt-0.5 text-xs text-slate-500">{formatDate(entry.createdAt)}{entry.note ? ` · ${entry.note}` : ''}</p></div>)}</div></section>

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:justify-end"><button type="button" onClick={() => { setSelected(null); setDraft(null); }} disabled={saving} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Fechar</button>{!selected.archivedAt && selected.status !== 'convertido_em_pedido' && <button type="button" onClick={() => setArchiveTarget(selected)} disabled={saving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-bold text-rose-700 hover:bg-rose-50"><Archive className="h-4 w-4" /> Arquivar</button>}{selected.status === 'aprovado' && !selected.convertedOrderId && !selected.archivedAt && <button type="button" onClick={() => setConvertTarget(selected)} disabled={saving || !selected.quoteAmount || selected.quoteAmount <= 0 || !draft.quoteAmount || draft.quoteAmount <= 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><ShoppingBag className="h-4 w-4" /> Converter em pedido</button>}<button type="button" onClick={() => void save()} disabled={saving || selected.status === 'convertido_em_pedido' || Boolean(selected.archivedAt)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 text-sm font-bold text-white hover:bg-pink-700 disabled:cursor-wait disabled:opacity-60">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />} Salvar alterações</button></div>
        </div>}
      </CustomModal>

      <CustomModal isOpen={Boolean(archiveTarget)} onClose={() => setArchiveTarget(null)} title="Arquivar solicitação?" description="A solicitação sairá da lista principal, mas todos os dados e o histórico continuarão preservados no Supabase." confirmText="Arquivar solicitação" cancelText="Voltar" variant="warning" onConfirm={() => { void archive(); }}>
        {archiveTarget && <p className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{archiveTarget.quoteNumber}</strong> · {archiveTarget.customerName}</p>}
      </CustomModal>

      <CustomModal isOpen={Boolean(convertTarget)} onClose={() => !saving && setConvertTarget(null)} title="Converter orçamento em pedido?" description="Será criado um pedido no fluxo existente da loja, vinculado a este orçamento. A operação é idempotente e mantém o histórico da solicitação." confirmText={saving ? 'Convertendo...' : 'Criar pedido'} cancelText="Revisar orçamento" variant="primary" onConfirm={() => { if (!saving) void convert(); }}>
        {convertTarget && <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm"><p><strong>{convertTarget.quoteNumber}</strong> · {convertTarget.productName}</p><p>{convertTarget.quantity} unidades · {convertTarget.quoteAmount == null ? 'Valor pendente' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(convertTarget.quoteAmount)}</p></div>}
      </CustomModal>
    </section>
  );
}

function StatusBadge({ status }: { status: CustomQuoteStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-rose-100 bg-white p-4"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span><strong className="mt-1 block text-2xl font-black text-slate-900">{value}</strong></div>;
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><span className="block text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</span><strong className="mt-1 block break-words text-sm font-bold text-slate-800">{value}</strong></div>;
}
