import React, { useState } from 'react';
import { Sparkles, WandSparkles, RefreshCw, Copy, Edit3, ExternalLink, Printer } from 'lucide-react';
import { CustomSwitch } from '../ui/CustomSwitch';
import { GeneratedArtPrompt } from '../../types';

export function ArtPromptPage() {
  const [artName, setArtName] = useState('');
  const [occasion, setOccasion] = useState('');
  const [personalizedName, setPersonalizedName] = useState('');
  const [ageOrText, setAgeOrText] = useState('');
  const [colors, setColors] = useState('');
  const [style, setStyle] = useState('');
  const [format, setFormat] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [elementCount, setElementCount] = useState('');
  const [instructions, setInstructions] = useState('');
  const [freeDescription, setFreeDescription] = useState('');
  const [prepareA4, setPrepareA4] = useState(false);
  const [a4Orientation, setA4Orientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [a4Background, setA4Background] = useState<'branco' | 'transparente'>('branco');
  const [cutOutline, setCutOutline] = useState(false);
  const [multipleUnits, setMultipleUnits] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GeneratedArtPrompt | null>(null);
  const [editablePrompt, setEditablePrompt] = useState('');
  const [editing, setEditing] = useState(false);

  const generatePrompt = async (mode: 'generate' | 'improve' = 'generate') => {
    if (!freeDescription.trim() && !artName.trim() && !occasion.trim()) {
      setError('Descreva pelo menos o nome, tema ou ideia da arte.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/analyze-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'art_prompt',
          descricao: {
            modo: mode,
            nome_tipo: artName,
            tema_ocasião: occasion,
            nome_personalizado: personalizedName,
            idade_texto: ageOrText,
            cores: colors,
            estilo_visual: style,
            formato: format,
            dimensões: dimensions,
            quantidade_elementos: elementCount,
            instruções_adicionais: instructions,
            descrição_livre: freeDescription,
            preparar_a4: prepareA4,
            a4_orientação: a4Orientation,
            a4_fundo: a4Background,
            contorno_recorte: cutOutline,
            varias_unidades: multipleUnits,
            prompt_anterior: mode === 'improve' ? editablePrompt : '',
          },
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Não foi possível gerar o prompt.');

      const prompt = data.artPrompt as GeneratedArtPrompt;
      setResult(prompt);
      setEditablePrompt(prompt.prompt);
      setEditing(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao gerar o prompt.');
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(editablePrompt);
  };

  const clearFields = () => {
    setArtName('');
    setOccasion('');
    setPersonalizedName('');
    setAgeOrText('');
    setColors('');
    setStyle('');
    setFormat('');
    setDimensions('');
    setElementCount('');
    setInstructions('');
    setFreeDescription('');
    setPrepareA4(false);
    setA4Orientation('vertical');
    setA4Background('branco');
    setCutOutline(false);
    setMultipleUnits(false);
    setResult(null);
    setEditablePrompt('');
    setEditing(false);
    setError('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-pink-100 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Assistente de Criação de Artes</h2>
          <p className="text-xs text-slate-500 mt-1">Descreva sua ideia e gere um prompt profissional para o Gemini.</p>
        </div>
        <button type="button" onClick={clearFields} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50">
          Limpar campos
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] gap-6 items-start">
        <div className="card-base p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-xs font-bold text-slate-700">Nome ou tipo da arte</label><input value={artName} onChange={(event) => setArtName(event.target.value)} className="input-base mt-1" placeholder="Ex: Topo de bolo" /></div>
            <div><label className="text-xs font-bold text-slate-700">Tema ou ocasião</label><input value={occasion} onChange={(event) => setOccasion(event.target.value)} className="input-base mt-1" placeholder="Ex: Unicórnio, aniversário" /></div>
            <div><label className="text-xs font-bold text-slate-700">Nome personalizado</label><input value={personalizedName} onChange={(event) => setPersonalizedName(event.target.value)} className="input-base mt-1" placeholder="Ex: Maria" /></div>
            <div><label className="text-xs font-bold text-slate-700">Idade ou texto</label><input value={ageOrText} onChange={(event) => setAgeOrText(event.target.value)} className="input-base mt-1" placeholder="Ex: 5 anos" /></div>
            <div><label className="text-xs font-bold text-slate-700">Cores desejadas</label><input value={colors} onChange={(event) => setColors(event.target.value)} className="input-base mt-1" placeholder="Ex: rosa, lilás e dourado" /></div>
            <div><label className="text-xs font-bold text-slate-700">Estilo visual</label><input value={style} onChange={(event) => setStyle(event.target.value)} className="input-base mt-1" placeholder="Ex: infantil delicado" /></div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Descreva a arte</label>
            <textarea value={freeDescription} onChange={(event) => setFreeDescription(event.target.value)} className="input-base mt-1 resize-none min-h-28 max-h-48 overflow-y-auto" rows={5} placeholder="Ex: Criar topo de bolo infantil com nome Maria, idade 5, tema unicórnio, cores rosa e lilás, fundo transparente e espaço para recorte." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-xs font-bold text-slate-700">Formato</label><select value={format} onChange={(event) => setFormat(event.target.value)} className="input-base mt-1"><option value="">Não informado</option><option value="redondo">Redondo</option><option value="quadrado">Quadrado</option><option value="retangular">Retangular</option><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select></div>
            <div><label className="text-xs font-bold text-slate-700">Tamanho ou dimensões</label><input value={dimensions} onChange={(event) => setDimensions(event.target.value)} className="input-base mt-1" placeholder="Ex: 15 cm ou folha A4" /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-xs font-bold text-slate-700">Quantidade de elementos</label><input value={elementCount} onChange={(event) => setElementCount(event.target.value)} className="input-base mt-1" placeholder="Ex: vários adesivos" /></div>
            <div><label className="text-xs font-bold text-slate-700">Instruções adicionais</label><input value={instructions} onChange={(event) => setInstructions(event.target.value)} className="input-base mt-1" placeholder="Ex: fundo transparente" /></div>
          </div>

          <div className="p-4 rounded-2xl border border-pink-100 bg-pink-50/40 space-y-3">
            <CustomSwitch label="Preparar arte para impressão A4" description="Gera instruções para folha A4 pronta para recorte." checked={prepareA4} onChange={setPrepareA4} />
            {prepareA4 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select value={a4Orientation} onChange={(event) => setA4Orientation(event.target.value as 'vertical' | 'horizontal')} className="input-base"><option value="vertical">A4 vertical</option><option value="horizontal">A4 horizontal</option></select>
                <select value={a4Background} onChange={(event) => setA4Background(event.target.value as 'branco' | 'transparente')} className="input-base"><option value="branco">Fundo branco</option><option value="transparente">Fundo transparente</option></select>
                <div className="space-y-2"><label className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={cutOutline} onChange={(event) => setCutOutline(event.target.checked)} className="accent-brand-600" />Contorno de recorte</label><label className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={multipleUnits} onChange={(event) => setMultipleUnits(event.target.checked)} className="accent-brand-600" />Várias unidades</label></div>
              </div>
            )}
          </div>

          {error && <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-3">{error}</div>}

          <button type="button" onClick={() => generatePrompt('generate')} disabled={loading} className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold text-sm">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <WandSparkles className="w-4 h-4" />}
            {loading ? 'Gerando prompt...' : 'Gerar prompt profissional'}
          </button>
        </div>

        <aside className="card-base p-5 space-y-4 xl:sticky xl:top-6">
          <div className="flex items-center justify-between gap-3 border-b border-pink-100 pb-3">
            <h3 className="font-black text-slate-900 flex items-center gap-2"><Sparkles className="w-4 h-4 text-brand-600" />Prompt pronto</h3>
            {result && <button type="button" onClick={() => setEditing(true)} className="text-xs font-bold text-brand-700">Editar</button>}
          </div>

          {result ? (
            <>
              {result.alerta && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">{result.alerta}</p>}
              {result.formato && <p className="text-[11px] text-slate-500">Formato: {result.formato}</p>}
              <textarea value={editing ? editablePrompt : (editablePrompt || result.prompt)} onChange={(event) => setEditablePrompt(event.target.value)} readOnly={!editing} className="input-base resize-none min-h-72 max-h-[60vh] overflow-y-auto text-xs leading-relaxed" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => navigator.clipboard.writeText(editablePrompt)} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs"><Copy className="w-4 h-4" />Copiar prompt</button>
                <button type="button" onClick={() => generatePrompt('generate')} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-pink-50 border border-pink-100 text-brand-700 font-bold text-xs"><RefreshCw className="w-4 h-4" />Gerar outro</button>
                <button type="button" onClick={() => generatePrompt('improve')} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-pink-200 text-brand-700 font-bold text-xs"><Sparkles className="w-4 h-4" />Melhorar prompt</button>
                <button type="button" onClick={() => window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer')} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"><ExternalLink className="w-4 h-4" />Abrir Gemini</button>
                <button type="button" onClick={async () => { await navigator.clipboard.writeText(editablePrompt); window.open(`https://chatgpt.com/?prompt=${encodeURIComponent(editablePrompt)}`, '_blank', 'noopener,noreferrer'); }} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs"><ExternalLink className="w-4 h-4" />Abrir ChatGPT</button>
              </div>
              {prepareA4 && (
                <button type="button" onClick={() => window.print()} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-pink-200 bg-pink-50 text-brand-700 font-bold text-xs"><Printer className="w-4 h-4" />Preparar para impressão A4</button>
              )}
            </>
          ) : (
            <div className="py-14 text-center text-xs text-slate-400">Seu prompt aparecerá aqui depois da geração.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
