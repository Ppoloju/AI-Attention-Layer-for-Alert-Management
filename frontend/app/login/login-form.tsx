'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErrorMessage('Sign-in failed. Check your email and password.');
        return;
      }

      router.replace('/');
      router.refresh();
    } catch (error) {
      console.error('Supabase sign-in failed:', error);
      setErrorMessage('Sign-in is temporarily unavailable.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <label className="block text-sm text-zinc-300">
        Email
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={event => setEmail(event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
      </label>
      <label className="block text-sm text-zinc-300">
        Password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={event => setPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
      </label>
      {errorMessage && (
        <p role="alert" className="text-sm text-red-400">{errorMessage}</p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-60"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
