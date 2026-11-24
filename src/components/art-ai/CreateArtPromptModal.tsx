import React, { useState } from 'react';
import { Sparkles, Copy, RefreshCw, Edit3, ExternalLink, WandSparkles } from 'lucide-react';
import { CustomModal } from '../ui/CustomModal';
import { CustomSwitch } from '../ui/CustomSwitch';
import { GeneratedArtPrompt } from '../../types';

interface CreateArtPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPromptReady?: (prompt: GeneratedArtPrompt) => void;
}

export function CreateArtPromptModal({ isOpen, onClose, onPromptReady }: CreateArtPromptModalProps) {
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GeneratedArtPrompt | null>(null);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');

  const requestPrompt = async (mode: 'generate' | 'improve' = 'generate') => {
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
            prompt_anterior: mode === 'improve' ? (editedPrompt || result?.prompt || '') : '',
          },
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Não foi possível gerar o prompt.');

      const artPrompt = data.artPrompt as GeneratedArtPrompt;
      setResult(artPrompt);
      setEditedPrompt(artPrompt.prompt);
      setEditingPrompt(false);
      onPromptReady?.(artPrompt);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao gerar prompt.');
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = async () => {
    const value = editingPrompt ? editedPrompt : (result?.prompt || '');
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  const openGemini = () => {
    window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
  };

  const openChatGPT = async () => {
    const value = editingPrompt ? editedPrompt : (result?.prompt || '');
    if (!value) return;
    await navigator.clipboard.writeText(value);
    window.open(`https://chatgpt.com/?prompt=${encodeURIComponent(value)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title="Criar arte com IA" cancelText="Fechar" showCancelButton>
      <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
        {!result || editingPrompt ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-xs font-bold text-slate-700">Nome ou tipo da arte</label><input value={artName} onChange={(event) => setArtName(event.target.value)} className="input-base mt-1" placeholder="Ex: Topo de bolo" /></div>
              <div><label className="text-xs font-bold text-slate-700">Tema ou ocasião</label><input value={occasion} onChange={(event) => setOccasion(event.target.value)} className="input-base mt-1" placeholder="Ex: Unicórnio, aniversário" /></div>
              <div><label className="text-xs font-bold text-slate-700">Nome personalizado</label><input value={personalizedName} onChange={(event) => setPersonalizedName(event.target.value)} className="input-base mt-1" placeholder="Ex: Maria" /></div>
              <div><label className="text-xs font-bold text-slate-700">Idade ou texto</label><input value={ageOrText} onChange={(event) => setAgeOrText(event.target.value)} className="input-base mt-1" placeholder="Ex: 5 anos" /></div>
              <div><label className="text-xs font-bold text-slate-700">Cores desejadas</label><input value={colors} onChange={(event) => setColors(event.target.value)} className="input-base mt-1" placeholder="Ex: rosa, lilás e dourado" /></div>
              <div><label className="text-xs font-bold text-slate-700">Estilo visual</label><input value={style} onChange={(event) => setStyle(event.target.value)} className="input-base mt-1" placeholder="Ex: infantil delicado" /></div>
              <div><label className="text-xs font-bold text-slate-700">Formato</label><select value={format} onChange={(event) => setFormat(event.target.value)} className="input-base mt-1"><option value="">Não informado</option><option value="redondo">Redondo</option><option value="quadrado">Quadrado</option><option value="retangular">Retangular</option><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select></div>
              <div><label className="text-xs font-bold text-slate-700">Tamanho ou dimensões</label><input value={dimensions} onChange={(event) => setDimensions(event.target.value)} className="input-base mt-1" placeholder="Ex: 15 cm ou folha A4" /></div>
              <div><label className="text-xs font-bold text-slate-700">Quantidade de elementos</label><input value={elementCount} onChange={(event) => setElementCount(event.target.value)} className="input-base mt-1" placeholder="Ex: vários adesivos" /></div>
              <div><label className="text-xs font-bold text-slate-700">Instruções adicionais</label><input value={instructions} onChange={(event) => setInstructions(event.target.value)} className="input-base mt-1" placeholder="Ex: fundo transparente" /></div>
            </div>

            <div><label className="text-xs font-bold text-slate-700">Descrição livre</label><textarea value={freeDescription} onChange={(event) => setFreeDescription(event.target.value)} className="input-base mt-1 resize-none" rows={4} placeholder="Descreva livremente como deseja a arte..." /></div>

            <div className="p-3 rounded-xl border border-pink-100 bg-pink-50/40">
              <CustomSwitch label="Preparar para impressão em A4" description="Inclui orientação 210 × 297 mm, margens, recorte e melhor distribuição dos elementos." checked={prepareA4} onChange={setPrepareA4} />
            </div>

            {error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-3">{error}</p>}

            {editingPrompt && result ? (
              <textarea value={editedPrompt} onChange={(event) => setEditedPrompt(event.target.value)} className="input-base resize-none" rows={10} />
            ) : null}

            <button type="button" onClick={() => requestPrompt('generate')} disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold text-xs">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <WandSparkles className="w-4 h-4" />}
              {loading ? 'Organizando prompt...' : 'Gerar prompt profissional'}
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-pink-200 bg-pink-50/40">
              <h3 className="font-black text-slate-900 flex items-center gap-2"><Sparkles className="w-4 h-4 text-brand-600" />Prompt pronto para gerar sua arte</h3>
              {result.alerta && <p className="text-xs text-amber-700 mt-2">{result.alerta}</p>}
              {result.formato && <p className="text-[11px] text-slate-500 mt-1">Formato: {result.formato}</p>}
            </div>

            <textarea value={editedPrompt} readOnly className="input-base resize-none min-h-48 max-h-[55vh] overflow-y-auto" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" onClick={copyPrompt} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs"><Copy className="w-4 h-4" />Copiar prompt</button>
              <button type="button" onClick={() => requestPrompt('generate')} disabled={loading} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-pink-200 bg-pink-50 text-brand-700 font-bold text-xs"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Gerar outro prompt</button>
              <button type="button" onClick={() => requestPrompt('improve')} disabled={loading} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-pink-200 bg-white text-brand-700 font-bold text-xs"><Sparkles className="w-4 h-4" />Melhorar prompt</button>
              <button type="button" onClick={() => setEditingPrompt(true)} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs"><Edit3 className="w-4 h-4" />Editar descrição</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" onClick={openGemini} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white font-bold text-xs"><ExternalLink className="w-4 h-4" />Abrir Gemini</button>
              <button type="button" onClick={openChatGPT} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs"><ExternalLink className="w-4 h-4" />Abrir ChatGPT</button>
            </div>
          </div>
        )}
      </div>
    </CustomModal>
  );
}
