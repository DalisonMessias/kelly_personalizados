import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, LoaderCircle, MessageCircle, Sparkles } from 'lucide-react';
import { CustomDateInput } from '../ui/CustomDateInput';
import { CustomModal } from '../ui/CustomModal';
import { CustomSelect } from '../ui/CustomSelect';
import { CustomNumberInput } from '../ui/CustomNumberInput';
import { useToast } from '../ui/Toast';
import {
  createStorefrontRequestId,
  MAX_STORE_REFERENCE_SIZE,
  StorefrontProduct,
  submitCustomQuoteRequest,
  SubmittedCustomQuote,
  uploadCustomQuoteReference,
} from '../../services/storefrontService';

interface CustomQuoteRequestFormProps {
  products: StorefrontProduct[];
  initialProductId: string | null;
  onBack: () => void;
}

const OTHER_PRODUCT = '__outro__';

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.startsWith('55') && digits.length > 11) {
    const local = digits.slice(2);
    return `+55 (${local.slice(0, 2)}${local.length >= 2 ? ')' : ''} ${local.slice(2, 7)}${local.length > 7 ? '-' + local.slice(7, 11) : ''}`.trim();
  }
  if (digits.length > 6) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  if (digits.length > 2) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return digits;
}

function isValidBrazilianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11 || ((digits.length === 12 || digits.length === 13) && digits.startsWith('55'));
}

