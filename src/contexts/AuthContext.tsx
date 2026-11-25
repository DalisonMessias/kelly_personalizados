import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { deactivateCloudPersistence, initializeCloudPersistence, retryPendingCloudData } from '../services/appDataSync';
import { syncPendingAttachments } from '../services/attachmentDb';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user || null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user || null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      deactivateCloudPersistence();
      setLoadedUserId(null);
      return;
    }

    let cancelled = false;
    setLoadedUserId(null);
    void initializeCloudPersistence(userId)
      .then(() => syncPendingAttachments())
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadedUserId(userId);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) return;

    const retryWhenOnline = () => {
      retryPendingCloudData();
      void syncPendingAttachments();
    };
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, [session?.user.id]);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-xl text-pink-600">Carregando autenticação...</p>
        </div>
      ) : session?.user && loadedUserId !== session.user.id ? (
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-xl text-pink-600">Sincronizando seus dados...</p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
