import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './Sidebar';
import { MobileNav } from './MobileNav';
import { storageService } from '../../services/storage';
import { AppSettings } from '../../types';

interface LayoutProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  children: React.ReactNode;
}

export function Layout({ currentTab, onSelectTab, children }: LayoutProps) {
  const [settings, setSettings] = useState<AppSettings>(storageService.getSettings());

  useEffect(() => {
    const handleStorageChange = () => {
      setSettings(storageService.getSettings());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row text-slate-800">
      {/* Sidebar para desktop */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        shopName={settings.shopName}
      />

      {/* Navegação e header para mobile */}
      <MobileNav
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        shopName={settings.shopName}
      />

      {/* Área de conteúdo principal */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-12">
        <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
