import React from 'react';
import { 
  DollarSign, 
  Package, 
  TrendingUp, 
  Calculator, 
  Receipt, 
  ArrowUpRight, 
  PlusCircle, 
  Calendar, 
  Layers, 
  Sparkles,
  PackageOpen,
  ClipboardList,
  UserCog
} from 'lucide-react';
import { CalculationRecord, ProductService } from '../../types';
import { formatCurrency, formatPercent } from '../../utils/calculations';
import { NavTab } from '../layout/Sidebar';

interface DashboardProps {
  products: ProductService[];
  calculations: CalculationRecord[];
  onNavigate: (tab: NavTab, targetId?: string) => void;
  onEditProduct: (product: ProductService) => void;
}

export function Dashboard({ products, calculations, onNavigate, onEditProduct }: DashboardProps) {
  const totalProducts = products.length;
  const totalCalculations = calculations.length;

  const totalCosts = products.reduce((acc, p) => acc + (p.calculationResult?.totalServiceCost || 0), 0);
  const totalEstimatedSales = products.reduce((acc, p) => acc + (p.calculationResult?.finalSalePrice || 0), 0);
  const totalEstimatedProfit = products.reduce((acc, p) => acc + (p.calculationResult?.estimatedProfit || 0), 0);

  const averageMargin = totalEstimatedSales > 0 ? (totalEstimatedProfit / totalEstimatedSales) * 100 : 0;

  const recentProducts = products.slice(0, 5);
  const recentCalculations = calculations.slice(0, 5);

  const getCategoryLabel = (category: string) => {
    const map: Record<string, string> = {
      adesivos: 'Folha de Adesivos',
      topo_bolo: 'Topo de Bolo',
      lembrancinhas: 'Lembrancinhas',
      etiquetas: 'Etiquetas',
      convites: 'Convites',
      papelaria_festa: 'Papelaria de Festa',
      outro: 'Personalizado',
    };
    return map[category] || 'Personalizado';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Cabeçalho Oficial Kelly Personalizados */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-pink-50 via-white to-pink-100/70 p-5 sm:p-8 rounded-2xl text-slate-900 border border-pink-200 shadow-sm">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-pink-200 text-brand-700 text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Kelly Personalizados</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Olá, Kelly! Bem-vinda ao seu ateliê
          </h2>
          <p className="text-slate-600 text-sm max-w-xl">
            {totalProducts === 0
              ? 'Seu aplicativo está pronto para receber suas encomendas. Cadastre seus materiais e custos para precificar de forma justa e descobrir seu lucro real.'
              : `Você tem ${totalProducts} ${totalProducts === 1 ? 'produto cadastrado' : 'produtos cadastrados'} no catálogo com margem média de ${formatPercent(averageMargin)}.`}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => onNavigate('users')}
            className="flex items-center justify-center gap-2 rounded-2xl border border-pink-200 bg-white px-5 py-3 text-sm font-bold text-brand-700 shadow-sm transition-all hover:bg-pink-50 active:scale-95"
          >
            <UserCog className="h-4 w-4" />
            <span>Gerenciar usuários</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('store-orders')}
            className="flex items-center justify-center gap-2 rounded-2xl bg-pink-600 px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-pink-700 active:scale-95"
          >
            <ClipboardList className="h-4 w-4" />
            <span>Ver pedidos da loja</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('calculator')}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-brand-700 hover:bg-brand-50 font-bold text-sm shadow-md active:scale-95 transition-all"
          >
            <PlusCircle className="w-4 h-4 text-brand-600" />
            <span>Calcular Novo Preço</span>
          </button>
        </div>
      </div>

      {/* Grid de Cards Financeiros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Card 1: Lucro Estimado */}
        <div className="card-base p-5 sm:p-6 bg-pink-50/60 border-pink-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Lucro Real Estimado</span>
            <div className="p-2 rounded-xl bg-white text-brand-600 border border-pink-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 break-words">{formatCurrency(totalEstimatedProfit)}</div>
          <div className="mt-2 text-xs text-slate-600 font-medium">
            {totalProducts > 0 ? `Margem média de ${formatPercent(averageMargin)}` : 'Cadastre produtos para ver o lucro'}
          </div>
        </div>

        {/* Card 2: Valor Estimado de Vendas */}
        <div className="card-base p-5 sm:p-6 bg-white border-pink-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Vendas Estimadas</span>
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-brand-700 break-words">{formatCurrency(totalEstimatedSales)}</div>
          <div className="mt-2 text-xs text-slate-500">
            Soma dos preços de venda cadastrados
          </div>
        </div>

        {/* Card 3: Custos Totais Cadastrados */}
        <div className="card-base p-6 bg-white border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Custos Totais</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-800">{formatCurrency(totalCosts)}</div>
          <div className="mt-2 text-xs text-slate-500">
            Materiais, tinta, mão de obra e perdas
          </div>
        </div>

        {/* Card 4: Serviços e Histórico */}
        <div className="card-base p-6 bg-white border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Catálogo / Cálculos</span>
            <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-800">{totalProducts}</span>
            <span className="text-xs text-slate-500 font-medium">produtos no catálogo</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5 text-primary-500" />
            <span>{totalCalculations} orçamentos salvos</span>
          </div>
        </div>
      </div>

      {/* Seção Dupla: Produtos e Histórico Recente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card: Produtos Cadastrados */}
        <div className="card-base p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Produtos no Catálogo</h3>
                <p className="text-xs text-slate-500">Seus produtos com custos e preços calculados</p>
              </div>
            </div>
            {totalProducts > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('catalog')}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 p-1"
              >
                <span>Ver todos</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {recentProducts.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <PackageOpen className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-slate-500 text-xs max-w-xs mx-auto">
                Nenhum produto cadastrado ainda. Use a calculadora para precificar seu primeiro personalizado e salvá-lo no catálogo.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('calculator')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-xl text-xs font-semibold transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Cadastrar Primeiro Produto</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/30 transition-all cursor-pointer group"
                  onClick={() => onEditProduct(p)}
                >
                  <div className="space-y-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {getCategoryLabel(p.category)}
                      </span>
                      <h4 className="font-semibold text-slate-800 text-sm truncate group-hover:text-brand-600 transition-colors">
                        {p.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>Custo: {formatCurrency(p.calculationResult?.totalServiceCost)}</span>
                      <span>•</span>
                      <span className="text-emerald-600 font-medium">
                        Lucro: {formatCurrency(p.calculationResult?.estimatedProfit)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-xs text-slate-400 block">Preço de Venda</span>
                    <span className="font-bold text-brand-600 text-sm sm:text-base">
                      {formatCurrency(p.calculationResult?.finalSalePrice)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card: Últimos Cálculos Realizados */}
        <div className="card-base p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Últimos Orçamentos</h3>
                <p className="text-xs text-slate-500">Histórico de simulações e cálculos salvos</p>
              </div>
            </div>
            {totalCalculations > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('history')}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 p-1"
              >
                <span>Ver histórico</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {recentCalculations.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Calculator className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-slate-500 text-xs max-w-xs mx-auto">
                Nenhum orçamento arquivado. Quando você clicar em "Salvar no Histórico" na Calculadora, seus cálculos aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCalculations.map((calc) => (
                <div
                  key={calc.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all"
                >
                  <div className="space-y-1 min-w-0 pr-3">
                    <h4 className="font-semibold text-slate-800 text-sm truncate">
                      {calc.productName}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(calc.date).toLocaleDateString('pt-BR')}</span>
                      <span>•</span>
                      <span>{calc.sheetCount} {calc.sheetCount === 1 ? 'unidade/folha' : 'unidades/folhas'}</span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-xs text-slate-400 block">Valor Calculado</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {formatCurrency(calc.calculationResult.finalSalePrice)}
                    </span>
                    <span className="block text-[11px] text-emerald-600 font-medium">
                      +{formatCurrency(calc.calculationResult.estimatedProfit)} lucro
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
