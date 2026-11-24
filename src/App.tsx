import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/layout/Layout';
import { NavTab } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { CalculatorPage } from './components/calculator/CalculatorPage';
import { CatalogPage } from './components/catalog/CatalogPage';
import { HistoryPage } from './components/history/HistoryPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { storageService } from './services/storage';
import { CalculationRecord, ProductService } from './types';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [products, setProducts] = useState<ProductService[]>(storageService.getProducts());
  const [calculations, setCalculations] = useState<CalculationRecord[]>(storageService.getCalculations());
  const [editingProduct, setEditingProduct] = useState<ProductService | null>(null);

  const refreshAllData = useCallback(() => {
    setProducts(storageService.getProducts());
    setCalculations(storageService.getCalculations());
  }, []);

  const handleEditProduct = (product: ProductService) => {
    setEditingProduct(product);
    setCurrentTab('calculator');
  };

  const handleClearEditingProduct = () => {
    setEditingProduct(null);
  };

  const handleProductSaved = (savedProduct: ProductService) => {
    refreshAllData();
    setEditingProduct(savedProduct);
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
          onClearInitialProduct={handleClearEditingProduct}
          onNavigate={setCurrentTab}
          onProductSaved={handleProductSaved}
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
        />
      )}

      {currentTab === 'settings' && (
        <SettingsPage onRefreshAllData={refreshAllData} />
      )}
    </Layout>
  );
}

export default App;
