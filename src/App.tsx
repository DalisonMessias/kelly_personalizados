import React, { useState, useEffect, useCallback } from 'react';
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
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
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

  return (
    <Layout currentTab={currentTab} onSelectTab={setCurrentTab}>
      {currentTab === 'dashboard' && (
        <Dashboard
          products={products}
          calculations={calculations}
          onNavigate={(tab) => {
            if (tab === 'calculator') {
              setEditingProduct(null);
            }
            setCurrentTab(tab);
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

      {currentTab === 'settings' && (
        <SettingsPage onRefreshAllData={refreshAllData} />
      )}
    </Layout>
  );
}

export default App;