export function CustomQuoteRequestForm({ products, initialProductId, onBack }: CustomQuoteRequestFormProps) {
  const { success, error } = useToast();
  const initialProduct = products.find((product) => product.id === initialProductId) || null;
  const [selectedProductId, setSelectedProductId] = useState(initialProduct?.id || OTHER_PRODUCT);
  const selectedProduct = products.find((product) => product.id === selectedProductId) || null;
  const [productName, setProductName] = useState(initialProduct?.name || '');
  const [customerName, setCustomerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [quantity, setQuantity] = useState(String(initialProduct?.minimumQuantity || 1));
  const [idea, setIdea] = useState(initialProduct?.publicDescription || '');
  const [material, setMaterial] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [colors, setColors] = useState('');
  const [personalizations, setPersonalizations] = useState('');
  const [desiredDeadline, setDesiredDeadline] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState<{ request: SubmittedCustomQuote; referenceUploaded: boolean } | null>(null);

  const productOptions = useMemo(() => [
    { value: OTHER_PRODUCT, label: 'Outro produto ou criação personalizada' },
    ...products.map((product) => ({ value: product.id, label: product.name })),
  ], [products]);

  useEffect(() => {
    if (!referenceFile) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(referenceFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [referenceFile]);

  const validate = (): boolean => {
    if (customerName.trim().length < 2) { error('Confira seus dados', 'Informe seu nome completo.'); return false; }
    if (!isValidBrazilianPhone(whatsapp)) { error('Confira seus dados', 'Informe um WhatsApp brasileiro válido com DDD.'); return false; }
    if (productName.trim().length < 2) { error('Informe o produto', 'Escolha um item ou escreva o nome do que deseja criar.'); return false; }
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 9999) { error('Confira a quantidade', 'Informe uma quantidade entre 1 e 9.999 unidades.'); return false; }
    if (idea.trim().length < 10) { error('Conte sua ideia', 'Descreva o que você deseja com pelo menos 10 caracteres.'); return false; }
    if (!whatsappConsent) { error('Confirme o contato', 'Confirme que o retorno desta solicitação será feito pelo WhatsApp informado.'); return false; }
    if (referenceFile) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(referenceFile.type)) { error('Formato não aceito', 'Use uma imagem PNG, JPG ou WEBP.'); return false; }
      if (referenceFile.size > MAX_STORE_REFERENCE_SIZE) { error('Imagem muito grande', 'A imagem pode ter no máximo 10 MB.'); return false; }
    }
    return true;
  };

  const submit = async () => {
    if (sending || !validate()) return;
    setSending(true);
    const id = createStorefrontRequestId();
    try {
      const request = await submitCustomQuoteRequest({
        id,
        customerName,
        customerWhatsapp: whatsapp,
        productId: selectedProduct ? selectedProduct.id : null,
        productName,
        quantity: Number(quantity),
        idea,
        material,
        dimensions,
        colors,
        personalizations,
        desiredDeadline,
        additionalNotes,
      });
      let referenceUploaded = !referenceFile;
      if (referenceFile) {
        try {
          await uploadCustomQuoteReference(request.id, referenceFile);
          referenceUploaded = true;
        } catch {
          referenceUploaded = false;
        }
      }
      setSubmitted({ request, referenceUploaded });
      setReviewOpen(false);
      success('Solicitação recebida', `Protocolo ${request.quoteNumber}.`);
    } catch (cause) {
      error('Não foi possível enviar a solicitação', cause instanceof Error ? cause.message : 'Confira sua conexão e tente novamente.');
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-rose-100 bg-white px-6 py-12 text-center shadow-[0_12px_38px_rgba(15,23,42,0.06)] sm:px-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></span>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Solicitação recebida</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Obrigada por compartilhar sua ideia!</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Seu protocolo é <strong className="text-slate-900">{submitted.request.quoteNumber}</strong>. A equipe da Kelly vai analisar os detalhes e entrar em contato pelo WhatsApp informado.</p>
        <p className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800"><MessageCircle className="h-4 w-4" /> A conversa será iniciada pela equipe; esta página não envia mensagens automaticamente.</p>
        {!submitted.referenceUploaded && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">O pedido foi salvo, mas a imagem não pôde ser anexada. A equipe poderá combinar outra forma de recebê-la pelo WhatsApp.</p>}
        <button type="button" onClick={onBack} className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 text-sm font-bold text-white transition hover:bg-pink-700">Voltar à loja</button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl">
      <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-pink-700"><ArrowLeft className="h-4 w-4" /> Voltar à loja</button>
      <div className="rounded-[1.75rem] border border-rose-100 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)] sm:p-8">
        <header className="border-b border-rose-100 pb-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-pink-700"><Sparkles className="h-3.5 w-3.5" /> Sem cadastro</span>
          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Solicitar orçamento personalizado</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Conte como imagina sua criação. A equipe vai analisar e conversar com você pelo WhatsApp para combinar os detalhes e o valor.</p>
        </header>

        <div className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <CustomSelect label="Produto ou tipo de criação *" options={productOptions} value={selectedProductId} onChange={(value) => {
              setSelectedProductId(value);
              const product = products.find((item) => item.id === value);
              if (product) {
                setProductName(product.name);
                if (!idea.trim()) setIdea(product.publicDescription || '');
                setQuantity(String(Math.max(1, product.minimumQuantity)));
              } else if (value === OTHER_PRODUCT) {
                setProductName('');
              }
            }} />
            <div><label htmlFor="quote-product-name" className="mb-1.5 block text-xs font-bold text-slate-700">Nome do produto desejado *</label><input id="quote-product-name" value={productName} onChange={(event) => setProductName(event.target.value)} maxLength={160} className="input-base" placeholder="Ex.: sacola para lembrancinhas" /></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="quote-customer-name" className="mb-1.5 block text-xs font-bold text-slate-700">Nome completo *</label><input id="quote-customer-name" autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={120} className="input-base" placeholder="Como podemos chamar você?" /></div>
            <div><label htmlFor="quote-whatsapp" className="mb-1.5 block text-xs font-bold text-slate-700">WhatsApp com DDD *</label><input id="quote-whatsapp" type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={(event) => setWhatsapp(formatPhone(event.target.value))} maxLength={22} className="input-base" placeholder="(11) 99999-9999" /></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 items-end">
            <div>
              <label htmlFor="quote-quantity" className="mb-1.5 block text-xs font-bold text-slate-700">Quantidade desejada *</label>
              <CustomNumberInput
                value={Number(quantity) || 1}
                onChange={(val) => setQuantity(String(val))}
                min={1}
                max={9999}
                step={1}
                ariaLabel="Quantidade desejada"
              />
            </div>
            <CustomDateInput label="Prazo desejado (opcional)" value={desiredDeadline} onChange={setDesiredDeadline} placeholder="Escolher uma data" />
          </div>

          <div><label htmlFor="quote-idea" className="mb-1.5 block text-xs font-bold text-slate-700">Descreva sua ideia *</label><textarea id="quote-idea" rows={4} maxLength={5000} value={idea} onChange={(event) => setIdea(event.target.value)} className="input-base resize-none" placeholder="Conte para que ocasião será, o tema e o que você gostaria de receber..." /><p className="mt-1 text-right text-[11px] text-slate-400">{idea.length}/5000</p></div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="quote-material" className="mb-1.5 block text-xs font-bold text-slate-700">Material desejado</label><input id="quote-material" value={material} onChange={(event) => setMaterial(event.target.value)} maxLength={500} className="input-base" placeholder="Ex.: papel, tecido, acrílico" /></div>
            <div><label htmlFor="quote-dimensions" className="mb-1.5 block text-xs font-bold text-slate-700">Tamanho ou dimensões</label><input id="quote-dimensions" value={dimensions} onChange={(event) => setDimensions(event.target.value)} maxLength={500} className="input-base" placeholder="Ex.: médio ou 20 × 15 cm" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="quote-colors" className="mb-1.5 block text-xs font-bold text-slate-700">Cores ou tema</label><input id="quote-colors" value={colors} onChange={(event) => setColors(event.target.value)} maxLength={500} className="input-base" placeholder="Ex.: jardim, rosa e verde" /></div>
            <div><label htmlFor="quote-personalizations" className="mb-1.5 block text-xs font-bold text-slate-700">Personalização</label><input id="quote-personalizations" value={personalizations} onChange={(event) => setPersonalizations(event.target.value)} maxLength={1500} className="input-base" placeholder="Nome, frase ou outros detalhes" /></div>
          </div>

          <div><label htmlFor="quote-notes" className="mb-1.5 block text-xs font-bold text-slate-700">Observações adicionais</label><textarea id="quote-notes" rows={3} maxLength={2000} value={additionalNotes} onChange={(event) => setAdditionalNotes(event.target.value)} className="input-base resize-none" placeholder="Alguma informação importante para a equipe?" /></div>

          <section className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/30 p-4">
            <label htmlFor="quote-reference" className="flex cursor-pointer items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-pink-600 shadow-sm"><ImagePlus className="h-5 w-5" /></span><span><strong className="block text-sm">Imagem de referência <span className="font-medium text-slate-400">(opcional)</span></strong><small className="block text-xs text-slate-500">PNG, JPG ou WEBP · até 10 MB · armazenada de forma privada</small></span></label>
            <input id="quote-reference" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setReferenceFile(event.target.files?.[0] || null)} />
            <div className="mt-3 flex flex-wrap items-center gap-3"><label htmlFor="quote-reference" className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-pink-700 transition hover:bg-rose-50">{referenceFile ? 'Trocar imagem' : 'Selecionar imagem'}</label>{referenceFile && <span className="max-w-full truncate text-xs text-slate-600">{referenceFile.name}</span>}{referenceFile && <button type="button" onClick={() => setReferenceFile(null)} className="text-xs font-semibold text-slate-500 hover:text-rose-700">Remover seleção</button>}</div>
            {previewUrl && <img src={previewUrl} alt="Prévia da imagem selecionada" className="mt-3 max-h-56 rounded-xl border border-rose-100 bg-white object-contain" />}
          </section>

          <button type="button" role="switch" aria-checked={whatsappConsent} onClick={() => setWhatsappConsent((current) => !current)} className="flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left">
            <span className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${whatsappConsent ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`h-4 w-4 rounded-full bg-white shadow transition ${whatsappConsent ? 'translate-x-4' : ''}`} /></span>
            <span className="text-xs leading-5 text-slate-600">Confirmo que o retorno sobre esta solicitação será feito pela equipe da Kelly Personalizados no WhatsApp informado. Nenhuma mensagem será enviada automaticamente por esta página.</span>
          </button>

          <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-md text-xs leading-5 text-slate-500">O envio não calcula nem apresenta preços. A equipe analisará sua solicitação e combinará o orçamento com você.</p><button type="button" onClick={() => { if (validate()) setReviewOpen(true); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 text-sm font-bold text-white shadow-lg shadow-pink-600/20 transition hover:bg-pink-700">Revisar solicitação <ArrowRight className="h-4 w-4" /></button></div>
        </div>
      </div>

      <CustomModal isOpen={reviewOpen} onClose={() => !sending && setReviewOpen(false)} title="Revise sua solicitação" description="Confira os dados antes de enviar para a equipe da Kelly." confirmText={sending ? 'Enviando...' : 'Enviar solicitação'} cancelText="Voltar e editar" onConfirm={() => { if (!sending) void submit(); }}>
        <div className="space-y-3 text-sm"><div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"><p><strong>Produto:</strong> {productName}</p><p><strong>Quantidade:</strong> {quantity}</p><p><strong>Cliente:</strong> {customerName}</p><p><strong>WhatsApp:</strong> {whatsapp}</p></div><p className="whitespace-pre-wrap"><strong>Ideia:</strong> {idea}</p>{material && <p><strong>Material:</strong> {material}</p>}{dimensions && <p><strong>Tamanho:</strong> {dimensions}</p>}{colors && <p><strong>Cores ou tema:</strong> {colors}</p>}{personalizations && <p><strong>Personalização:</strong> {personalizations}</p>}{desiredDeadline && <p><strong>Prazo desejado:</strong> {desiredDeadline.split('-').reverse().join('/')}</p>}{additionalNotes && <p className="whitespace-pre-wrap"><strong>Observações:</strong> {additionalNotes}</p>}<p><strong>Imagem:</strong> {referenceFile ? referenceFile.name : 'Não anexada'}</p><p className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">Ao enviar, você confirma que deseja receber retorno da equipe pelo WhatsApp. O orçamento será combinado com você após a análise.</p></div>
      </CustomModal>
      {sending && <div className="sr-only" role="status"><LoaderCircle className="animate-spin" /> Enviando solicitação</div>}
    </section>
  );
}
