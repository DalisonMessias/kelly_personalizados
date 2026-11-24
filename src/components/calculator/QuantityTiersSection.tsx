import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Tag, 
  Percent, 
  HelpCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { QuantityTier } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { Tooltip } from '../ui/Tooltip';
import { useToast } from '../ui/Toast';

interface QuantityTiersSectionProps {
  tiers: QuantityTier[];
  unitCost: number;
  baseUnitPrice: number;
  onChangeTiers: (tiers: QuantityTier[]) => void;
}

export function QuantityTiersSection({
  tiers,
  unitCost,
  baseUnitPrice,
  onChangeTiers,
}: QuantityTiersSectionProps) {
  const { info, warning } = useToast();
  const [newQty, setNewQty] = useState<number>(0);
  const [newDiscount, setNewDiscount] = useState<number>(0);

  // Recalcular uma linha específica
  const handleUpdateTier = (id: string, updates: Partial<QuantityTier>) => {
    const updated = tiers.map((tier) => {
      if (tier.id === id) {
        const item = { ...tier, ...updates };

        if (updates.discountPercent !== undefined) {
          item.unitPrice = Number((baseUnitPrice * (1 - updates.discountPercent / 100)).toFixed(2));
        } else if (updates.unitPrice !== undefined) {
          item.discountPercent = baseUnitPrice > 0
            ? Number((((baseUnitPrice - updates.unitPrice) / baseUnitPrice) * 100).toFixed(1))
            : 0;
        }

        item.totalPrice = Number((item.unitPrice * item.quantity).toFixed(2));
        item.estimatedProfit = Number((item.totalPrice - unitCost * item.quantity).toFixed(2));
        return item;
      }
      return tier;
    });

    updated.sort((a, b) => a.quantity - b.quantity);
    onChangeTiers(updated);
  };

  const handleAddTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (newQty <= 0) {
      warning('Quantidade Inválida', 'Informe a quantidade para esta faixa de desconto (ex: 5, 10, 20 unidades).');
      return;
    }

    if (tiers.some((t) => t.quantity === newQty)) {
      info('Quantidade já existente', `Já existe uma faixa cadastrada para ${newQty} unidades.`);
      return;
    }

    const unitPrice = Number((baseUnitPrice * (1 - newDiscount / 100)).toFixed(2));
    const totalPrice = Number((unitPrice * newQty).toFixed(2));
    const estimatedProfit = Number((totalPrice - unitCost * newQty).toFixed(2));

    const newTier: QuantityTier = {
      id: `tier-${Date.now()}`,
      quantity: newQty,
      unitPrice,
      totalPrice,
      discountPercent: newDiscount,
      estimatedProfit,
    };

    const updated = [...tiers, newTier].sort((a, b) => a.quantity - b.quantity);
    onChangeTiers(updated);
    setNewQty(0);
    setNewDiscount(0);
  };

  const handleDeleteTier = (id: string) => {
    onChangeTiers(tiers.filter((t) => t.id !== id));
  };

  return (
    <div className="card-base p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-extrabold text-slate-800 text-base">
              Tabela de Preços por Quantidade (Atacado & Descontos Progressivos)
            </h4>
            <Tooltip content="Cadastre faixas com descontos especiais para encomendas maiores e acompanhe o lucro real que sobra em cada pacote." />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Preço unitário base considerado: <strong>{formatCurrency(baseUnitPrice)}</strong>. Cadastre descontos por volume mantendo seu lucro protegido.
          </p>
        </div>
      </div>

      {/* Formulário de Adicionar Nova Faixa Real */}
      <form onSubmit={handleAddTier} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
            Quantidade
          </label>
          <input
            type="number"
            min={1}
            value={newQty || ''}
            onChange={(e) => setNewQty(Number(e.target.value))}
            className="input-base text-sm py-2"
            placeholder="Ex: 5, 10, 20"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
            % Desconto da Faixa
          </label>
          <input
            type="number"
            min={0}
            max={99}
            step={0.5}
            value={newDiscount || ''}
            onChange={(e) => setNewDiscount(Number(e.target.value))}
            className="input-base text-sm py-2"
            placeholder="Ex: 10"
          />
        </div>

        <div className="flex flex-col justify-end">
          <div className="text-[11px] text-slate-500 pb-1">
            Preço unitário: <strong>{formatCurrency(baseUnitPrice * (1 - newDiscount / 100))}</strong>
          </div>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Faixa</span>
          </button>
        </div>
      </form>

      {/* Tabela de Faixas */}
      {tiers.length === 0 ? (
        <div className="py-6 text-center text-slate-400 text-xs">
          Nenhuma faixa de atacado cadastrada para este produto. Adicione as quantidades desejadas acima para oferecer descontos por volume mantendo o controle do lucro.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[11px]">
                <th className="py-2.5 px-3">Quantidade</th>
                <th className="py-2.5 px-3">Preço / Unidade</th>
                <th className="py-2.5 px-3">Preço Total</th>
                <th className="py-2.5 px-3">Desconto (%)</th>
                <th className="py-2.5 px-3 text-emerald-700">Lucro Restante</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {tiers.map((tier) => (
                <tr key={tier.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {tier.quantity} {tier.quantity === 1 ? 'unidade' : 'unidades'}
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      value={tier.unitPrice}
                      onChange={(e) => handleUpdateTier(tier.id, { unitPrice: Number(e.target.value) })}
                      className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-brand-500"
                    />
                  </td>
                  <td className="py-3 px-3 font-extrabold text-slate-900">
                    {formatCurrency(tier.totalPrice)}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      tier.discountPercent > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {tier.discountPercent}% OFF
                    </span>
                  </td>
                  <td className="py-3 px-3 font-bold text-emerald-600">
                    {formatCurrency(tier.estimatedProfit)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteTier(tier.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Excluir faixa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
