import LoginForm from './login-form';

export default function LoginPage() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-xl">
        <h1 className="text-2xl font-bold">Sign in to SignalFlow</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Use your existing Supabase account to access the incident dashboard.
        </p>
        {configured ? (
          <LoginForm />
        ) : (
          <p role="alert" className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            Supabase sign-in is not configured. Set NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable dashboard authentication.
          </p>
        )}
      </section>
    </main>
  );
}
