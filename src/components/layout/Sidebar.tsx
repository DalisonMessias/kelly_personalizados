import React from 'react';
import { 
  LayoutDashboard, 
  Calculator, 
  FolderKanban, 
  History, 
  Settings, 
  DownloadCloud, 
  HeartHandshake,
  Sparkles
} from 'lucide-react';
import { storageService } from '../../services/storage';
import { useToast } from '../ui/Toast';

export type NavTab = 'dashboard' | 'calculator' | 'catalog' | 'history' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  shopName: string;
}

export function Sidebar({ currentTab, onSelectTab, shopName }: SidebarProps) {
  const { success } = useToast();

  const handleQuickBackup = () => {
    storageService.downloadBackupFile();
    success('Backup realizado!', 'Seus dados foram salvos com segurança no seu computador.');
  };

  const menuItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Painel Geral', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'calculator', label: 'Calculadora de Custos', icon: <Calculator className="w-5 h-5" /> },
    { id: 'catalog', label: 'Catálogo de Serviços', icon: <FolderKanban className="w-5 h-5" /> },
    { id: 'history', label: 'Histórico de Cálculos', icon: <History className="w-5 h-5" /> },
    { id: 'settings', label: 'Configurações e Parâmetros', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-slate-100 h-screen sticky top-0 shadow-sm z-30 select-none">
      {/* Topo / Logotipo Oficial Kelly Personalizados */}
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 via-pink-500 to-rose-400 flex items-center justify-center text-white shadow-lg shadow-brand-500/25 flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex flex-col min-w-0">
          <h1 className="text-base font-black text-slate-900 tracking-tight leading-tight truncate">
            Kelly Personalizados
          </h1>
          <span className="text-xs text-brand-600 font-semibold truncate">
            {shopName || 'Ateliê Criativo'}
          </span>
        </div>
      </div>

      {/* Navegação Principal */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Menu Principal
        </div>
        {menuItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-brand-50 text-brand-700 font-semibold shadow-sm shadow-brand-100/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className={isActive ? 'text-brand-600' : 'text-slate-400'}>
                {item.icon}
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {isActive && (
                <div className="w-1.5 h-4 bg-brand-500 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Botão de Destaque Obrigatório: "Fazer backup" */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/70">
        <button
          type="button"
          onClick={handleQuickBackup}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-brand-600 to-pink-500 hover:from-brand-700 hover:to-pink-600 text-white font-semibold text-sm rounded-xl shadow-md shadow-brand-500/20 active:scale-95 transition-all"
        >
          <DownloadCloud className="w-4 h-4" />
          <span>Fazer backup</span>
        </button>

        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 justify-center">
          <HeartHandshake className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
          <span>Armazenamento local seguro</span>
        </div>
      </div>
    </aside>
  );
}
