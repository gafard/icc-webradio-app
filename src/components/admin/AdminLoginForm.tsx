'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Props = {
  nextPath: string;
  hasSession: boolean;
};

function normalizeNextPath(value: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/admin';
  return value;
}

export default function AdminLoginForm({ nextPath, hasSession }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const targetPath = normalizeNextPath(nextPath);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      if (!supabase) {
        throw new Error('Supabase auth is not configured.');
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        throw new Error(signInError.message || 'Email or password is invalid.');
      }

      const roleResponse = await fetch('/api/admin/role', { cache: 'no-store' });
      const rolePayload = await roleResponse.json();
      if (!rolePayload?.isAdmin) {
        await supabase.auth.signOut();
        throw new Error('Compte connecté, mais sans rôle admin.');
      }

      router.replace(targetPath);
      router.refresh();
    } catch (submitError: any) {
      setError(submitError?.message || 'Connexion admin impossible.');
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    setBusy(true);
    setError('');
    try {
      if (!supabase) throw new Error('Supabase auth is not configured.');
      await supabase.auth.signOut();
      router.refresh();
    } catch (signOutError: any) {
      setError(signOutError?.message || 'Déconnexion impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass-panel rounded-3xl p-5 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold">Connexion Admin</h1>
        <p className="text-sm text-[color:var(--foreground)]/70">
          Utilise ton email + mot de passe Supabase.
        </p>
      </div>

      {hasSession ? (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-200/10 px-3 py-2 text-xs text-amber-200">
          Session active détectée sans accès admin. Connecte-toi avec un compte admin.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs text-[color:var(--foreground)]/70">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input-field w-full"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-[color:var(--foreground)]/70">Mot de passe</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input-field w-full"
            required
          />
        </label>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy} className="btn-base btn-primary px-4 py-2 text-sm">
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            Se connecter
          </button>
          {hasSession ? (
            <button type="button" disabled={busy} onClick={onSignOut} className="btn-base btn-secondary px-4 py-2 text-sm">
              Déconnecter la session actuelle
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
