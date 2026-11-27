import { supabase } from '../../services/supabase';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { 
  Settings, 
  DownloadCloud, 
  Download,
  UploadCloud, 
  RefreshCw, 
  Save, 
  ShieldCheck, 
  Store,
  DollarSign,
  Percent,
  Clock,
  Printer,
  Info,
  Trash2,
  Sparkles,
  KeyRound,
  CheckCircle2,
  LoaderCircle,
  Cpu
} from 'lucide-react';
import { AppSettings, AiProductModel } from '../../types';
import { storageService, DEFAULT_SETTINGS } from '../../services/storage';
import {
  applyCloudDataValueLocally,
  CloudDataSnapshot,
  flushPendingCloudData,
  getLatestCloudDataSnapshot,
  hasPendingCloudData,
  saveCacheValueAndWait,
  subscribeToCloudDataSnapshots,
  useDataSyncStatus,
} from '../../services/appDataSync';
import { CustomModal } from '../ui/CustomModal';
import { CustomSelect } from '../ui/CustomSelect';
import { useToast } from '../ui/Toast';
import { CurrencyInput } from '../ui/CurrencyInput';
import { PercentInput } from '../ui/PercentInput';
import {
  AiProductProvider,
  getAiProductBuilderStatus,
  saveAiProductBuilderGroqKey,
  saveAiProductBuilderKey,
  saveAiProductBuilderPreferences,
} from '../../services/aiProductBuilderService';
import {
  archiveSystemBackup,
  createSystemBackup,
  downloadSystemBackup,
  getSystemBackup,
  listSystemBackups,
  restoreSystemBackup,
  SystemBackup,
  SystemBackupHistoryItem,
  validateSystemBackup,
} from '../../services/systemBackupService';

interface SettingsPageProps {
  onRefreshAllData: () => void;
  onUnsavedChangesChange: (hasChanges: boolean) => void;
}

const SETTINGS_DATA_KEY = 'kelly_calc_settings_v4';

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...(value as Partial<AppSettings>) };
}

function compareSnapshots(left: CloudDataSnapshot, right: CloudDataSnapshot): number {
  const dateDifference = Date.parse(left.created_at) - Date.parse(right.created_at);
  return dateDifference || left.id.localeCompare(right.id);
}

