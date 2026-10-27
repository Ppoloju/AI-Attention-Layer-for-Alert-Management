import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseHealthKey,
  getSupabasePublishableKey,
  getSupabaseUrl,
} from '../../../shared/lib/providers';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabasePublishableKey();

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();

  return supabaseResponse;
}

export async function checkSupabaseHealth(): Promise<boolean> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseHealthKey();

  if (!supabaseUrl || !supabaseKey) return false;

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}
