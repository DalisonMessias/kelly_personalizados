import { supabase } from './supabase';
import { getSupabaseFunctionErrorMessage } from './supabaseFunctionErrors';

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  username: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  isAdmin: boolean;
  isActive: boolean;
  isPrimary: boolean;
}

export interface ManagedUserAudit {
  id: string;
  actor_user_id: string;
  target_user_id: string;
  target_email: string;
  action: string;
  created_at: string;
}

async function invokeAdminUsers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('manage-admin-users', { body });
  if (error) {
    throw new Error(await getSupabaseFunctionErrorMessage(error, 'manage-admin-users'));
  }
  if (!data) throw new Error('O servidor não retornou os dados esperados.');
  return data as T;
}

export const adminManagementService = {
  async listUsers(): Promise<{ users: ManagedUser[]; audit: ManagedUserAudit[] }> {
    const result = await invokeAdminUsers<{ users: ManagedUser[]; audit: ManagedUserAudit[] }>({ action: 'list' });
    return {
      users: Array.isArray(result.users) ? result.users : [],
      audit: Array.isArray(result.audit) ? result.audit : [],
    };
  },

  async createUser(input: { name: string; username: string; email: string; password: string }): Promise<ManagedUser> {
    const result = await invokeAdminUsers<{ user: ManagedUser }>({ action: 'create', ...input });
    return result.user;
  },

  async updateUser(input: { userId: string; name: string; username: string; email: string; password?: string }): Promise<ManagedUser> {
    const result = await invokeAdminUsers<{ user: ManagedUser }>({ action: 'update', ...input });
    return result.user;
  },

  async setActive(userId: string, isActive: boolean): Promise<ManagedUser> {
    const result = await invokeAdminUsers<{ user: ManagedUser }>({ action: 'set-active', userId, isActive });
    return result.user;
  },

  async removeAccess(userId: string, authorizationPassword: string): Promise<ManagedUser> {
    const result = await invokeAdminUsers<{ user: ManagedUser }>({ action: 'delete', userId, authorizationPassword });
    return result.user;
  },
};
