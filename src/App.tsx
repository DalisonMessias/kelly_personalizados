import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/auth/AuthPage';
import { Layout } from './components/layout/Layout';
import { NavTab } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { CalculatorPage } from './components/calculator/CalculatorPage';
import { CatalogPage } from './components/catalog/CatalogPage';
import { HistoryPage } from './components/history/HistoryPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { AssistantPage } from './components/assistant/AssistantPage';
import { ClientsPage } from './components/clients/ClientsPage';
import { StoreProductsPage } from './components/store-products/StoreProductsPage';
import { ArtPromptPage } from './components/art-ai/ArtPromptPage';
import { storageService } from './services/storage';
import { CalculationRecord, ProductService } from './types';
import { supabase } from './services/supabase';
import { STORE_ROUTES } from './routes';
import { StorefrontPage } from './components/storefront/StorefrontPage';
import { StorefrontOrdersPage } from './components/storefront/StorefrontOrdersPage';
import { CustomQuoteRequestsPage } from './components/storefront/CustomQuoteRequestsPage';
import { UserManagementPage } from './components/users/UserManagementPage';
import { CustomModal } from './components/ui/CustomModal';
import { useToast } from './components/ui/Toast';

function createDuplicatedProduct(product: ProductService): ProductService {
  const duplicateId = `prod-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    ...JSON.parse(JSON.stringify(product)),
    id: duplicateId,
    name: `${product.name} (Cópia)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function App() {
  const { user, loading } = useAuth();
  const { success, error } = useToast();
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [currentSearch, setCurrentSearch] = useState(() => window.location.search);
  const [adminAccess, setAdminAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [currentTab, setCurrentTab] = useState<NavTab>(() => window.location.pathname.startsWith(STORE_ROUTES.adminOrders)
    ? 'store-orders'
    : window.location.pathname.startsWith(STORE_ROUTES.adminQuoteRequests) ? 'quote-requests'
      : window.location.pathname.startsWith(STORE_ROUTES.adminUsers) ? 'users' : 'dashboard');
  const [settingsUnsaved, setSettingsUnsaved] = useState(false);
  const [pendingTab, setPendingTab] = useState<NavTab | null>(null);
  const [discardSettingsOpen, setDiscardSettingsOpen] = useState(false);
  const [pendingLogout, setPendingLogout] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const historyLocation = useRef(window.location.pathname + window.location.search);
  const isAdminRoute = currentPath.startsWith('/admin');

  const navigate = useCallback((path: string) => {
    const current = window.location.pathname + window.location.search;
    if (current === path) return;
    window.history.pushState({}, '', path);
    historyLocation.current = path;
    setCurrentPath(window.location.pathname);
    setCurrentSearch(window.location.search);
  }, []);

  const navigateToTab = useCallback((tab: NavTab) => {
    setCurrentTab(tab);
    navigate(tab === 'store-orders'
      ? STORE_ROUTES.adminOrders
      : tab === 'quote-requests' ? STORE_ROUTES.adminQuoteRequests
        : tab === 'users' ? STORE_ROUTES.adminUsers : STORE_ROUTES.admin);
  }, [navigate]);

  const handleSelectTab = useCallback((tab: NavTab) => {
    if (settingsUnsaved && currentTab === 'settings' && tab !== 'settings') {
      setPendingTab(tab);
      setPendingLocation(null);
      setDiscardSettingsOpen(true);
      return;
    }
    navigateToTab(tab);
  }, [currentTab, navigateToTab, settingsUnsaved]);

  const confirmDiscardSettings = () => {
    setSettingsUnsaved(false);
    setDiscardSettingsOpen(false);
    if (pendingLogout) {
      setPendingLogout(false);
      setPendingTab(null);
      setPendingLocation(null);
      void supabase.auth.signOut().then(({ error: logoutError }) => {
        if (logoutError) error('Não foi possível sair', 'Tente novamente em instantes.');
        else success('Sessão encerrada', 'Você saiu da sua conta.');
      });
      return;
    }
    if (pendingTab) navigateToTab(pendingTab);
    else if (pendingLocation) {
      window.history.pushState({}, '', pendingLocation);
      historyLocation.current = pendingLocation;
      setCurrentPath(window.location.pathname);
      setCurrentSearch(window.location.search);
    }
    setPendingTab(null);
    setPendingLocation(null);
  };

  const handleLogoutAttempt = useCallback(() => {
    if (!settingsUnsaved || currentTab !== 'settings') return false;
    setPendingLogout(true);
    setPendingTab(null);
    setPendingLocation(null);
    setDiscardSettingsOpen(true);
    return true;
  }, [currentTab, settingsUnsaved]);

  useEffect(() => {
    const handlePopState = () => {
      const nextLocation = window.location.pathname + window.location.search;
      if (settingsUnsaved && currentTab === 'settings') {
        window.history.pushState({}, '', historyLocation.current);
        setPendingTab(null);
        setPendingLocation(nextLocation);
        setDiscardSettingsOpen(true);
        return;
      }
      historyLocation.current = nextLocation;
      setCurrentPath(window.location.pathname);
      setCurrentSearch(window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentTab, settingsUnsaved]);

  useEffect(() => {
    if (!isAdminRoute || !user) {
      setAdminAccess('checking');
      return;
    }
    let active = true;
    setAdminAccess('checking');
    supabase.rpc('kelly_is_storefront_admin_v1').then(
      ({ data, error }) => { if (active) setAdminAccess(!error && data === true ? 'allowed' : 'denied'); },
      () => { if (active) setAdminAccess('denied'); },
    );
    return () => { active = false; };
  }, [isAdminRoute, user?.id]);

  useEffect(() => {
    if (currentPath.startsWith(STORE_ROUTES.adminOrders)) setCurrentTab('store-orders');
    else if (currentPath.startsWith(STORE_ROUTES.adminQuoteRequests)) setCurrentTab('quote-requests');
    else if (currentPath.startsWith(STORE_ROUTES.adminUsers)) setCurrentTab('users');
    else if (currentPath.startsWith('/admin') && (currentTab === 'store-orders' || currentTab === 'quote-requests' || currentTab === 'users')) setCurrentTab('dashboard');
  }, [currentPath, currentTab]);
  const [products, setProducts] = useState<ProductService[]>(storageService.getProducts());
  const [calculations, setCalculations] = useState<CalculationRecord[]>(storageService.getCalculations());
  const [editingProduct, setEditingProduct] = useState<ProductService | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [quoteCustomerId, setQuoteCustomerId] = useState<string>('');
  const [quoteInitialProduct, setQuoteInitialProduct] = useState<ProductService | null>(null);

  const refreshAllData = useCallback(() => {
    setProducts(storageService.getProducts());
    setCalculations(storageService.getCalculations());
  }, []);

  const handleEditProduct = (product: ProductService) => {
    setIsDuplicating(false);
    setEditingProduct(product);
    setCurrentTab('calculator');
  };

  const handleDuplicateProduct = (product: ProductService) => {
    const duplicate = createDuplicatedProduct(product);
    setIsDuplicating(true);
    setEditingProduct(duplicate);
    setCurrentTab('calculator');
  };

  const handleClearEditingProduct = () => {
    setEditingProduct(null);
    setIsDuplicating(false);
  };

  const handleProductSaved = (savedProduct: ProductService) => {
    refreshAllData();
    setEditingProduct(savedProduct);
    setIsDuplicating(false);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#fffafc]"><p className="text-sm font-semibold text-pink-600">Carregando...</p></div>;
  }

  if (!isAdminRoute) {
    return <StorefrontPage pathname={currentPath} search={currentSearch} onNavigate={navigate} />;
  }

  if (!user) return <AuthPage />;
  if (adminAccess === 'checking') return <div className="flex min-h-screen items-center justify-center"><p className="text-sm font-semibold text-pink-600">Verificando acesso...</p></div>;
  if (adminAccess === 'denied') {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5"><section className="w-full max-w-md rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-xl"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">!</div><h1 className="mt-4 text-xl font-black text-slate-900">Acesso administrativo restrito</h1><p className="mt-2 text-sm leading-6 text-slate-500">Esta conta não está autorizada a acessar o painel da loja.</p><button type="button" onClick={() => { void supabase.auth.signOut().then(() => navigate(STORE_ROUTES.adminLogin)); }} className="mt-5 min-h-11 w-full rounded-xl bg-pink-600 px-4 text-sm font-bold text-white hover:bg-pink-700">Sair e entrar com outra conta</button></section></main>;
  }

  return (
        <Layout currentTab={currentTab} onSelectTab={handleSelectTab} onLogoutAttempt={handleLogoutAttempt}>
          {currentTab === 'dashboard' && (
            <Dashboard
              products={products}
              calculations={calculations}
              onNavigate={(tab) => {
                if (tab === 'store-orders') { handleSelectTab(tab); return; }
                if (tab === 'calculator') {
                  setEditingProduct(null);
                }
                handleSelectTab(tab);
              }}
              onEditProduct={handleEditProduct}
            />
          )}

          {currentTab === 'calculator' && (
            <CalculatorPage
              initialProduct={editingProduct}
              isDuplicating={isDuplicating}
              onClearInitialProduct={handleClearEditingProduct}
              onNavigate={setCurrentTab}
              onProductSaved={handleProductSaved}
              initialCustomerId={quoteCustomerId}
              onCreateQuote={(product, customerId) => {
                setQuoteInitialProduct(product);
                setQuoteCustomerId(customerId || '');
                setCurrentTab('clients');
              }}
            />
          )}

          {currentTab === 'catalog' && (
            <CatalogPage
              products={products}
              onNavigate={(tab) => {
                if (tab === 'calculator') {
                  setEditingProduct(null);
                }
                setCurrentTab(tab);
              }}
              onEditProduct={handleEditProduct}
              onDuplicateProduct={handleDuplicateProduct}
              onRefreshProducts={refreshAllData}
            />
          )}

          {currentTab === 'history' && (
            <HistoryPage
              calculations={calculations}
              products={products}
              onNavigate={(tab) => {
                if (tab === 'calculator') {
                  setEditingProduct(null);
                }
                setCurrentTab(tab);
              }}
              onRefreshCalculations={refreshAllData}
              onLoadIntoCalculator={handleEditProduct}
              onDuplicateProduct={handleDuplicateProduct}
            />
          )}

          {currentTab === 'assistant' && (
            <AssistantPage
              products={products}
              calculations={calculations}
              onFillCalculator={(proposalProduct) => {
                setIsDuplicating(false);
                setEditingProduct(proposalProduct);
                setCurrentTab('calculator');
              }}
            />
          )}

          {currentTab === 'clients' && (
            <ClientsPage
              products={products}
              initialCustomerId={quoteCustomerId}
              initialProduct={quoteInitialProduct}
              onNewQuoteInCalculator={(customerId) => {
                setQuoteCustomerId(customerId || '');
                setQuoteInitialProduct(null);
                setEditingProduct(null);
                setIsDuplicating(false);
                setCurrentTab('calculator');
              }}
            />
          )}

          {currentTab === 'art-prompt' && (
            <ArtPromptPage />
          )}

          {currentTab === 'store-products' && (
            <StoreProductsPage
              onSendToCalculator={(product) => {
                setIsDuplicating(false);
                setEditingProduct(JSON.parse(JSON.stringify(product)));
                setCurrentTab('calculator');
              }}
            />
          )}

          {currentTab === 'store-orders' && (
            <StorefrontOrdersPage />
          )}

          {currentTab === 'quote-requests' && (
            <CustomQuoteRequestsPage onOpenOrders={() => navigateToTab('store-orders')} />
          )}

          {currentTab === 'settings' && (
            <SettingsPage onRefreshAllData={refreshAllData} onUnsavedChangesChange={setSettingsUnsaved} />
          )}

          {currentTab === 'users' && <UserManagementPage />}

          <CustomModal
            isOpen={discardSettingsOpen}
            onClose={() => { setDiscardSettingsOpen(false); setPendingTab(null); setPendingLocation(null); setPendingLogout(false); }}
            title={pendingLogout ? 'Descartar alterações e sair?' : 'Descartar alterações não salvas?'}
            description={pendingLogout
              ? 'As configurações que ainda não foram gravadas no Supabase serão descartadas antes de encerrar sua sessão.'
              : 'As configurações que ainda não foram gravadas no Supabase serão descartadas ao sair desta página.'}
            confirmText={pendingLogout ? 'Descartar e sair' : 'Descartar e continuar'}
            cancelText="Continuar editando"
            variant="warning"
            onConfirm={confirmDiscardSettings}
          />
        </Layout>
  );
}

export default App;
