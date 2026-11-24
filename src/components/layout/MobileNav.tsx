import React, { useState } from 'react';
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  Calculator, 
  FolderKanban, 
  History, 
  Settings, 
  DownloadCloud,
  Sparkles,
  BrainCircuit,
  Users,
  ShoppingBag,
  WandSparkles
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { storageService } from '../../services/storage';
import { useToast } from '../ui/Toast';

interface MobileNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  shopName: string;
}

export function MobileNav({ currentTab, onSelectTab, shopName }: MobileNavProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { success } = useToast();

  const handleQuickBackup = () => {
    storageService.downloadBackupFile();
    success('Backup realizado!', 'Seus dados foram baixados no formato JSON.');
  };

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Início', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'calculator', label: 'Calcular', icon: <Calculator className="w-5 h-5" /> },
    { id: 'catalog', label: 'Catálogo', icon: <FolderKanban className="w-5 h-5" /> },
    { id: 'history', label: 'Histórico', icon: <History className="w-5 h-5" /> },
  ];

  return (
    <>
      {/* Header Fixo Mobile com Identidade Kelly Personalizados */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-pink-100 px-3 py-2.5 flex items-center justify-between safe-area-pb">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none">
              Kelly Personalizados
            </h1>
            <span className="text-[11px] text-brand-600 font-medium truncate block max-w-[140px]">
              {shopName || 'Ateliê Criativo'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleQuickBackup}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 hover:bg-brand-100 text-xs font-semibold rounded-lg transition-colors"
            title="Fazer backup"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>Backup</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Drawer lateral Mobile */}
      {isDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-black text-slate-900 text-sm block">Kelly Personalizados</span>
                  <span className="text-[10px] text-brand-600 font-semibold">{shopName || 'Ateliê Criativo'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
              {[
                { id: 'dashboard' as NavTab, label: 'Painel Geral', icon: <LayoutDashboard className="w-5 h-5" /> },
                { id: 'calculator' as NavTab, label: 'Calculadora de Custos', icon: <Calculator className="w-5 h-5" /> },
                { id: 'catalog' as NavTab, label: 'Catálogo de Serviços', icon: <FolderKanban className="w-5 h-5" /> },
                { id: 'store-products' as NavTab, label: 'Catálogo de Produtos', icon: <ShoppingBag className="w-5 h-5" /> },
                { id: 'history' as NavTab, label: 'Histórico de Cálculos', icon: <History className="w-5 h-5" /> },
                { id: 'assistant' as NavTab, label: 'Assistente IA', icon: <BrainCircuit className="w-5 h-5" /> },
                { id: 'art-prompt' as NavTab, label: 'Assistente de Artes', icon: <WandSparkles className="w-5 h-5" /> },
                { id: 'clients' as NavTab, label: 'Clientes', icon: <Users className="w-5 h-5" /> },
                { id: 'settings' as NavTab, label: 'Configurações e Parâmetros', icon: <Settings className="w-5 h-5" /> },
              ].map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setIsDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={isActive ? 'text-brand-600' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  handleQuickBackup();
                  setIsDrawerOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 text-white font-semibold text-xs rounded-xl shadow-md"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>Fazer backup agora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Navegação Inferior para Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-pink-100 px-1 pb-[env(safe-area-inset-bottom)] pt-1.5 flex items-center justify-around shadow-[0_-4px_18px_rgba(15,23,42,0.08)]">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive ? 'text-brand-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {item.icon}
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
