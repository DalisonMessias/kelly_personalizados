import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, CircleAlert, Loader2, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { supabase } from '../../services/supabase';

const AuthPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageType(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      setMessageType('success');
      setMessage('Acesso realizado com sucesso.');
    } catch {
      setMessageType('error');
      setMessage('Não foi possível entrar. Confira seu e-mail e sua senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-screen relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="auth-orbit absolute -left-24 -top-24 h-72 w-72 rounded-full bg-pink-200/60 blur-3xl sm:h-96 sm:w-96" />
        <div className="auth-orbit auth-orbit-delay absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-rose-200/50 blur-3xl sm:h-[28rem] sm:w-[28rem]" />
        <div className="absolute left-1/2 top-1/4 h-36 w-36 -translate-x-1/2 rounded-full bg-brand-100/40 blur-3xl" />
      </div>

      <section className="relative z-10 w-full max-w-[440px]">
        <div className="auth-card-enter rounded-[28px] border border-white/80 bg-white/85 px-6 py-7 shadow-[0_25px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl sm:px-9 sm:py-9">
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-rose-400 text-white shadow-lg shadow-brand-500/25">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-600">
              Kelly Personalizados
            </p>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-[1.8rem]">
              Bem-vinda de volta
            </h1>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
              Entre para acessar o painel administrativo da loja.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label htmlFor="auth-email" className="mb-2 block text-xs font-bold text-slate-700">
                E-mail
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="email"
                  id="auth-email"
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100/70"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="mb-2 block text-xs font-bold text-slate-700">
                Senha
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="password"
                  id="auth-password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100/70"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="auth-primary-button flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-rose-500 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-500/20 focus:outline-none focus:ring-4 focus:ring-brand-200 disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no painel</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {message && (
            <div
              id="auth-message"
              role={messageType === 'error' ? 'alert' : 'status'}
              className={`mt-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-relaxed ${messageType === 'error'
                ? 'border-red-100 bg-red-50 text-red-700'
                : 'border-emerald-100 bg-emerald-50 text-emerald-700'
              }`}
            >
              {messageType === 'error'
                ? <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
              <span>{message}</span>
            </div>
          )}

          <p className="mt-7 text-center text-[11px] leading-relaxed text-slate-400">
            Seus dados ficam sincronizados com sua conta e disponíveis no cache deste dispositivo.
          </p>
        </div>

        <p className="mt-5 text-center text-xs font-medium text-slate-400">
          Um espaço feito com carinho para o seu ateliê.
        </p>
      </section>
    </main>
  );
};

export default AuthPage;
