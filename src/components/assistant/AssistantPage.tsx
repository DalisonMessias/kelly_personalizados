import React, { useEffect, useRef, useState } from 'react';
import {
  BrainCircuit,
  Send,
  Plus,
  Trash2,
  Calculator,
  Printer,
  ReceiptText,
  Sparkles,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import {
  ChatConversation,
  ChatMessage,
  ChatServiceProposal,
  CalculationRecord,
  ProductService,
  ServiceOrder,
} from '../../types';
import { storageService } from '../../services/storage';
import { formatCurrency } from '../../utils/calculations';

interface AssistantPageProps {
  products: ProductService[];
  calculations: CalculationRecord[];
  onFillCalculator: (product: ProductService) => void;
}

function formatAssistantContent(content: string): React.ReactNode[] {
  const normalized = content
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const blocks = normalized.split(/\n{2,}/);

  return blocks.map((block, blockIndex) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);

    if (lines.every((line) => /^\d+[.)]\s/.test(line))) {
      return (
        <ol key={`block-${blockIndex}`} className="space-y-2 list-none">
          {lines.map((line, lineIndex) => {
            const text = line.replace(/^\d+[.)]\s*/, '');
            const segments = text.split(/(\*\*[^*]+\*\*)/g);
            return (
              <li key={`line-${blockIndex}-${lineIndex}`} className="flex gap-2.5">
                <span className="w-6 h-6 shrink-0 rounded-full bg-pink-100 text-brand-700 text-[11px] font-black flex items-center justify-center">
                  {lineIndex + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">
                  {segments.map((segment, segmentIndex) => segment.startsWith('**') && segment.endsWith('**')
                    ? <strong key={segmentIndex} className="font-extrabold text-slate-900">{segment.slice(2, -2)}</strong>
                    : <React.Fragment key={segmentIndex}>{segment}</React.Fragment>)}
                </span>
              </li>
            );
          })}
        </ol>
      );
    }

    if (lines.every((line) => /^[-•]\s/.test(line))) {
      return (
        <ul key={`block-${blockIndex}`} className="space-y-2 list-none">
          {lines.map((line, lineIndex) => (
            <li key={`line-${blockIndex}-${lineIndex}`} className="flex gap-2.5">
              <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-brand-500 mt-2" />
              <span className="leading-relaxed">{line.replace(/^[-•]\s*/, '')}</span>
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={`block-${blockIndex}`} className="leading-relaxed whitespace-pre-wrap">
        {block.split(/(\*\*[^*]+\*\*)/g).map((segment, segmentIndex) => segment.startsWith('**') && segment.endsWith('**')
          ? <strong key={segmentIndex} className="font-extrabold text-slate-900">{segment.slice(2, -2)}</strong>
          : <React.Fragment key={segmentIndex}>{segment}</React.Fragment>)}
      </p>
    );
  });
}

const starterMessages = [
  'Quero criar um novo serviço.',
  'Ajude-me a calcular o preço de um produto.',
  'Encontre um serviço parecido no meu histórico.',
  'Quero duplicar e modificar um serviço anterior.',
];

function createProposalProduct(proposal: ChatServiceProposal): ProductService {
  const now = new Date().toISOString();
  const otherCosts = Math.max(0, proposal.outros_custos || 0);
  const timeUnit: 'minutes' | 'hours' = proposal.unidade_tempo === 'hours' ? 'hours' : 'minutes';

  const simpleMaterials = proposal.materiais.map((material, index) => ({
    id: `chat-material-${Date.now()}-${index}`,
    name: material.nome,
    cost: Number((material.custo_individual * material.quantidade).toFixed(2)),
  }));

  const pricing = {
    method: 'manual' as const,
    targetMargin: 40,
    targetMarkup: 70,
    manualPrice: Math.max(0, proposal.preco_sugerido || 0),
    discountPercent: Math.max(0, proposal.desconto_percentual || 0),
  };

  const labor = {
    hourlyRate: proposal.custo_mao_de_obra > 0 && proposal.tempo_producao > 0
      ? Number((proposal.custo_mao_de_obra / (timeUnit === 'hours' ? proposal.tempo_producao : proposal.tempo_producao / 60)).toFixed(2))
      : 0,
    timeSpent: proposal.tempo_producao,
    timeUnit,
  };

  return {
    id: `chat-draft-${Date.now()}`,
    name: proposal.nome,
    category: 'outro',
    description: proposal.descricao,
    sheetCount: Math.max(1, proposal.quantidade_produzida),
    createdAt: now,
    updatedAt: now,
    simpleMaterials,
    materials: [],
    ink: {
      mode: 'per_job',
      costPerSheet: 0,
      costPerJob: Math.max(0, proposal.custo_tinta),
      sheetCount: Math.max(1, proposal.quantidade_produzida),
    },
    art: {
      mode: 'full',
      totalArtPrice: Math.max(0, proposal.custo_arte),
      sheetsCount: 1,
    },
    labor,
    otherCosts: {
      packaging: otherCosts,
      electricity: 0,
      printing: 0,
      finishing: 0,
      customExpenses: [],
    },
    waste: {
      percentage: Math.max(0, proposal.desperdicio_percentual),
    },
    pricing,
    quantityTiers: [],
    calculationResult: {
      materialsCost: 0,
      inkCost: 0,
      artCost: 0,
      laborCost: 0,
      otherCosts: 0,
      wasteCost: 0,
      subtotalCost: 0,
      totalServiceCost: 0,
      totalSheetsOrUnits: Math.max(1, proposal.quantidade_produzida),
      unitCost: 0,
      originalSalePrice: 0,
      originalUnitPrice: 0,
      discountPercent: 0,
      discountAmount: 0,
      finalSalePrice: 0,
      finalUnitPrice: 0,
      estimatedProfit: 0,
      profitMarginPercent: 0,
      markupPercent: 0,
    },
  };
}

export function AssistantPage({ products, calculations, onFillCalculator }: AssistantPageProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>(() => storageService.getChatConversations());
  const [activeId, setActiveId] = useState<string>(() => conversations[0]?.id || '');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderToPrint, setOrderToPrint] = useState<ServiceOrder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = conversations.find((conversation) => conversation.id === activeId) || null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, isLoading]);

  useEffect(() => {
    if (!activeId && conversations.length === 0) {
      startNewConversation();
    }
  }, []);

  const adjustMessageInputHeight = (textarea: HTMLTextAreaElement) => {
    const maxHeight = window.innerWidth >= 640 ? 144 : 120;
    textarea.style.height = '44px';
    textarea.style.height = `${Math.min(maxHeight, Math.max(44, textarea.scrollHeight))}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  const persistConversations = (updated: ChatConversation[]) => {
    setConversations(updated);
    storageService.saveChatConversations(updated);
  };

  const startNewConversation = () => {
    const now = new Date().toISOString();
    const conversation: ChatConversation = {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: 'Nova conversa',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    persistConversations([conversation, ...conversations]);
    setActiveId(conversation.id);
    setInput('');
    setError('');
    if (messageInputRef.current) {
      messageInputRef.current.style.height = '44px';
      messageInputRef.current.style.overflowY = 'hidden';
    }
  };

  const deleteConversation = (id: string) => {
    const remaining = storageService.deleteChatConversation(id);
    persistConversations(remaining);
    setActiveId(remaining[0]?.id || '');
  };

  const searchRelevantHistory = (query: string) => {
    const normalized = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

    const tokens = normalized.split(/\s+/).filter((token) => token.length >= 3);

    const combined = [
      ...calculations.map((calculation) => {
        const foundProduct = products.find((product) => product.id === calculation.productId);
        return {
          id: calculation.id,
          source: 'historico' as const,
          date: calculation.date,
          name: calculation.productName,
          category: calculation.category,
          description: calculation.notes || foundProduct?.description || '',
          sheetCount: calculation.sheetCount,
          materials: calculation.simpleMaterials || foundProduct?.simpleMaterials || [],
          advancedMaterials: calculation.materials || foundProduct?.materials || [],
          cost: calculation.calculationResult,
        };
      }),
      ...products.map((product) => ({
        id: product.id,
        source: 'catalogo' as const,
        date: product.updatedAt,
        name: product.name,
        category: product.category,
        description: product.description,
        sheetCount: product.sheetCount,
        materials: product.simpleMaterials || [],
        advancedMaterials: product.materials || [],
        cost: product.calculationResult,
      })),
    ];

    return combined
      .map((item) => {
        const materialText = item.materials
          .map((material: any) => String(material.name || material.nome || ''))
          .concat(item.advancedMaterials.map((material: any) => String(material.name || '')))
          .join(' ');
        const searchable = [
          item.name,
          item.description,
          item.category,
          materialText,
          item.date,
        ].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        const score = tokens.reduce((total, token) => {
          if (item.name.toLowerCase().includes(token)) total += 8;
          if (item.description.toLowerCase().includes(token)) total += 5;
          if (materialText.toLowerCase().includes(token)) total += 4;
          if (searchable.includes(token)) total += 2;
          return total;
        }, 0);

        return { ...item, score };
      })
      .sort((first, second) => {
        if (second.score !== first.score) return second.score - first.score;
        return new Date(second.date).getTime() - new Date(first.date).getTime();
      })
      .filter((item, index) => index < 6 && (tokens.length === 0 || item.score > 0));
  };

  const buildLocalContext = (query: string) => {
    const currentMaterialCosts = new Map(
      products.flatMap((product) => [
        ...(product.simpleMaterials || []).map((material) => [String(material.name).toLowerCase(), Number(material.cost || 0)] as [string, number]),
        ...(product.materials || []).map((material) => [String(material.name).toLowerCase(), Number(material.calculatedCost || 0)] as [string, number]),
      ])
    );

    const relevantHistory = searchRelevantHistory(query).map((item) => ({
      id: item.id,
      origem: item.source,
      data: item.date,
      nome: item.name,
      categoria: item.category,
      descricao: item.description,
      quantidade: item.sheetCount,
      materiais: item.materials,
      insumos: item.advancedMaterials,
      custos_materiais_atuais: item.materials.map((material: any) => {
        const name = String(material.name || material.nome || '').trim();
        const oldCost = Number(material.cost || material.custo || 0);
        const currentCost = currentMaterialCosts.get(name.toLowerCase());
        return {
          nome: name,
          custo_do_historico: oldCost,
          custo_atual_cadastrado: currentCost ?? null,
          custo_foi_atualizado: currentCost !== undefined && currentCost !== oldCost,
        };
      }),
      custo_e_preco: item.cost,
      relevancia_local: item.score,
    }));

    const materials = products.flatMap((product) => [
      ...(product.simpleMaterials || []).map((material) => ({
        nome: material.name,
        custo_individual: material.cost,
      })),
      ...(product.materials || []).map((material) => ({
        nome: material.name,
        custo_calculado: material.calculatedCost,
      })),
    ]).slice(0, 40);

    const recentServices = products.slice(0, 12).map((product) => ({
      nome: product.name,
      descricao: product.description,
      quantidade: product.sheetCount,
      custo_total: product.calculationResult?.totalServiceCost,
      preco_final: product.calculationResult?.finalSalePrice,
      margem: product.calculationResult?.profitMarginPercent,
      materiais: (product.simpleMaterials || []).map((material) => ({
        nome: material.name,
        custo: material.cost,
      })),
    }));

    const recentHistory = calculations.slice(0, 12).map((calculation) => ({
      nome: calculation.productName,
      quantidade: calculation.sheetCount,
      custo_total: calculation.calculationResult.totalServiceCost,
      preco_final: calculation.calculationResult.finalSalePrice,
      materiais: calculation.simpleMaterials || [],
    }));

    return {
      materiais_disponiveis: materials,
      resultados_relevantes: relevantHistory,
      servicos_cadastrados: recentServices,
      historico_recente: recentHistory.slice(0, 4),
      configuracoes: storageService.getSettings(),
    };
  };

  const sendMessage = async (suggestedText?: string) => {
    const text = (suggestedText ?? input).trim();
    if (!text || isLoading) return;

    let conversation = activeConversation;
    if (!conversation) {
      const now = new Date().toISOString();
      conversation = {
        id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: text.length > 42 ? `${text.slice(0, 42)}...` : text,
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      persistConversations([conversation, ...conversations]);
      setActiveId(conversation.id);
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    const withUserMessage = {
      ...conversation,
      title: conversation.messages.length === 0 ? (text.length > 42 ? `${text.slice(0, 42)}...` : text) : conversation.title,
      messages: [...conversation.messages, userMessage],
      updatedAt: new Date().toISOString(),
    };

    persistConversations([withUserMessage, ...conversations.filter((item) => item.id !== conversation!.id)]);
    setInput('');
    if (messageInputRef.current) {
      messageInputRef.current.style.height = '44px';
      messageInputRef.current.style.overflowY = 'hidden';
    }
    setIsLoading(true);
    setError('');

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 25000);
      const response = await fetch('/api/analyze-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'chat',
          contexto: buildLocalContext(text),
          conversa: withUserMessage.messages.map((message) => ({ role: message.role, content: message.content })),
          mensagem_atual: text,
        }),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Não foi possível conversar com o assistente agora.');

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: typeof data.resposta === 'string' ? data.resposta : 'Não consegui interpretar esta resposta.',
        proposal: data.proposta || undefined,
        createdAt: new Date().toISOString(),
      };

      const completed = {
        ...withUserMessage,
        messages: [...withUserMessage.messages, assistantMessage],
        updatedAt: new Date().toISOString(),
      };
      persistConversations([completed, ...conversations.filter((item) => item.id !== conversation!.id)]);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') {
        setError('O assistente excedeu o tempo de resposta. Tente novamente.');
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao conectar ao assistente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fillCalculator = (proposal: ChatServiceProposal) => {
    onFillCalculator(createProposalProduct(proposal));
  };

  const generateOrder = (proposal: ChatServiceProposal) => {
    const number = `OS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(storageService.getServiceOrders().length + 1).padStart(3, '0')}`;
    const finalPrice = Math.max(0, proposal.preco_sugerido * (1 - Math.max(0, proposal.desconto_percentual) / 100));
    const order: ServiceOrder = {
      id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      number,
      proposal,
      priceFinal: finalPrice,
      createdAt: new Date().toISOString(),
      observations: proposal.observacoes || '',
    };
    storageService.saveServiceOrder(order);
    setOrderToPrint(order);
  };

  const printOrder = () => {
    window.print();
  };

  return (
    <div className="h-[calc(100dvh-7.5rem)] lg:h-[calc(100vh-4.25rem)] grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
      <aside className="hidden lg:flex card-base flex-col overflow-hidden">
        <div className="p-4 border-b border-pink-100 flex items-center justify-between">
          <h2 className="font-black text-slate-900">Conversas</h2>
          <button type="button" onClick={startNewConversation} className="p-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700" title="Nova conversa">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map((conversation) => (
            <div key={conversation.id} className={`group flex items-center gap-1 rounded-xl ${conversation.id === activeId ? 'bg-pink-50 border border-pink-100' : 'hover:bg-slate-50'}`}>
              <button type="button" onClick={() => setActiveId(conversation.id)} className="flex-1 min-w-0 flex items-center gap-2 px-3 py-3 text-left">
                <MessageSquare className="w-4 h-4 shrink-0 text-brand-600" />
                <span className="text-xs font-semibold text-slate-700 truncate">{conversation.title}</span>
              </button>
              <button type="button" onClick={() => deleteConversation(conversation.id)} className="p-2 mr-1 text-slate-300 hover:text-rose-600" title="Excluir conversa">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main className="card-base min-h-0 flex flex-col overflow-hidden">
        <header className="px-3 sm:px-4 py-2.5 border-b border-pink-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-pink-50 text-brand-600 border border-pink-100 flex items-center justify-center shrink-0">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-slate-900">Assistente IA</h1>
              <p className="text-[11px] text-slate-500 truncate">Ajuda com produtos, custos e precificação</p>
            </div>
          </div>
          <button type="button" onClick={startNewConversation} className="lg:hidden p-2.5 rounded-xl bg-brand-600 text-white" title="Nova conversa">
            <Plus className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-4 py-3 sm:py-4 space-y-3">
          {(!activeConversation || activeConversation.messages.length === 0) && (
            <div className="max-w-lg mx-auto pt-2 sm:pt-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-pink-50 border border-pink-100 text-brand-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-black text-slate-900">Como posso ajudar hoje?</h2>
                <p className="text-xs text-slate-500 mt-1">Conte o que você deseja produzir ou escolha uma sugestão.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {starterMessages.map((message) => (
                  <button key={message} type="button" onClick={() => sendMessage(message)} className="text-left px-3.5 py-3 rounded-xl border border-pink-100 bg-pink-50/40 text-xs font-semibold text-slate-700 hover:bg-pink-100 transition-colors">
                    {message}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeConversation?.messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[92%] sm:max-w-[82%] lg:max-w-[72%] space-y-2 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl text-[13px] sm:text-sm leading-relaxed shadow-sm ${message.role === 'user' ? 'bg-brand-600 text-white rounded-br-md shadow-brand-500/10' : 'bg-white border border-pink-100 text-slate-700 rounded-bl-md space-y-3'}`}>
                    {message.role === 'assistant'
                      ? <div className="space-y-3">{formatAssistantContent(message.content)}</div>
                      : message.content}
                  </div>

                {message.proposal && (
                  <div className="w-full p-4 rounded-2xl border border-pink-200 bg-pink-50/50 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">Resumo da alteração</span>
                      <h3 className="font-black text-slate-900 mt-1">{message.proposal.nome}</h3>
                      {message.proposal.descricao && (
                        <p className="text-xs text-slate-600 mt-1">{message.proposal.descricao}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-white border border-pink-100">
                        <span className="text-slate-500 block">Preço sugerido</span>
                        <strong className="text-brand-700">{formatCurrency(message.proposal.preco_sugerido)}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-pink-100">
                        <span className="text-slate-500 block">Quantidade</span>
                        <strong className="text-slate-900">{message.proposal.quantidade_produzida}</strong>
                      </div>
                    </div>
                    {message.proposal.observacoes && (
                      <p className="text-xs text-slate-600">{message.proposal.observacoes}</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button type="button" onClick={() => fillCalculator(message.proposal!)} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs">
                        <Calculator className="w-4 h-4" />
                        Preencher calculadora
                      </button>
                      <button type="button" onClick={() => sendMessage(`Editar a proposta "${message.proposal!.nome}": `)} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-pink-200 text-brand-700 font-bold text-xs">
                        Editar informações
                      </button>
                      <button type="button" onClick={() => setInput('')} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs">
                        Cancelar
                      </button>
                    </div>
                    <button type="button" onClick={() => generateOrder(message.proposal!)} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-pink-200 text-brand-700 font-bold text-xs">
                      <ReceiptText className="w-4 h-4" />
                      Gerar ordem de serviço
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-slate-50 border border-slate-100 text-xs text-slate-500 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-brand-600" />
                Assistente está pensando...
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-3">{error}</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <footer className="px-2.5 sm:px-4 py-2 sm:py-2.5 border-t border-pink-100 bg-white pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <textarea
              ref={messageInputRef}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                adjustMessageInputHeight(event.currentTarget);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              placeholder="Digite sua mensagem..."
              className="input-base resize-none h-11 max-h-[120px] sm:max-h-[144px] flex-1 py-2.5 leading-5 overflow-hidden scrollbar-thin"
            />
            <button type="button" onClick={() => sendMessage()} disabled={isLoading || !input.trim()} className="w-11 h-11 shrink-0 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white flex items-center justify-center shadow-md">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </footer>
      </main>

      {orderToPrint && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white w-full max-w-2xl max-h-[92dvh] rounded-2xl shadow-2xl border border-pink-100 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-pink-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-brand-700 uppercase">Ordem de serviço</span>
                <h2 className="font-black text-slate-900">{orderToPrint.number}</h2>
              </div>
              <button type="button" onClick={() => setOrderToPrint(null)} className="px-3 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg">Fechar</button>
            </div>
            <div className="p-5 overflow-y-auto text-sm space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">{orderToPrint.proposal.nome}</h3>
                <p className="text-xs text-slate-600 mt-1">{orderToPrint.proposal.descricao}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-pink-50 border border-pink-100"><span className="text-xs text-slate-500">Preço final</span><strong className="block text-brand-700">{formatCurrency(orderToPrint.priceFinal)}</strong></div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><span className="text-xs text-slate-500">Quantidade</span><strong className="block">{orderToPrint.proposal.quantidade_produzida}</strong></div>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-2">Materiais</h4>
                <div className="space-y-1">
                  {orderToPrint.proposal.materiais.map((material, index) => (
                    <div key={`${material.nome}-${index}`} className="flex justify-between gap-3 py-2 border-b border-slate-100 text-xs">
                      <span>{material.nome} â€” {material.quantidade} {material.unidade}</span>
                      <strong>{formatCurrency(material.custo_individual * material.quantidade)}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-600"><strong>Observações:</strong> {orderToPrint.observations || 'Nenhuma.'}</p>
              <p className="text-xs text-slate-400">Criada em {new Date(orderToPrint.createdAt).toLocaleString('pt-BR')}</p>
            </div>
            <div className="p-4 border-t border-pink-100">
              <button type="button" onClick={printOrder} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-600 text-white font-bold text-xs">
                <Printer className="w-4 h-4" /> Imprimir / salvar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

