import React from 'react';
import { 
  TrendingUp, 
  HelpCircle, 
  Info, 
  Tag, 
  Coins, 
  Percent,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { CalculationResult, PricingConfig } from '../../types';
import { formatCurrency, formatPercent } from '../../utils/calculations';
import { Tooltip } from '../ui/Tooltip';

interface CostSummaryCardProps {
  result: CalculationResult;
  pricing: PricingConfig;
  sheetCount: number;
}

export function CostSummaryCard({ result, pricing, sheetCount }: CostSummaryCardProps) {
  const hasDiscount = result.discountPercent > 0;
  const isLoss = result.estimatedProfit < 0;

  return (
    <div className="card-base p-5 sm:p-6 bg-white border-2 border-brand-100 shadow-lg shadow-brand-500/5 space-y-5 sm:space-y-6 relative z-0">
      {/* Topo do Resumo */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-600 block">
            Resumo Financeiro
          </span>
          <h3 className="text-lg font-extrabold text-slate-800">
            Transparência de Custos
          </h3>
        </div>
        <div className="px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold">
          {sheetCount} {sheetCount === 1 ? 'unidade/folha' : 'unidades/folhas'}
        </div>
      </div>

      {/* Composição Detalhada dos Custos de Produção */}
      <div className="space-y-2.5 text-xs text-slate-600">
        <div className="flex items-center justify-between py-1 border-b border-slate-50">
          <span className="flex items-center gap-1.5">
            <span>Materiais Proporcionais</span>
            <Tooltip content="Soma proporcional do custo dos materiais realmente gastos neste serviço." />
          </span>
          <span className="font-semibold text-slate-800">{formatCurrency(result.materialsCost)}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-slate-50">
          <span className="flex items-center gap-1.5">
            <span>Tinta de Impressão</span>
            <Tooltip content="Estimativa do desgaste de cartuchos e custo de tinta por folha impressa." />
          </span>
          <span className="font-semibold text-slate-800">{formatCurrency(result.inkCost)}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-slate-50">
          <span className="flex items-center gap-1.5">
            <span>Criação da Arte</span>
            <Tooltip content="Custo da criação do design (integral ou rateado proporcionalmente pelas folhas)." />
          </span>
          <span className="font-semibold text-slate-800">{formatCurrency(result.artCost)}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-slate-50">
          <span className="flex items-center gap-1.5">
            <span>Mão de Obra (Tempo)</span>
            <Tooltip content="Tempo dedicado à montagem, corte e finalização multiplicado pelo seu valor por hora." />
          </span>
          <span className="font-semibold text-slate-800">{formatCurrency(result.laborCost)}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-slate-50">
          <span className="flex items-center gap-1.5">
            <span>Outros Custos / Extras</span>
            <Tooltip content="Embalagens, energia elétrica e despesas extras." />
          </span>
          <span className="font-semibold text-slate-800">{formatCurrency(result.otherCosts)}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-slate-50 text-amber-700 bg-amber-50/50 px-2 rounded-lg">
          <span className="flex items-center gap-1.5">
            <span>Perdas / Desperdício</span>
            <Tooltip content="Margem de segurança para folhas perdidas ou erros de corte." />
          </span>
          <span className="font-semibold">+{formatCurrency(result.wasteCost)}</span>
        </div>
      </div>

      {/* Custo Total de Produção */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Custo Total de Produção
          </span>
          <span className="text-base font-extrabold text-slate-900">
            {formatCurrency(result.totalServiceCost)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200/50">
          <span>Custo por unidade/folha:</span>
          <span className="font-semibold text-slate-700">{formatCurrency(result.unitCost)}</span>
        </div>
      </div>

      {/* Bloco de Precificação com Desconto Transparente */}
      <div className={`p-5 rounded-2xl text-white shadow-lg space-y-3 transition-all ${
        isLoss
          ? 'bg-gradient-to-br from-rose-600 to-red-700 shadow-rose-500/20'
          : 'bg-gradient-to-br from-brand-600 via-pink-600 to-rose-500 shadow-brand-500/20'
      }`}>
        <div>
          <div className="flex items-center justify-between text-xs text-pink-100 font-medium mb-1">
            <span>{hasDiscount ? 'Preço Final com Desconto' : 'Preço de Venda Sugerido'}</span>
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-bold">
              {pricing.method === 'margin' && 'Por Margem'}
              {pricing.method === 'markup' && 'Por Markup'}
              {pricing.method === 'manual' && 'Preço Manual'}
            </span>
          </div>

          {/* Preço Original se houver desconto */}
          {hasDiscount && (
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs text-pink-200 line-through">
                {formatCurrency(result.originalSalePrice)}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-400/30 text-emerald-100 text-[11px] font-bold">
                {result.discountPercent}% OFF (-{formatCurrency(result.discountAmount)})
              </span>
            </div>
          )}

          <div className="text-3xl font-black tracking-tight">
            {formatCurrency(result.finalSalePrice)}
          </div>
          <div className="text-xs text-pink-100 mt-1">
            Equivalente a <strong className="text-white">{formatCurrency(result.finalUnitPrice)}</strong> por unidade/folha
          </div>
        </div>

        {/* Detalhamento do Desconto quando aplicado */}
        {hasDiscount && (
          <div className="p-2.5 rounded-xl bg-black/15 text-xs text-pink-100 space-y-1">
            <div className="flex justify-between">
              <span>Preço Original:</span>
              <strong className="text-white">{formatCurrency(result.originalSalePrice)}</strong>
            </div>
            <div className="flex justify-between text-emerald-200">
              <span>Desconto de {result.discountPercent}%:</span>
              <strong className="text-emerald-300">-{formatCurrency(result.discountAmount)}</strong>
            </div>
          </div>
        )}

        {/* Lucro Restante em Destaque */}
        <div className="pt-3 border-t border-white/20 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-pink-200 font-semibold block">
              Lucro Restante
            </span>
            <span className="text-xl font-extrabold text-white">
              {formatCurrency(result.estimatedProfit)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-pink-200 font-semibold block">
              Margem Real
            </span>
            <span className={`text-base font-bold ${isLoss ? 'text-rose-200' : 'text-emerald-300'}`}>
              {formatPercent(result.profitMarginPercent)}
            </span>
          </div>
        </div>

        {/* Alerta de Prejuízo caso o desconto exceda o lucro */}
        {isLoss && (
          <div className="p-2.5 rounded-xl bg-white/20 flex items-center gap-2 text-xs text-white">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-300" />
            <span>Atenção: Este desconto deixa o preço abaixo do custo de produção!</span>
          </div>
        )}
      </div>

      {/* Caixa Informativa */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 space-y-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
          <Info className="w-3.5 h-3.5 text-brand-600" />
          <span>Como seu preço é calculado:</span>
        </div>
        <p className="leading-relaxed text-[11px]">
          • <strong>Desconto:</strong> É aplicado sobre o valor de venda. Seu custo de produção permanece protegido em {formatCurrency(result.totalServiceCost)}.
        </p>
        <p className="leading-relaxed text-[11px]">
          • <strong>Lucro Restante:</strong> Após conceder o desconto ao cliente, você ainda coloca {formatCurrency(result.estimatedProfit)} de lucro no bolso.
        </p>
      </div>
    </div>
  );
}