const GEMINI_MODEL_OPTIONS: Array<{ value: AiProductModel; label: string; hint: string }> = [
  { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', hint: 'Mais detalhado' },
  { value: 'gemini-3.0-flash', label: 'Gemini 3.0 Flash', hint: 'Mais rápido' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', hint: 'Raciocínio avançado' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: 'Ágil' },
];

const GROQ_MODEL_OPTIONS = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', hint: 'Alta capacidade e precisão' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', hint: 'Ultra rápido e ágil' },
  { value: 'openai/gpt-oss-120b', label: 'GPT OSS 120B', hint: 'Excelente raciocínio e síntese' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (MoE)', hint: 'Contexto amplo de 32k' },
];

const PRIMARY_PROVIDER_OPTIONS = [
  { value: 'gemini', label: 'Google Gemini (Recomendado)', hint: 'Tentado primeiro em todas as gerações' },
  { value: 'groq', label: 'Groq Cloud (Contingência/Principal)', hint: 'Tentado primeiro em todas as gerações' },
];

export function SettingsPage({ onRefreshAllData, onUnsavedChangesChange }: SettingsPageProps) {
  const { success, error, warning } = useToast();
  const dataSync = useDataSyncStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<AppSettings>(() => storageService.getSettings());
  const [savedSettings, setSavedSettings] = useState<AppSettings>(() => storageService.getSettings());
  const [saveState, setSaveState] = useState<'salvo' | 'alterado' | 'salvando' | 'falha'>('salvo');
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [realtimeState, setRealtimeState] = useState<'conectando' | 'conectado' | 'indisponivel'>('conectando');
  const [hasRemoteConflict, setHasRemoteConflict] = useState(false);
  const [settingsLoadError, setSettingsLoadError] = useState(false);
  const [backupHistory, setBackupHistory] = useState<SystemBackupHistoryItem[]>([]);
  const [backupHistoryLoading, setBackupHistoryLoading] = useState(true);
  const [backupBusy, setBackupBusy] = useState(false);
  const [pendingBackupArchiveId, setPendingBackupArchiveId] = useState<string | null>(null);

  // Estados da Configuração dos Provedores de IA
  const [aiIsChecking, setAiIsChecking] = useState(true);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [groqConfigured, setGroqConfigured] = useState(false);
  const [primaryProvider, setPrimaryProvider] = useState<AiProductProvider>('gemini');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState<AiProductModel>('gemini-3.1-pro');
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');
  const [fallbackAttempts, setFallbackAttempts] = useState(4);
  const [isSavingGeminiKey, setIsSavingGeminiKey] = useState(false);
  const [isSavingGroqKey, setIsSavingGroqKey] = useState(false);
  const [isSavingAiPrefs, setIsSavingAiPrefs] = useState(false);
  const [aiErrorMessage, setAiErrorMessage] = useState('');

  // Modais de confirmação
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [pendingBackupContent, setPendingBackupContent] = useState<string | null>(null);
  const [pendingSystemBackup, setPendingSystemBackup] = useState<SystemBackup | null>(null);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const initialHistoryLoadStarted = useRef(false);
  const settingsRef = useRef(settings);
  const savedSettingsRef = useRef(savedSettings);
  const latestRemoteSnapshotRef = useRef<CloudDataSnapshot | null>(null);
  const remoteConflictRef = useRef(false);
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const saveErrorToastShownRef = useRef(false);
  const onRefreshAllDataRef = useRef(onRefreshAllData);

  useEffect(() => {
    onRefreshAllDataRef.current = onRefreshAllData;
  }, [onRefreshAllData]);

  const loadAiStatus = useCallback(async () => {
    try {
      setAiIsChecking(true);
      const status = await getAiProductBuilderStatus();
      setGeminiConfigured(status.geminiConfigured);
      setGroqConfigured(status.groqConfigured);
      setPrimaryProvider(status.primaryProvider ?? 'gemini');
      setGeminiModel(status.modelName);
      setGroqModel(status.groqModelName);
      setFallbackAttempts(status.fallbackMaxAttempts);
      setAiErrorMessage('');
    } catch (err) {
      setAiErrorMessage(err instanceof Error ? err.message : 'Não foi possível carregar os provedores de IA.');
    } finally {
      setAiIsChecking(false);
    }
  }, []);

  useEffect(() => {
    void loadAiStatus();
  }, [loadAiStatus]);

  const handleSaveGeminiKey = async () => {
    if (!geminiApiKey.trim()) {
      warning('Informe a chave Gemini', 'A chave será salva no banco protegido api_keys.');
      return;
    }
    setIsSavingGeminiKey(true);
    setAiErrorMessage('');
    try {
      const status = await saveAiProductBuilderKey(geminiApiKey, geminiModel, fallbackAttempts, primaryProvider);
      setGeminiConfigured(status.geminiConfigured);
      setGroqConfigured(status.groqConfigured);
      setPrimaryProvider(status.primaryProvider ?? primaryProvider);
      setGeminiModel(status.modelName);
      setGroqModel(status.groqModelName);
      setFallbackAttempts(status.fallbackMaxAttempts);
      setGeminiApiKey('');
      success('Configuração Gemini salva', 'A chave do Gemini foi salva com segurança em api_keys.');
    } catch (saveErr) {
      const msg = saveErr instanceof Error ? saveErr.message : 'Falha ao salvar a chave Gemini.';
      setAiErrorMessage(msg);
      error('Não foi possível salvar', msg);
    } finally {
      setIsSavingGeminiKey(false);
    }
  };

  const handleSaveGroqKey = async () => {
    if (!groqApiKey.trim()) {
      warning('Informe a chave Groq', 'A chave será salva no banco protegido api_keys.');
      return;
    }
    setIsSavingGroqKey(true);
    setAiErrorMessage('');
    try {
      const status = await saveAiProductBuilderGroqKey(groqApiKey, groqModel, fallbackAttempts, primaryProvider);
      setGeminiConfigured(status.geminiConfigured);
      setGroqConfigured(status.groqConfigured);
      setPrimaryProvider(status.primaryProvider ?? primaryProvider);
      setGeminiModel(status.modelName);
      setGroqModel(status.groqModelName);
      setFallbackAttempts(status.fallbackMaxAttempts);
      setGroqApiKey('');
      success('Configuração Groq salva', 'A chave do Groq foi salva com segurança em api_keys.');
    } catch (saveErr) {
      const msg = saveErr instanceof Error ? saveErr.message : 'Falha ao salvar a chave Groq.';
      setAiErrorMessage(msg);
      error('Não foi possível salvar', msg);
    } finally {
      setIsSavingGroqKey(false);
    }
  };

  const handleSaveAiPreferences = async () => {
    setIsSavingAiPrefs(true);
    setAiErrorMessage('');
    try {
      const status = await saveAiProductBuilderPreferences(fallbackAttempts, primaryProvider, geminiModel, groqModel);
      setGeminiConfigured(status.geminiConfigured);
      setGroqConfigured(status.groqConfigured);
      setPrimaryProvider(status.primaryProvider ?? primaryProvider);
      setGeminiModel(status.modelName);
      setGroqModel(status.groqModelName);
      setFallbackAttempts(status.fallbackMaxAttempts);
      success('Preferências de IA salvas', `Provedor principal definido como ${primaryProvider === 'gemini' ? 'Gemini' : 'Groq'} com até ${fallbackAttempts} tentativas.`);
    } catch (saveErr) {
      const msg = saveErr instanceof Error ? saveErr.message : 'Falha ao salvar as preferências de IA.';
      setAiErrorMessage(msg);
      error('Não foi possível salvar preferências', msg);
    } finally {
      setIsSavingAiPrefs(false);
    }
  };

  const hasLocalSettingsChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const hasPendingSettings = hasPendingCloudData(SETTINGS_DATA_KEY);
  const hasUnsavedSettings = hasLocalSettingsChanges || hasPendingSettings;
  const syncUnavailable = !isOnline || dataSync.state === 'offline';
  const settingsStatusMessage = syncUnavailable
    ? 'Sem conexão. As alterações ficam protegidas neste dispositivo e serão sincronizadas quando a conexão voltar.'
    : settingsLoadError
      ? 'Erro ao carregar os parâmetros do Supabase. Os dados locais foram preservados e uma nova tentativa será feita ao reconectar.'
      : saveState === 'falha'
        ? 'Erro ao salvar. As alterações permanecem protegidas neste dispositivo; tente salvar novamente.'
        : saveState === 'salvando'
          ? 'Salvando as alterações no Supabase...'
          : hasRemoteConflict
            ? 'Outra sessão alterou os parâmetros. Suas alterações locais foram mantidas e estão sendo sincronizadas.'
            : hasUnsavedSettings
              ? 'Alterações pendentes; salvamento automático em andamento.'
              : dataSync.state === 'sincronizando'
                ? 'Sincronizando as alterações com o Supabase...'
                : dataSync.state === 'local'
                  ? 'Dados locais disponíveis; aguardando uma sessão conectada ao Supabase.'
                  : realtimeState === 'indisponivel'
                    ? 'Salvo automaticamente no Supabase; a atualização em tempo real será retomada ao reconectar.'
                    : realtimeState === 'conectado'
                      ? 'Salvo automaticamente e sincronizado com o Supabase.'
                      : 'Salvo no Supabase; conectando a sincronização em tempo real.';
  const settingsStatusTone = syncUnavailable || settingsLoadError || saveState === 'falha'
    ? 'text-rose-600'
    : saveState === 'salvando' || hasUnsavedSettings || hasRemoteConflict || dataSync.state === 'sincronizando'
      ? 'text-amber-700'
      : 'text-emerald-700';

  const applyRemoteSnapshot = useCallback((snapshot: CloudDataSnapshot) => {
    const previousSnapshot = latestRemoteSnapshotRef.current;
    if (previousSnapshot && compareSnapshots(snapshot, previousSnapshot) <= 0) return;
    latestRemoteSnapshotRef.current = snapshot;

    const remoteSettings = normalizeSettings(snapshot.data_value);
    const localSettings = settingsRef.current;
    const localHasPendingChanges =
      JSON.stringify(localSettings) !== JSON.stringify(savedSettingsRef.current) ||
      hasPendingCloudData(SETTINGS_DATA_KEY);

    if (localHasPendingChanges && JSON.stringify(remoteSettings) !== JSON.stringify(localSettings)) {
      remoteConflictRef.current = true;
      setHasRemoteConflict(true);
      return;
    }

    applyCloudDataValueLocally(SETTINGS_DATA_KEY, remoteSettings);
    settingsRef.current = remoteSettings;
    savedSettingsRef.current = remoteSettings;
    setSettings(remoteSettings);
    setSavedSettings(remoteSettings);
    setSaveState('salvo');
    setHasRemoteConflict(false);
    remoteConflictRef.current = false;
    setSettingsLoadError(false);
    saveErrorToastShownRef.current = false;
    onRefreshAllDataRef.current();
  }, []);

  const persistSettings = useCallback((showConfirmation = false): Promise<boolean> => {
    const operation = saveQueueRef.current.catch(() => false).then(async () => {
      const initialSettings = { ...settingsRef.current };
      if (JSON.stringify(initialSettings) === JSON.stringify(savedSettingsRef.current) &&
          !hasPendingCloudData(SETTINGS_DATA_KEY) && !settingsLoadError) {
        setSaveState('salvo');
        if (showConfirmation) success('Configurações sincronizadas', 'Os parâmetros já estão confirmados no Supabase.');
        return true;
      }

      setSaveState('salvando');
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const settingsToPersist = { ...settingsRef.current };
          if (remoteConflictRef.current || settingsLoadError) {
            remoteConflictRef.current = false;
            setHasRemoteConflict(false);
            storageService.saveSettings(settingsToPersist);
          }
          await saveCacheValueAndWait(SETTINGS_DATA_KEY, JSON.stringify(settingsToPersist));
          if (!remoteConflictRef.current) break;
        }

        if (remoteConflictRef.current) {
          throw new Error('Outra sessão alterou os parâmetros ao mesmo tempo. Suas alterações foram mantidas para uma nova tentativa.');
        }

        const confirmedSettings = { ...settingsRef.current };
        savedSettingsRef.current = confirmedSettings;
        setSavedSettings(confirmedSettings);
        setSaveState('salvo');
        setHasRemoteConflict(false);
        setSettingsLoadError(false);
        saveErrorToastShownRef.current = false;
        onRefreshAllDataRef.current();
        if (showConfirmation) {
          success('Configurações salvas', 'Os parâmetros foram confirmados no Supabase e estão disponíveis nos outros dispositivos.');
        }
        return true;
      } catch (saveError) {
        setSaveState('falha');
        if (!saveErrorToastShownRef.current) {
          error(
            'Não foi possível confirmar o salvamento',
            saveError instanceof Error ? saveError.message : 'As alterações continuam protegidas neste dispositivo; tente novamente.',
          );
          saveErrorToastShownRef.current = true;
        }
        return false;
      }
    });

    saveQueueRef.current = operation.then((saved) => saved, () => false);
    return operation;
  }, [error, settingsLoadError, success]);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const nextSettings = { ...settingsRef.current, [key]: value };
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    setSaveState('alterado');
    storageService.saveSettings(nextSettings);
  };

  useEffect(() => {
    if (!hasUnsavedSettings) return;
    const timer = window.setTimeout(() => {
      void persistSettings(false);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [hasUnsavedSettings, isOnline, persistSettings, settings]);

  useEffect(() => {
    let active = true;
    setRealtimeState('conectando');

    const unsubscribe = subscribeToCloudDataSnapshots(
      SETTINGS_DATA_KEY,
      applyRemoteSnapshot,
      (status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          setRealtimeState('conectado');
          void getLatestCloudDataSnapshot(SETTINGS_DATA_KEY)
            .then((snapshot) => {
              if (active && snapshot) applyRemoteSnapshot(snapshot);
            })
            .catch(() => {
              if (active) setSettingsLoadError(true);
            });
        }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setRealtimeState('indisponivel');
        else setRealtimeState('conectando');
      },
    );

    void getLatestCloudDataSnapshot(SETTINGS_DATA_KEY)
      .then((snapshot) => {
        if (!active) return;
        if (snapshot) applyRemoteSnapshot(snapshot);
        setSettingsLoadError(false);
      })
      .catch(() => {
        if (active) setSettingsLoadError(true);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [applyRemoteSnapshot]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void getLatestCloudDataSnapshot(SETTINGS_DATA_KEY)
        .then((snapshot) => {
          if (snapshot) applyRemoteSnapshot(snapshot);
          setSettingsLoadError(false);
        })
        .catch(() => setSettingsLoadError(true));
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [applyRemoteSnapshot]);

  useEffect(() => {
    onUnsavedChangesChange(hasLocalSettingsChanges && !hasPendingSettings);
  }, [hasLocalSettingsChanges, hasPendingSettings, onUnsavedChangesChange]);

  useEffect(() => () => onUnsavedChangesChange(false), [onUnsavedChangesChange]);

  const refreshBackupHistory = async () => {
    setBackupHistoryLoading(true);
    try {
      setBackupHistory(await listSystemBackups());
    } catch (historyError) {
      error('Não foi possível carregar o histórico de backups', historyError instanceof Error ? historyError.message : 'Tente novamente em instantes.');
    } finally {
      setBackupHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (initialHistoryLoadStarted.current) return;
    initialHistoryLoadStarted.current = true;
    void refreshBackupHistory();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistSettings(true);
  };

  const handleExportBackup = async () => {
    setBackupBusy(true);
    try {
      if (hasUnsavedSettings) {
        const settingsSaved = await persistSettings(false);
        if (!settingsSaved) throw new Error('Salve as alterações pendentes antes de criar o backup.');
      }
      const backup = await createSystemBackup();
      downloadSystemBackup(backup);
      success('Backup gerado e registrado', 'A cópia segura foi salva no histórico e baixada neste dispositivo.');
      await refreshBackupHistory();
    } catch (backupError) {
      error('Não foi possível criar o backup', backupError instanceof Error ? backupError.message : 'Tente novamente quando o Supabase estiver disponível.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      void (async () => {
        try {
          const parsed = JSON.parse(content) as unknown;
          if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version === '2.0.0') {
            setPendingSystemBackup(await validateSystemBackup(parsed));
            setPendingBackupContent(null);
          } else if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version === '1.0.0' &&
            'products' in parsed && Array.isArray(parsed.products) &&
            (!('calculations' in parsed) || Array.isArray(parsed.calculations)) &&
            (!('settings' in parsed) || (parsed.settings !== null && typeof parsed.settings === 'object' && !Array.isArray(parsed.settings)))) {
            setPendingBackupContent(content);
            setPendingSystemBackup(null);
          } else {
            throw new Error('A estrutura do arquivo não corresponde a um backup válido.');
          }
          setIsRestoreConfirmOpen(true);
        } catch (validationError) {
          error('Arquivo de backup não aprovado', validationError instanceof Error ? validationError.message : 'Confira o arquivo e tente novamente.');
        }
      })();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmRestoreBackup = async () => {
    setBackupBusy(true);
    try {
      if (pendingSystemBackup) {
        const message = await restoreSystemBackup(pendingSystemBackup);
        success('Backup restaurado', message);
        await refreshBackupHistory();
      } else if (pendingBackupContent) {
        await flushPendingCloudData();
        const result = storageService.restoreBackup(pendingBackupContent);
        if (!result.success) throw new Error(result.message);
        await flushPendingCloudData();
        success('Backup antigo restaurado', result.message);
      } else {
        return;
      }
      const restoredSettings = storageService.getSettings();
      settingsRef.current = restoredSettings;
      savedSettingsRef.current = restoredSettings;
      setSettings(restoredSettings);
      setSavedSettings(restoredSettings);
      setSaveState('salvo');
      setHasRemoteConflict(false);
      remoteConflictRef.current = false;
      setSettingsLoadError(false);
      onRefreshAllData();
    } catch (restoreError) {
      error('Falha na restauração', restoreError instanceof Error ? restoreError.message : 'Confira a cópia e tente novamente.');
    } finally {
      setPendingBackupContent(null);
      setPendingSystemBackup(null);
      setBackupBusy(false);
    }
  };

  const prepareHistoryRestore = async (backupId: string) => {
    setBackupBusy(true);
    try {
      setPendingSystemBackup(await getSystemBackup(backupId));
      setPendingBackupContent(null);
      setIsRestoreConfirmOpen(true);
    } catch (historyError) {
      error('Não foi possível abrir esse backup', historyError instanceof Error ? historyError.message : 'Tente novamente em instantes.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleDownloadHistoryBackup = async (backupId: string) => {
    setBackupBusy(true);
    try {
      const backup = await getSystemBackup(backupId);
      downloadSystemBackup(backup);
      success('Backup baixado', 'A cópia validada foi salva neste dispositivo.');
    } catch (downloadError) {
      error('Não foi possível baixar o backup', downloadError instanceof Error ? downloadError.message : 'Tente novamente em instantes.');
    } finally {
      setBackupBusy(false);
    }
  };

  const archiveSelectedBackup = async () => {
    if (!pendingBackupArchiveId) return;
    setBackupBusy(true);
    try {
      const message = await archiveSystemBackup(pendingBackupArchiveId);
      setPendingBackupArchiveId(null);
      success('Backup retirado do histórico', message);
      await refreshBackupHistory();
    } catch (archiveError) {
      error('Não foi possível retirar o backup do histórico', archiveError instanceof Error ? archiveError.message : 'Tente novamente em instantes.');
    } finally {
      setBackupBusy(false);
    }
  };

  const discardUnsavedSettings = async () => {
    const settingsToRestore = { ...savedSettingsRef.current };
    await saveQueueRef.current.catch(() => false);
    settingsRef.current = settingsToRestore;
    setSettings(settingsToRestore);
    setSaveState('salvando');
    try {
      await saveCacheValueAndWait(SETTINGS_DATA_KEY, JSON.stringify(settingsToRestore));
      savedSettingsRef.current = settingsToRestore;
      setSavedSettings(settingsToRestore);
      setSaveState('salvo');
      setHasRemoteConflict(false);
      remoteConflictRef.current = false;
      setIsDiscardModalOpen(false);
      onRefreshAllDataRef.current();
    } catch (discardError) {
      setSaveState('falha');
      error('Não foi possível confirmar o descarte', discardError instanceof Error ? discardError.message : 'As alterações foram mantidas para uma nova tentativa.');
    }
  };

  const confirmResetData = async () => {
    const defaultSettings = { ...DEFAULT_SETTINGS };
    settingsRef.current = defaultSettings;
    setSettings(defaultSettings);
    setSaveState('salvando');
    const resetSaved = await persistSettings(false);
    if (!resetSaved) return;
    setHasRemoteConflict(false);
    remoteConflictRef.current = false;
    warning('Parâmetros restaurados', 'Os valores padrão foram salvos. Produtos, pedidos e históricos foram preservados.');
  };

  const handleLogout = async () => {
    if (hasUnsavedSettings) {
      const settingsSaved = await persistSettings(false);
      if (!settingsSaved) return;
    }
    try {
      const { error: logoutError } = await supabase.auth.signOut();
      if (logoutError) throw logoutError;
      success('Sessão encerrada', 'Você saiu da sua conta.');
    } catch {
      error('Não foi possível sair', 'Tente novamente em instantes.');
    }
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
              Os dados dos administradores são sincronizados no Supabase e usam o cache local para acesso rápido e retomada das alterações quando a conexão voltar.
            </p>
            <p role="status" className="text-xs text-slate-600 leading-relaxed max-w-2xl pt-2">
              <strong>Estado da sincronização:</strong> {dataSync.message}
              {dataSync.lastSyncedAt && (
                <span> Última sincronização: {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(dataSync.lastSyncedAt))}.</span>
              )}
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
              Gera uma cópia no Supabase e baixa um arquivo <strong>.JSON</strong> com dados do ateliê, pedidos e lista segura de usuários.
            </p>
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={backupBusy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md shadow-brand-500/20 active:scale-95 transition-all disabled:cursor-wait disabled:opacity-60"
            >
              <DownloadCloud className={`w-4 h-4 ${backupBusy ? 'animate-pulse' : ''}`} />
              <span>{backupBusy ? 'Preparando backup...' : 'Fazer backup agora'}</span>
            </button>
          </div>

          {/* Card Importar / Restaurar Backup */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all space-y-3">
            <div className="flex items-center gap-2.5 text-slate-800 font-bold text-sm">
              <UploadCloud className="w-5 h-5 text-slate-600" />
              <span>Importar / Restaurar Backup</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Importe uma cópia validada. Os pedidos existentes são preservados e duplicados não substituem registros atuais.
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h4 className="text-sm font-extrabold text-slate-900">Histórico de backups</h4><p className="mt-0.5 text-xs text-slate-500">Cópias verificadas e armazenadas no Supabase.</p></div>
            <button type="button" onClick={() => void refreshBackupHistory()} disabled={backupHistoryLoading || backupBusy} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${backupHistoryLoading ? 'animate-spin' : ''}`} /> Atualizar histórico</button>
          </div>
          {backupHistoryLoading ? <p className="py-5 text-center text-xs text-slate-500">Carregando histórico...</p>
            : backupHistory.length === 0 ? <p className="py-5 text-center text-xs text-slate-500">Ainda não há cópias salvas no histórico.</p>
              : <div className="divide-y divide-slate-100">{backupHistory.map((backup) => <div key={backup.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><span><strong className="block text-xs text-slate-800">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(backup.createdAt))}</strong><small className="text-[10px] text-slate-400">Integridade SHA-256: {backup.checksum.slice(0, 16)}…</small></span><div className="flex flex-wrap items-center gap-2 self-start sm:self-auto"><button type="button" disabled={backupBusy} onClick={() => void prepareHistoryRestore(backup.id)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-brand-200 px-3 text-xs font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"><UploadCloud className="h-3.5 w-3.5" /> Restaurar cópia</button><button type="button" disabled={backupBusy} onClick={() => void handleDownloadHistoryBackup(backup.id)} title="Baixar cópia" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"><Download className="h-3.5 w-3.5" /> Baixar</button><button type="button" disabled={backupBusy} onClick={() => setPendingBackupArchiveId(backup.id)} title="Retirar cópia do histórico" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Excluir</button></div></div>)}</div>}
        </div>
      </div>

      {/* Seção: Configurações dos Provedores de IA */}
      <div className="card-base p-6 sm:p-8 space-y-6 border border-pink-100 bg-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-pink-50 text-brand-600 flex-shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Configurações dos Provedores de IA</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Gerencie as chaves protegidas, seleção de modelos e alternância de contingência para a criação com IA. As chaves são gravadas em <code>api_keys</code> e nunca retornam ao navegador.
              </p>
            </div>
          </div>
          {aiIsChecking ? (
            <span className="inline-flex items-center gap-2 text-xs text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando status da IA...
            </span>
          ) : (
            <div className="flex flex-wrap gap-2 text-[10px] font-bold">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${geminiConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Gemini {geminiConfigured ? 'configurado' : 'sem chave'}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${groqConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Groq {groqConfigured ? 'configurado' : 'sem chave'}
              </span>
            </div>
          )}
        </div>

        {/* Provedor Principal e Limite de Tentativas */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Cpu className="w-4 h-4 text-brand-600" />
            <span>Fluxo de Execução & Contingência</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-start">
            <CustomSelect
              label="Provedor Principal"
              value={primaryProvider}
              onChange={(val) => setPrimaryProvider(val as AiProductProvider)}
              options={PRIMARY_PROVIDER_OPTIONS}
            />
            <CustomSelect
              label="Limite de Tentativas Alternadas"
              value={String(fallbackAttempts)}
              onChange={(val) => setFallbackAttempts(Number(val))}
              options={[2, 3, 4, 5, 6].map((num) => ({ value: String(num), label: `${num} tentativas alternadas` }))}
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <p className="text-[11px] leading-5 text-slate-500">
              Se o provedor principal falhar ou atingir cota, o sistema alterna automaticamente para o outro provedor com espera randômica de 5 a 10s.
            </p>
            <button
              type="button"
              onClick={() => void handleSaveAiPreferences()}
              disabled={isSavingAiPrefs || (!geminiConfigured && !groqConfigured)}
              className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-5 text-xs font-bold transition shadow-sm disabled:opacity-50 shrink-0"
            >
              {isSavingAiPrefs ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>Salvar Preferências</span>
            </button>
          </div>
        </div>

        {/* Integração Google Gemini */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-brand-600" />
              <h4 className="text-sm font-bold text-slate-800">Google Gemini</h4>
            </div>
            <span className="text-[11px] text-slate-400">Modelos multimodais e raciocínio avançado</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] sm:items-start">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Chave de API Gemini</label>
              <input
                type="password"
                autoComplete="new-password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="input-base"
                placeholder={geminiConfigured ? 'Digite uma nova chave para substituir' : 'Cole a chave Gemini aqui'}
              />
              <span className="mt-1 block text-[10px] text-slate-400">Transmitida com criptografia e mantida segura em api_keys.</span>
            </div>
            <CustomSelect
              label="Modelo Gemini"
              value={geminiModel}
              onChange={(val) => setGeminiModel(val as AiProductModel)}
              options={GEMINI_MODEL_OPTIONS}
            />
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => void handleSaveGeminiKey()}
              disabled={isSavingGeminiKey || !geminiApiKey.trim()}
              className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              {isSavingGeminiKey ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>{geminiConfigured ? 'Atualizar Chave Gemini' : 'Salvar Chave Gemini'}</span>
            </button>
          </div>
        </div>

        {/* Integração Groq Cloud */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-purple-600" />
              <h4 className="text-sm font-bold text-slate-800">Groq Cloud (LPU de Ultra Baixa Latência)</h4>
            </div>
            <span className="text-[11px] text-slate-400">Contingência e velocidade instantânea</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] sm:items-start">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Chave de API Groq</label>
              <input
                type="password"
                autoComplete="new-password"
                value={groqApiKey}
                onChange={(e) => setGroqApiKey(e.target.value)}
                className="input-base"
                placeholder={groqConfigured ? 'Digite uma nova chave para substituir' : 'Cole a chave Groq aqui'}
              />
              <span className="mt-1 block text-[10px] text-slate-400">Armazenada na tabela api_keys para alternância transparente.</span>
            </div>
            <CustomSelect
              label="Modelo Groq"
              value={groqModel}
              onChange={(val) => setGroqModel(val)}
              options={GROQ_MODEL_OPTIONS}
            />
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => void handleSaveGroqKey()}
              disabled={isSavingGroqKey || !groqApiKey.trim()}
              className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              {isSavingGroqKey ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>{groqConfigured ? 'Atualizar Chave Groq' : 'Salvar Chave Groq'}</span>
            </button>
          </div>
        </div>

        {aiErrorMessage && (
          <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
            {aiErrorMessage}
          </p>
        )}
      </div>

      {/* Seção 2: Parâmetros Padrão do Ateliê com Dados Reais de Mercado */}
      <form onSubmit={handleSaveSettings} className="card-base p-6 sm:p-8 space-y-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <Store className="w-5 h-5 text-brand-600" />
              <span>Parâmetros Técnicos do Ateliê</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Valores reais praticados no mercado para pré-preenchimento automático da calculadora.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasUnsavedSettings && <button type="button" onClick={() => setIsDiscardModalOpen(true)} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">Descartar alterações</button>}
            <button type="submit" disabled={!hasUnsavedSettings} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-brand-500/20 transition-all hover:bg-brand-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
              <Save className={`h-4 w-4 ${saveState === 'salvando' ? 'animate-pulse' : ''}`} />
              <span>{saveState === 'salvando' ? 'Salvando...' : hasUnsavedSettings ? 'Salvar Parâmetros' : 'Parâmetros salvos'}</span>
            </button>
          </div>
        </div>

        <p role="status" aria-live="polite" className={`flex items-center gap-2 text-xs font-semibold ${settingsStatusTone}`}>
          <span aria-hidden="true" className={`h-2 w-2 flex-shrink-0 rounded-full ${syncUnavailable || settingsLoadError || saveState === 'falha' ? 'bg-rose-500' : saveState === 'salvando' || hasUnsavedSettings || hasRemoteConflict || dataSync.state === 'sincronizando' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span>{settingsStatusMessage}</span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Nome do Ateliê
            </label>
            <input
              type="text"
              value={settings.shopName}
              onChange={(e) => updateSetting('shopName', e.target.value)}
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
              onChange={(e) => updateSetting('ownerName', e.target.value)}
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
              onChange={(value) => updateSetting('defaultHourlyRate', value)}
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
              onChange={(value) => updateSetting('defaultInkCostPerSheet', value)}
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
              onChange={(value) => updateSetting('defaultMarginPercentage', value || 0)}
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
              onChange={(value) => updateSetting('defaultWastePercentage', value || 0)}
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

      {/* Seção 4: Autenticação */}
      <div className="card-base p-6 border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-500" />
            <span>Sua Conta</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie sua sessão de login com o Supabase.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="px-4 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-white text-xs font-semibold transition-colors self-start sm:self-auto"
        >
          Sair da Conta
        </button>
      </div>

      {/* Modal de Confirmação para Importar Backup */}
      <CustomModal
        isOpen={isRestoreConfirmOpen}
        onClose={() => {
          setIsRestoreConfirmOpen(false);
          setPendingBackupContent(null);
          setPendingSystemBackup(null);
        }}
        title="Restaurar Backup do Arquivo?"
        description={pendingSystemBackup
          ? 'A cópia será gravada como uma nova versão dos dados. Pedidos e históricos existentes serão preservados; usuários da cópia são apenas informativos e não recriam contas.'
          : 'Este arquivo antigo será validado estruturalmente e restaurará os dados que contém. Deseja prosseguir?'}
        confirmText="Sim, Restaurar Backup"
        cancelText="Cancelar"
        variant="warning"
        onConfirm={() => { void confirmRestoreBackup(); }}
      />

      <CustomModal
        isOpen={pendingBackupArchiveId !== null}
        onClose={() => setPendingBackupArchiveId(null)}
        title="Excluir cópia do histórico?"
        description="A cópia deixará de aparecer nesta lista. O conteúdo e os dados do backup continuarão preservados no banco de dados."
        confirmText="Excluir do histórico"
        cancelText="Cancelar"
        variant="warning"
        onConfirm={() => { void archiveSelectedBackup(); }}
      />

      <CustomModal
        isOpen={isDiscardModalOpen}
        onClose={() => setIsDiscardModalOpen(false)}
        title="Descartar alterações não salvas?"
        description="Os parâmetros voltarão ao último estado confirmado no Supabase."
        confirmText="Descartar alterações"
        cancelText="Continuar editando"
        variant="warning"
        onConfirm={discardUnsavedSettings}
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
