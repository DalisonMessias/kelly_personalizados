import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Trash2, 
  Calendar, 
  Eye, 
  Calculator, 
  PlusCircle, 
  FolderOpen,
  Copy
} from 'lucide-react';
import { CalculationRecord, ProductService } from '../../types';
import { formatCurrency, formatPercent } from '../../utils/calculations';
import { storageService } from '../../services/storage';
import { CustomModal } from '../ui/CustomModal';
import { CustomDateInput } from '../ui/CustomDateInput';
import { useToast } from '../ui/Toast';
import { NavTab } from '../layout/Sidebar';

interface HistoryPageProps {
  calculations: CalculationRecord[];
  products: ProductService[];
  onNavigate: (tab: NavTab) => void;
  onRefreshCalculations: () => void;
  onLoadIntoCalculator: (product: ProductService) => void;
  onDuplicateProduct: (product: ProductService) => void;
}

export function HistoryPage({
  calculations,
  products,
  onNavigate,
  onRefreshCalculations,
  onLoadIntoCalculator,
  onDuplicateProduct,
}: HistoryPageProps) {
  const { success } = useToast();
  const settings = storageService.getSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modais de exclusão
  const [calcToDelete, setCalcToDelete] = useState<CalculationRecord | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);

  // Modal de Detalhes
  const [selectedCalc, setSelectedCalc] = useState<CalculationRecord | null>(null);

  const filteredCalculations = calculations.filter((item) => {
    const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDate = !dateFilter || item.date.startsWith(dateFilter);
    return matchesSearch && matchesDate;
  });

  const confirmDeleteOne = () => {
    if (calcToDelete) {
      storageService.deleteCalculation(calcToDelete.id);
      onRefreshCalculations();
      success('Registro excluído', 'O cálculo foi removido do seu histórico.');
      setCalcToDelete(null);
    }
  };

  const confirmClearAll = () => {
    calculations.forEach((c) => storageService.deleteCalculation(c.id));
    onRefreshCalculations();
    success('Histórico limpo', 'Todos os cálculos anteriores foram excluídos.');
  };

  const buildRestoredProduct = (calc: CalculationRecord): ProductService => {
    const foundProduct = products.find((p) => p.id === calc.productId);

    return {
      id: foundProduct?.id || `calc-restore-${Date.now()}`,
      name: calc.productName,
      category: foundProduct?.category || calc.category || 'adesivos',
      description: calc.notes || foundProduct?.description || '',
      sheetCount: calc.sheetCount || foundProduct?.sheetCount || 1,
      createdAt: foundProduct?.createdAt || calc.date,
      updatedAt: new Date().toISOString(),
      simpleMaterials: calc.simpleMaterials || foundProduct?.simpleMaterials || [],
      materials: calc.materials || foundProduct?.materials || [],
      ink: calc.ink || foundProduct?.ink || {
        mode: 'per_sheet',
        costPerSheet: settings.defaultInkCostPerSheet || 0.15,
        costPerJob: calc.calculationResult.inkCost,
        sheetCount: calc.sheetCount || 1,
      },
      art: calc.art || foundProduct?.art || {
        mode: 'full',
        totalArtPrice: calc.calculationResult.artCost,
        sheetsCount: 1,
      },
      labor: calc.labor || foundProduct?.labor || {
        hourlyRate: settings.defaultHourlyRate || 20.0,
        timeSpent: 0,
        timeUnit: 'minutes',
      },
      otherCosts: calc.otherCosts || foundProduct?.otherCosts || {
        packaging: 0,
        electricity: 0,
        printing: 0,
        finishing: 0,
        customExpenses: [],
      },
      waste: calc.waste || foundProduct?.waste || {
        percentage: settings.defaultWastePercentage || 5.0,
      },
      pricing: calc.pricing || foundProduct?.pricing || {
        method: 'manual',
        targetMargin: calc.calculationResult.profitMarginPercent,
        targetMarkup: calc.calculationResult.markupPercent,
        manualPrice: calc.calculationResult.finalSalePrice,
        discountPercent: calc.calculationResult.discountPercent,
      },
      quantityTiers: calc.quantityTiers || foundProduct?.quantityTiers || [],
      calculationResult: calc.calculationResult,
    };
  };

  const handleReopenInCalculator = (calc: CalculationRecord) => {
    onLoadIntoCalculator(buildRestoredProduct(calc));
    onNavigate('calculator');
  };

  const handleDuplicateFromHistory = (calc: CalculationRecord) => {
    const restored = buildRestoredProduct(calc);
    onDuplicateProduct({
      ...restored,
      name: `${restored.name} (Cópia)`,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Topo do Histórico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Histórico de Cálculos & Orçamentos
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Consulte orçamentos gerados, compare lucros e reabra cálculos anteriores com um clique.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {calculations.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearAllModalOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors"
            >
              Limpar Histórico
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate('calculator')}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-500/20 active:scale-95 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Cálculo</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-8 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome do produto ou anotação..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 shadow-sm"
          />
        </div>

        <div className="sm:col-span-4">
          <CustomDateInput
            value={dateFilter}
            onChange={setDateFilter}
            placeholder="Filtrar por data"
          />
        </div>
      </div>

      {/* Lista de Registros do Histórico */}
      {filteredCalculations.length === 0 ? (
        <div className="card-base p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <History className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Nenhum orçamento arquivado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Quando você clicar no botão "Salvar no Histórico" na Calculadora, seus cálculos ficarão registrados aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCalculations.map((calc) => (
            <div
              key={calc.id}
              className="card-base p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-brand-200 transition-all"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {calc.productName}
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    {calc.sheetCount} {calc.sheetCount === 1 ? 'folha/peça' : 'folhas/peças'}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(calc.date).toLocaleDateString('pt-BR')} às {new Date(calc.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <span>•</span>
                  <span>Custo Total: <strong>{formatCurrency(calc.calculationResult.totalServiceCost)}</strong></span>
                  <span>•</span>
                  <span>Unitário: <strong>{formatCurrency(calc.calculationResult.unitCost)}</strong></span>
                </div>

                {calc.notes && (
                  <p className="text-xs text-slate-500 italic">
                    "{calc.notes}"
                  </p>
                )}
              </div>

              {/* Informações Financeiras e Ações */}
              <div className="flex items-center justify-between sm:justify-end gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <div className="text-left sm:text-right">
                  <div className="flex items-center sm:justify-end gap-1.5 mb-0.5">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                      Preço Final
                    </span>
                    {(calc.calculationResult.discountPercent ?? 0) > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">
                        -{calc.calculationResult.discountPercent}% OFF
                      </span>
                    )}
                  </div>
                  {(calc.calculationResult.discountPercent ?? 0) > 0 && (
                    <span className="text-xs text-slate-400 line-through block leading-tight">
                      {formatCurrency(calc.calculationResult.originalSalePrice)}
                    </span>
                  )}
                  <span className="text-lg font-black text-brand-600 block">
                    {formatCurrency(calc.calculationResult.finalSalePrice)}
                  </span>
                  <span className="text-xs text-emerald-600 font-semibold block">
                    +{formatCurrency(calc.calculationResult.estimatedProfit)} ({formatPercent(calc.calculationResult.profitMarginPercent)})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCalc(calc)}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Ver detalhes do cálculo"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReopenInCalculator(calc)}
                    className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                    title="Reabrir na calculadora"
                  >
                    <Calculator className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateFromHistory(calc)}
                    className="flex items-center gap-1.5 px-2.5 py-2 text-brand-700 hover:bg-pink-50 border border-pink-100 rounded-lg transition-colors"
                    title="Duplicar serviço"
                  >
                    <Copy className="w-4 h-4" />
                    <span className="hidden md:inline text-xs font-bold">Duplicar serviço</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCalcToDelete(calc);
                      setIsDeleteModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Excluir cálculo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Detalhes do Cálculo */}
      {selectedCalc && (
        <CustomModal
          isOpen={!!selectedCalc}
          onClose={() => setSelectedCalc(null)}
          title={`Detalhamento do Cálculo: ${selectedCalc.productName}`}
          confirmText="Reabrir na Calculadora"
          cancelText="Fechar"
          onConfirm={() => {
            handleReopenInCalculator(selectedCalc);
            setSelectedCalc(null);
          }}
        >
          <div className="space-y-4 text-xs text-slate-600">
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <p><strong>Data do cálculo:</strong> {new Date(selectedCalc.date).toLocaleString('pt-BR')}</p>
              <p><strong>Quantidade:</strong> {selectedCalc.sheetCount} folhas/peças</p>
              {selectedCalc.notes && <p><strong>Anotações:</strong> {selectedCalc.notes}</p>}
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <div className="flex justify-between py-1">
                <span>Materiais:</span>
                <strong className="text-slate-800">{formatCurrency(selectedCalc.calculationResult.materialsCost)}</strong>
              </div>
              <div className="flex justify-between py-1">
                <span>Tinta:</span>
                <strong className="text-slate-800">{formatCurrency(selectedCalc.calculationResult.inkCost)}</strong>
              </div>
              <div className="flex justify-between py-1">
                <span>Arte:</span>
                <strong className="text-slate-800">{formatCurrency(selectedCalc.calculationResult.artCost)}</strong>
              </div>
              <div className="flex justify-between py-1">
                <span>Mão de Obra:</span>
                <strong className="text-slate-800">{formatCurrency(selectedCalc.calculationResult.laborCost)}</strong>
              </div>
              <div className="flex justify-between py-1">
                <span>Perdas / Desperdício:</span>
                <strong className="text-amber-700">+{formatCurrency(selectedCalc.calculationResult.wasteCost)}</strong>
              </div>
            </div>

            <div className="p-3 bg-brand-50 rounded-xl border border-brand-100 space-y-1.5">
              <div className="flex justify-between">
                <span className="font-semibold text-brand-900">Custo Total de Produção:</span>
                <strong className="text-slate-900">{formatCurrency(selectedCalc.calculationResult.totalServiceCost)}</strong>
              </div>

              {(selectedCalc.calculationResult.discountPercent ?? 0) > 0 && (
                <>
                  <div className="flex justify-between text-slate-500">
                    <span>Preço Original de Venda:</span>
                    <span className="line-through">{formatCurrency(selectedCalc.calculationResult.originalSalePrice)}</span>
                  </div>
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Desconto Aplicado (-{selectedCalc.calculationResult.discountPercent}%):</span>
                    <span>-{formatCurrency(selectedCalc.calculationResult.discountAmount)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-brand-700 font-bold pt-0.5">
                <span>Preço Final de Venda:</span>
                <span className="text-sm">{formatCurrency(selectedCalc.calculationResult.finalSalePrice)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-semibold pt-1 border-t border-brand-200/60">
                <span>Lucro Líquido Restante:</span>
                <span>+{formatCurrency(selectedCalc.calculationResult.estimatedProfit)} ({formatPercent(selectedCalc.calculationResult.profitMarginPercent)})</span>
              </div>
            </div>
          </div>
        </CustomModal>
      )}

      {/* Modal de Exclusão Individual */}
      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCalcToDelete(null);
        }}
        title="Excluir Cálculo do Histórico?"
        description={`Deseja excluir permanentemente o registro de "${calcToDelete?.productName}"?`}
        confirmText="Sim, Excluir"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={confirmDeleteOne}
      />

      {/* Modal de Limpeza Total */}
      <CustomModal
        isOpen={isClearAllModalOpen}
        onClose={() => setIsClearAllModalOpen(false)}
        title="Limpar Todo o Histórico?"
        description="Tem certeza de que deseja apagar todos os cálculos salvos no histórico? Esta ação é definitiva."
        confirmText="Sim, Limpar Tudo"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={confirmClearAll}
      />
    </div>
  );
}
