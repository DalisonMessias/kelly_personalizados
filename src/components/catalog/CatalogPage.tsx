import React, { useState } from 'react';
import { 
  FolderKanban, 
  Search, 
  Plus, 
  Copy, 
  Trash2, 
  Edit3, 
  Clock, 
  Layers, 
  Eye, 
  X,
  PackageOpen,
  PlusCircle
} from 'lucide-react';
import { ProductService } from '../../types';
import { formatCurrency, formatPercent } from '../../utils/calculations';
import { storageService } from '../../services/storage';
import { CustomModal } from '../ui/CustomModal';
import { useToast } from '../ui/Toast';
import { NavTab } from '../layout/Sidebar';

interface CatalogPageProps {
  products: ProductService[];
  onNavigate: (tab: NavTab) => void;
  onEditProduct: (product: ProductService) => void;
  onRefreshProducts: () => void;
}

export function CatalogPage({
  products,
  onNavigate,
  onEditProduct,
  onRefreshProducts,
}: CatalogPageProps) {
  const { success } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  // Modal de exclusão
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductService | null>(null);

  // Modal de Ficha Técnica
  const [viewingProduct, setViewingProduct] = useState<ProductService | null>(null);

  const categoryFilters = [
    { id: 'todos', label: 'Todos os Serviços' },
    { id: 'adesivos', label: 'Adesivos & Rótulos' },
    { id: 'topo_bolo', label: 'Topos de Bolo' },
    { id: 'lembrancinhas', label: 'Lembrancinhas' },
    { id: 'etiquetas', label: 'Etiquetas Escolares' },
    { id: 'convites', label: 'Convites' },
    { id: 'outro', label: 'Outros' },
  ];

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'todos' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDuplicate = (id: string) => {
    const duplicated = storageService.duplicateProduct(id);
    if (duplicated) {
      onRefreshProducts();
      success('Serviço duplicado!', `Criada cópia de "${duplicated.name}".`);
    }
  };

  const confirmDelete = () => {
    if (productToDelete) {
      storageService.deleteProduct(productToDelete.id);
      onRefreshProducts();
      success('Produto excluído', `"${productToDelete.name}" foi removido do catálogo.`);
      setProductToDelete(null);
    }
  };

  const getCategoryBadge = (category: string) => {
    const map: Record<string, { label: string; bg: string }> = {
      adesivos: { label: 'Adesivos', bg: 'bg-pink-100 text-pink-700' },
      topo_bolo: { label: 'Topo de Bolo', bg: 'bg-purple-100 text-purple-700' },
      lembrancinhas: { label: 'Lembrancinhas', bg: 'bg-amber-100 text-amber-700' },
      etiquetas: { label: 'Etiquetas', bg: 'bg-blue-100 text-blue-700' },
      convites: { label: 'Convites', bg: 'bg-emerald-100 text-emerald-700' },
      papelaria_festa: { label: 'Festa', bg: 'bg-rose-100 text-rose-700' },
      outro: { label: 'Personalizado', bg: 'bg-slate-100 text-slate-700' },
    };
    return map[category] || { label: 'Personalizado', bg: 'bg-slate-100 text-slate-700' };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Topo do Catálogo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Catálogo de Serviços & Personalizados
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Seus produtos cadastrados com fichas técnicas de insumos, tempos de produção e preços de venda.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('calculator')}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-500/20 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Serviço</span>
        </button>
      </div>

      {/* Barra de Filtros e Busca (Aparece se houver produtos ou busca ativa) */}
      {(products.length > 0 || searchTerm) && (
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome do produto ou material..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 shadow-sm"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {categoryFilters.map((filter) => {
              const isSelected = selectedCategory === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSelectedCategory(filter.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid de Cards de Produtos ou Estado Vazio */}
      {products.length === 0 ? (
        <div className="card-base p-12 text-center space-y-4">
          <PackageOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-extrabold text-slate-800 text-lg">Seu catálogo está vazio</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Você ainda não cadastrou nenhum produto. Abra a Calculadora para calcular seus custos de materiais, definir sua margem de lucro e salvar o produto aqui no catálogo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('calculator')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md shadow-brand-500/20 active:scale-95 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Calcular e Cadastrar Primeiro Produto</span>
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card-base p-12 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-700">Nenhum produto encontrado para sua busca</p>
          <p className="text-xs text-slate-400">Tente buscar por outro termo ou selecione "Todos os Serviços".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((p) => {
            const badge = getCategoryBadge(p.category);
            return (
              <div
                key={p.id}
                className="card-base p-5 flex flex-col justify-between hover:border-brand-200 hover:shadow-md transition-all group space-y-4"
              >
                <div className="space-y-3">
                  {/* Topo do Card */}
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${badge.bg}`}>
                      {badge.label}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {p.materials.length} {p.materials.length === 1 ? 'insumo' : 'insumos'}
                    </span>
                  </div>

                  {/* Nome e Descrição */}
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base group-hover:text-brand-600 transition-colors line-clamp-1">
                      {p.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                      {p.description || 'Produto personalizado cadastrado.'}
                    </p>
                  </div>

                  {/* Detalhes de Tempo e Quantidade Base */}
                  <div className="flex items-center gap-3 text-xs text-slate-600 pt-1">
                    <div className="flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-brand-600" />
                      <span>{p.labor?.timeSpent || 0} {p.labor?.timeUnit === 'minutes' ? 'min' : 'h'}</span>
                    </div>
                    <span>•</span>
                    <div>
                      <span>Base: <strong>{p.sheetCount || 1} un</strong></span>
                    </div>
                  </div>

                  {/* Bloco Financeiro */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Custo Total:</span>
                      <strong className="text-slate-800">
                        {formatCurrency(p.calculationResult?.totalServiceCost)}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50">
                      <div className="flex items-center gap-1.5">
                        <span className="text-brand-600 font-bold">Preço de Venda:</span>
                        {(p.calculationResult?.discountPercent ?? 0) > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                            -{p.calculationResult.discountPercent}% OFF
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        {(p.calculationResult?.discountPercent ?? 0) > 0 && (
                          <span className="text-[11px] text-slate-400 line-through block leading-tight">
                            {formatCurrency(p.calculationResult.originalSalePrice)}
                          </span>
                        )}
                        <strong className="text-brand-700 text-base font-black">
                          {formatCurrency(p.calculationResult?.finalSalePrice)}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-emerald-600 font-semibold pt-1 border-t border-slate-200/50">
                      <span>Lucro: +{formatCurrency(p.calculationResult?.estimatedProfit)}</span>
                      <span>Margem: {formatPercent(p.calculationResult?.profitMarginPercent)}</span>
                    </div>
                  </div>
                </div>

                {/* Ações do Card */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setViewingProduct(p)}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Ver Ficha Técnica"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(p.id)}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Duplicar Serviço"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProductToDelete(p);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onEditProduct(p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold text-xs rounded-xl transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setProductToDelete(null);
        }}
        title="Excluir Produto do Catálogo?"
        description={`Tem certeza que deseja remover o produto "${productToDelete?.name}"? Esta ação não poderá ser desfeita.`}
        confirmText="Sim, Excluir"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={confirmDelete}
      />

      {/* Modal de Ficha Técnica Completa */}
      {viewingProduct && (
        <CustomModal
          isOpen={!!viewingProduct}
          onClose={() => setViewingProduct(null)}
          title={`Ficha Técnica: ${viewingProduct.name}`}
          confirmText="Editar na Calculadora"
          cancelText="Fechar"
          onConfirm={() => {
            onEditProduct(viewingProduct);
            setViewingProduct(null);
          }}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-1.5">
              <p><strong>Descrição:</strong> {viewingProduct.description || 'Sem observações.'}</p>
              <div className="flex gap-4 pt-1">
                <span><strong>Tempo de produção:</strong> {viewingProduct.labor.timeSpent} {viewingProduct.labor.timeUnit === 'minutes' ? 'minutos' : 'horas'}</span>
                <span><strong>Mão de obra:</strong> R$ {viewingProduct.labor.hourlyRate}/h</span>
              </div>
            </div>

            {/* Insumos Utilizados */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Insumos Utilizados
              </h4>
              <div className="space-y-1.5 border border-slate-100 rounded-xl p-3 bg-white">
                {viewingProduct.materials.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum material cadastrado para este item.</p>
                ) : (
                  viewingProduct.materials.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-b-0">
                      <div>
                        <span className="font-semibold text-slate-800">{m.name}</span>
                        <span className="text-slate-400 ml-1.5">
                          ({m.usedQuantity} {m.unit} de {m.purchaseQuantity} {m.unit}s a {formatCurrency(m.purchasePrice)})
                        </span>
                      </div>
                      <span className="font-bold text-slate-700">{formatCurrency(m.calculatedCost)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Decomposição Financeira */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
              <h4 className="font-bold text-slate-700 uppercase text-[11px] tracking-wider mb-1">
                Composição dos Custos de Produção
              </h4>
              <div className="flex justify-between">
                <span className="text-slate-500">Materiais:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(viewingProduct.calculationResult.materialsCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tinta de Impressão:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(viewingProduct.calculationResult.inkCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Criação da Arte:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(viewingProduct.calculationResult.artCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mão de Obra ({viewingProduct.labor.timeSpent} min):</span>
                <span className="font-semibold text-slate-800">{formatCurrency(viewingProduct.calculationResult.laborCost)}</span>
              </div>
              <div className="flex justify-between text-amber-700 font-semibold">
                <span>Perdas / Desperdício:</span>
                <span>+{formatCurrency(viewingProduct.calculationResult.wasteCost)}</span>
              </div>
            </div>

            {/* Resumo Financeiro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                <span className="text-slate-500 block">Custo Total de Produção:</span>
                <strong className="text-base font-extrabold text-slate-900">
                  {formatCurrency(viewingProduct.calculationResult.totalServiceCost)}
                </strong>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Unitário: {formatCurrency(viewingProduct.calculationResult.unitCost)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-brand-50 border border-brand-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-brand-600 font-semibold block">Preço Final de Venda:</span>
                  {(viewingProduct.calculationResult.discountPercent ?? 0) > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                      -{viewingProduct.calculationResult.discountPercent}% OFF
                    </span>
                  )}
                </div>

                {(viewingProduct.calculationResult.discountPercent ?? 0) > 0 && (
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>Preço Original:</span>
                    <span className="line-through">{formatCurrency(viewingProduct.calculationResult.originalSalePrice)}</span>
                  </div>
                )}

                {(viewingProduct.calculationResult.discountPercent ?? 0) > 0 && (
                  <div className="text-[11px] text-rose-600 font-semibold flex justify-between">
                    <span>Desconto Concedido:</span>
                    <span>-{formatCurrency(viewingProduct.calculationResult.discountAmount)}</span>
                  </div>
                )}

                <strong className="text-base font-black text-brand-700 block">
                  {formatCurrency(viewingProduct.calculationResult.finalSalePrice)}
                </strong>
                <span className="text-[11px] text-emerald-600 font-bold block pt-1 border-t border-brand-200/50">
                  Lucro Restante: +{formatCurrency(viewingProduct.calculationResult.estimatedProfit)} ({formatPercent(viewingProduct.calculationResult.profitMarginPercent)})
                </span>
              </div>
            </div>

            {/* Tabela de Preços por Quantidade */}
            {viewingProduct.quantityTiers && viewingProduct.quantityTiers.length > 0 && (
              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Tabela de Descontos por Quantidade (Atacado)
                </h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 text-[11px]">
                      <tr>
                        <th className="py-2 px-3">Quantidade</th>
                        <th className="py-2 px-3">Unitário</th>
                        <th className="py-2 px-3">Total</th>
                        <th className="py-2 px-3 text-emerald-600">Lucro Real</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingProduct.quantityTiers.map((t) => (
                        <tr key={t.id}>
                          <td className="py-1.5 px-3 font-semibold">{t.quantity} un</td>
                          <td className="py-1.5 px-3">{formatCurrency(t.unitPrice)}</td>
                          <td className="py-1.5 px-3 font-bold text-brand-700">{formatCurrency(t.totalPrice)}</td>
                          <td className="py-1.5 px-3 text-emerald-600 font-medium">{formatCurrency(t.estimatedProfit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </CustomModal>
      )}
    </div>
  );
}
