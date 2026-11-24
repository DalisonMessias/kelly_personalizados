import React, { useState, useRef } from 'react';
import { 
  Settings, 
  DownloadCloud, 
  UploadCloud, 
  RefreshCw, 
  Save, 
  ShieldCheck, 
  Store,
  DollarSign,
  Percent,
  Clock,
  Printer,
  Info
} from 'lucide-react';
import { AppSettings } from '../../types';
import { storageService, DEFAULT_SETTINGS } from '../../services/storage';
import { CustomModal } from '../ui/CustomModal';
import { useToast } from '../ui/Toast';
import { CurrencyInput } from '../ui/CurrencyInput';
import { PercentInput } from '../ui/PercentInput';

interface SettingsPageProps {
  onRefreshAllData: () => void;
}

export function SettingsPage({ onRefreshAllData }: SettingsPageProps) {
  const { success, error, warning } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<AppSettings>(storageService.getSettings());

  // Modais de confirmação
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [pendingBackupContent, setPendingBackupContent] = useState<string | null>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    storageService.saveSettings(settings);
    success('Configurações salvas!', 'Os parâmetros padrão foram atualizados para seus próximos cálculos.');
    onRefreshAllData();
  };

  const handleExportBackup = () => {
    storageService.downloadBackupFile();
    success(
      'Backup gerado com sucesso!',
      'O arquivo JSON contendo seus produtos reais, fichas técnicas e histórico foi salvo com segurança.'
    );
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setPendingBackupContent(content);
        setIsRestoreConfirmOpen(true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmRestoreBackup = () => {
    if (!pendingBackupContent) return;

    const result = storageService.restoreBackup(pendingBackupContent);
    if (result.success) {
      success('Backup Restaurado!', result.message);
      setSettings(storageService.getSettings());
      onRefreshAllData();
    } else {
      error('Falha na Restauração', result.message);
    }
    setPendingBackupContent(null);
  };

  const confirmResetData = () => {
    storageService.resetAllData();
    setSettings(DEFAULT_SETTINGS);
    onRefreshAllData();
    warning(
      'Configurações Restauradas!',
      'Os parâmetros padrão do ateliê Kelly Personalizados foram restaurados com sucesso.'
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-5xl">
      {/* Topo */}
      <div className="border-b border-slate-200/80 pb-6">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Configurações & Central de Backup
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Ajuste as preferências reais do seu ateliê e garanta a segurança dos seus dados fazendo backups regulares.
        </p>
      </div>

      {/* Seção 1: Central de Backup e Segurança (Destaque Principal) */}
      <div className="card-base p-6 sm:p-8 bg-gradient-to-br from-white to-slate-50/70 border-2 border-brand-100 shadow-lg shadow-brand-500/5 space-y-6">
        <div className="flex items-start gap-4">
          <div className="p-3.5 rounded-2xl bg-brand-50 text-brand-600 flex-shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-slate-900">
              Segurança & Central de Backup de Dados
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
              Este aplicativo salva todas as suas informações com total privacidade no <strong>armazenamento local (LocalStorage)</strong> do seu próprio navegador. Não há risco de vazamento na internet. Para não perder seus preços ou poder usar no celular e computador, gere arquivos de backup periodicamente!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Card Exportar Backup */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-brand-300 transition-all space-y-3">
            <div className="flex items-center gap-2.5 text-brand-700 font-bold text-sm">
              <DownloadCloud className="w-5 h-5 text-brand-600" />
              <span>Exportar Arquivo de Backup</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Baixa um arquivo <strong>.JSON</strong> seguro com todos os seus produtos reais, histórico de cálculos e parâmetros do ateliê.
            </p>
            <button
              type="button"
              onClick={handleExportBackup}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md shadow-brand-500/20 active:scale-95 transition-all"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>Fazer backup agora</span>
            </button>
          </div>

          {/* Card Importar / Restaurar Backup */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all space-y-3">
            <div className="flex items-center gap-2.5 text-slate-800 font-bold text-sm">
              <UploadCloud className="w-5 h-5 text-slate-600" />
              <span>Importar / Restaurar Backup</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Carregue um arquivo <strong>.JSON</strong> que você exportou para restaurar suas fichas técnicas ou sincronizar em outro dispositivo.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelected}
              accept=".json,application/json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl shadow-sm active:scale-95 transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Selecionar arquivo de backup</span>
            </button>
          </div>
        </div>
      </div>

      {/* Seção 2: Parâmetros Padrão do Ateliê com Dados Reais de Mercado */}
      <form onSubmit={handleSaveSettings} className="card-base p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <Store className="w-5 h-5 text-brand-600" />
              <span>Parâmetros Técnicos do Ateliê</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Valores reais praticados no mercado para pré-preenchimento automático da calculadora.
            </p>
          </div>

          <button
            type="submit"
            className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md shadow-brand-500/20 active:scale-95 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Parâmetros</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Nome do Ateliê
            </label>
            <input
              type="text"
              value={settings.shopName}
              onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
              className="input-base"
              placeholder="Ex: Ateliê Personalizados com Amor"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Nome da Artesã / Proprietária
            </label>
            <input
              type="text"
              value={settings.ownerName}
              onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
              className="input-base"
              placeholder="Ex: Kelly Cristina"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Valor da Hora de Trabalho (R$/hora)
            </label>
            <CurrencyInput
              value={settings.defaultHourlyRate}
              onChange={(value) => setSettings({ ...settings, defaultHourlyRate: value })}
              className="input-base font-semibold"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Base recomendada: R$ 22,00/h (equivale a pró-labore de R$ 3.520/mês para 160h).
            </span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Custo de Tinta por Folha Impressa (R$)
            </label>
            <CurrencyInput
              value={settings.defaultInkCostPerSheet}
              onChange={(value) => setSettings({ ...settings, defaultInkCostPerSheet: value })}
              className="input-base font-semibold"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Base técnica real: R$ 0,15/folha (garrafas originais Epson EcoTank 544).
            </span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Margem de Lucro Padrão (% sobre a venda)
            </label>
            <PercentInput
              value={settings.defaultMarginPercentage}
              onChange={(value) => setSettings({ ...settings, defaultMarginPercentage: value || 0 })}
              max={90}
              className="input-base pr-10 font-semibold"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Recomendação SEBRAE para papelaria personalizada: 40% a 50%.
            </span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Margem de Perdas / Desperdício Padrão (%)
            </label>
            <PercentInput
              value={settings.defaultWastePercentage}
              onChange={(value) => setSettings({ ...settings, defaultWastePercentage: value || 0 })}
              max={40}
              className="input-base pr-10 font-semibold"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Média do setor: 8% para cobrir folhas de teste ou erros de corte.
            </span>
          </div>
        </div>
      </form>

      {/* Seção 3: Zona de Restauração de Padrões */}
      <div className="card-base p-6 border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>Restaurar Parâmetros Padrão do Ateliê</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Restaura os valores padrões recomendados de hora de trabalho, tinta, arte e perdas do ateliê Kelly Personalizados.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsResetModalOpen(true)}
          className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-white text-xs font-semibold transition-colors self-start sm:self-auto"
        >
          Restaurar Parâmetros Padrão
        </button>
      </div>

      {/* Modal de Confirmação para Importar Backup */}
      <CustomModal
        isOpen={isRestoreConfirmOpen}
        onClose={() => {
          setIsRestoreConfirmOpen(false);
          setPendingBackupContent(null);
        }}
        title="Restaurar Backup do Arquivo?"
        description="Atenção: Ao restaurar este backup, os produtos e cálculos contidos no arquivo JSON substituirão os dados atuais do navegador. Deseja prosseguir?"
        confirmText="Sim, Restaurar Backup"
        cancelText="Cancelar"
        variant="warning"
        onConfirm={confirmRestoreBackup}
      />

      {/* Modal de Confirmação para Resetar aos Padrões */}
      <CustomModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="Restaurar Parâmetros Padrão?"
        description="Esta ação irá redefinir as preferências e parâmetros para os valores originais recomendados do ateliê Kelly Personalizados. Deseja continuar?"
        confirmText="Sim, Restaurar"
        cancelText="Cancelar"
        variant="warning"
        onConfirm={confirmResetData}
      />
    </div>
  );
}
