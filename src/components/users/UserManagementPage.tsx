import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Clock3, Pencil, Plus, RefreshCw, Search, ShieldCheck, UserRound, UserRoundX, Users } from 'lucide-react';
import { adminManagementService, ManagedUser, ManagedUserAudit } from '../../services/adminManagementService';
import { CustomModal } from '../ui/CustomModal';
import { CustomSwitch } from '../ui/CustomSwitch';
import { useToast } from '../ui/Toast';

interface UserForm {
  name: string;
  username: string;
  email: string;
  password: string;
}

const EMPTY_FORM: UserForm = { name: '', username: '', email: '', password: '' };

function formatDate(value: string | null): string {
  if (!value) return 'Não disponível';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Não disponível';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function UserManagementPage() {
  const { success, error } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [audit, setAudit] = useState<ManagedUserAudit[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [pendingAccessChange, setPendingAccessChange] = useState<{ user: ManagedUser; activate: boolean } | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<ManagedUser | null>(null);
  const [authorizationPassword, setAuthorizationPassword] = useState('');
  const initialLoadStarted = useRef(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await adminManagementService.listUsers();
      setUsers(result.users);
      setAudit(result.audit);
    } catch (loadError) {
      error('Não foi possível carregar os usuários', loadError instanceof Error ? loadError.message : 'Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    void loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return users;
    return users.filter((user) => [user.name, user.username, user.email].some((value) => value.toLocaleLowerCase('pt-BR').includes(term)));
  }, [search, users]);

  const openCreate = () => {
    setSelectedUser(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  };

  const openEdit = (user: ManagedUser) => {
    setSelectedUser(user);
    setForm({ name: user.name, username: user.username, email: user.email, password: '' });
    setEditorOpen(true);
  };

  const saveUser = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (selectedUser) {
        await adminManagementService.updateUser({
          userId: selectedUser.id,
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          ...(form.password ? { password: form.password } : {}),
        });
        success('Usuário atualizado', 'Os dados da conta foram salvos.');
      } else {
        await adminManagementService.createUser({
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
        });
        success('Administrador criado', 'A nova conta já pode acessar o painel.');
      }
      setEditorOpen(false);
      setForm(EMPTY_FORM);
      await loadUsers();
    } catch (saveError) {
      error('Não foi possível salvar', saveError instanceof Error ? saveError.message : 'Revise os dados e tente novamente.');
      setEditorOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const confirmAccessChange = async () => {
    if (!pendingAccessChange) return;
    setSaving(true);
    try {
      await adminManagementService.setActive(pendingAccessChange.user.id, pendingAccessChange.activate);
      success(pendingAccessChange.activate ? 'Acesso reativado' : 'Acesso desativado', 'A alteração foi aplicada à conta.');
      setPendingAccessChange(null);
      await loadUsers();
    } catch (changeError) {
      error('Não foi possível alterar o acesso', changeError instanceof Error ? changeError.message : 'Tente novamente em instantes.');
      setPendingAccessChange(null);
    } finally {
      setSaving(false);
    }
  };

  const confirmRemoval = async () => {
    if (!pendingRemoval || saving) return;
    setSaving(true);
    try {
      await adminManagementService.removeAccess(pendingRemoval.id, authorizationPassword);
      success('Acesso removido', 'A conta foi bloqueada e o registro de auditoria foi salvo.');
      setPendingRemoval(null);
      setAuthorizationPassword('');
      await loadUsers();
    } catch (removeError) {
      error('Não foi possível remover o acesso', removeError instanceof Error ? removeError.message : 'Confira a autorização e tente novamente.');
      setAuthorizationPassword('');
      setPendingRemoval(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700"><ShieldCheck className="h-3.5 w-3.5" /> Área protegida</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Gerenciamento de Usuários</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Cadastre administradores e acompanhe as contas que podem acessar o painel.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadUsers()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
          <button type="button" onClick={openCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white shadow-md shadow-brand-500/20 transition hover:bg-brand-700"><Plus className="h-4 w-4" /> Adicionar administrador</button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<Users className="h-4 w-4" />} label="Contas cadastradas" value={users.length} />
        <SummaryCard icon={<ShieldCheck className="h-4 w-4" />} label="Administradores" value={users.filter((user) => user.isAdmin).length} />
        <SummaryCard icon={<UserRound className="h-4 w-4" />} label="Contas ativas" value={users.filter((user) => user.isActive).length} />
      </div>

      <div className="card-base space-y-4 p-4 sm:p-6">
        <label className="relative block max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="input-base pl-10" placeholder="Buscar por nome, usuário ou e-mail" />
        </label>

        {loading ? <div className="py-12 text-center text-sm font-semibold text-slate-500">Carregando usuários...</div>
          : filteredUsers.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-12 text-center"><Users className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-600">Nenhum usuário encontrado.</p></div>
          : <div className="grid gap-3">{filteredUsers.map((user) => <article key={user.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-black text-slate-900">{user.name || user.username || 'Usuário sem nome'}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${user.isAdmin ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>{user.isPrimary ? 'Administrador principal' : user.isAdmin ? 'Administrador' : 'Conta cadastrada'}</span>
                </div>
                <p className="mt-1 break-all text-sm text-slate-600">{user.email || 'Sem e-mail'}{user.username ? <span className="text-slate-400"> · @{user.username}</span> : null}</p>
                <div className="mt-3 grid gap-x-5 gap-y-1 text-xs text-slate-500 sm:grid-cols-2">
                  <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Criada em {formatDate(user.createdAt)}</span>
                  <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Último acesso: {formatDate(user.lastSignInAt)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <CustomSwitch label={user.isActive ? 'Ativa' : 'Desativada'} checked={user.isActive} onChange={(activate) => setPendingAccessChange({ user, activate })} disabled={saving || (user.isAdmin && user.isActive && users.filter((item) => item.isAdmin && item.isActive).length <= 1)} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(user)} title="Editar conta" className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:flex-none"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                  <button type="button" onClick={() => { setPendingRemoval(user); setAuthorizationPassword(''); }} title="Remover acesso à conta" className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50 sm:flex-none" disabled={user.isAdmin && user.isActive && users.filter((item) => item.isAdmin && item.isActive).length <= 1}><UserRoundX className="h-3.5 w-3.5" /> Remover acesso</button>
                </div>
              </div>
            </div>
          </article>)}</div>}
      </div>

      <section className="card-base space-y-4 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-50 p-2 text-amber-600"><AlertTriangle className="h-4 w-4" /></div>
          <div><h3 className="text-sm font-black text-slate-900">Histórico de remoção de acesso</h3><p className="mt-1 text-xs text-slate-500">Os registros permanecem no banco para auditoria.</p></div>
        </div>
        {audit.length === 0 ? <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-500">Nenhuma remoção de acesso registrada.</p>
          : <div className="divide-y divide-slate-100">{audit.slice(0, 20).map((entry) => <div key={entry.id} className="flex flex-col gap-1 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"><span className="break-all font-semibold text-slate-700">{entry.target_email || entry.target_user_id}</span><span className="text-slate-500">{formatDate(entry.created_at)}</span></div>)}</div>}
      </section>

      <CustomModal isOpen={editorOpen} onClose={() => { if (!saving) setEditorOpen(false); }} title={selectedUser ? 'Editar usuário' : 'Adicionar administrador'} description={selectedUser ? 'Atualize os dados da conta. Deixe a senha vazia para mantê-la.' : 'A nova conta terá acesso administrativo ao sistema.'} confirmText={saving ? 'Salvando...' : selectedUser ? 'Salvar alterações' : 'Criar administrador'} cancelText="Cancelar" onConfirm={() => { void saveUser(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo"><input autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="input-base" maxLength={100} /></Field>
          <Field label="Usuário"><input autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="input-base" maxLength={40} /></Field>
          <Field label="E-mail"><input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="input-base" maxLength={254} /></Field>
          <Field label={selectedUser ? 'Nova senha (opcional)' : 'Senha'}><input type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="input-base" minLength={selectedUser ? 0 : 10} placeholder="Mínimo de 10 caracteres" /></Field>
        </div>
      </CustomModal>

      <CustomModal isOpen={Boolean(pendingAccessChange)} onClose={() => !saving && setPendingAccessChange(null)} title={pendingAccessChange?.activate ? 'Reativar conta?' : 'Desativar conta?'} description={pendingAccessChange?.activate ? 'A conta voltará a poder entrar no painel.' : 'O acesso será bloqueado e a conta e seus dados continuarão preservados.'} confirmText={saving ? 'Atualizando...' : pendingAccessChange?.activate ? 'Reativar acesso' : 'Desativar acesso'} cancelText="Cancelar" variant={pendingAccessChange?.activate ? 'primary' : 'warning'} onConfirm={() => { void confirmAccessChange(); }} />

      <CustomModal isOpen={Boolean(pendingRemoval)} onClose={() => { if (!saving) { setPendingRemoval(null); setAuthorizationPassword(''); } }} title="Remover acesso do usuário?" description="A conta será bloqueada e o evento ficará registrado para auditoria. Os dados da conta serão preservados." confirmText={saving ? 'Validando...' : 'Confirmar remoção'} cancelText="Cancelar" variant="danger" onConfirm={authorizationPassword ? () => { void confirmRemoval(); } : undefined}>
        <label className="block text-xs font-bold text-slate-700">Senha especial de autorização
          <input type="password" autoComplete="current-password" value={authorizationPassword} onChange={(event) => setAuthorizationPassword(event.target.value)} className="input-base mt-1.5" placeholder="Digite a autorização" />
        </label>
        {pendingRemoval && <p className="mt-3 text-xs text-slate-500">Conta selecionada: <strong className="break-all">{pendingRemoval.email}</strong></p>}
      </CustomModal>
    </section>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="card-base flex items-center gap-3 p-4"><span className="rounded-xl bg-brand-50 p-2 text-brand-600">{icon}</span><span><small className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</small><strong className="text-xl font-black text-slate-900">{value}</strong></span></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-bold text-slate-700">{label}<div className="mt-1">{children}</div></label>;
}
