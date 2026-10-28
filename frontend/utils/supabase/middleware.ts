import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseHealthKey,
  getSupabasePublishableKey,
  getSupabaseUrl,
} from '../../../shared/lib/providers';

export interface SupabaseHealthResult {
  ok: boolean;
  statusCode: number | null;
  message: string;
}

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

export async function checkSupabaseHealth(): Promise<SupabaseHealthResult> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseHealthKey();

  if (!supabaseUrl || !supabaseKey) {
    return {
      ok: false,
      statusCode: null,
      message: 'Supabase URL or API key is missing.',
    };
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/`, {
      headers: {
        apikey: supabaseKey,
      },
      cache: 'no-store',
    });

    if (response.ok) {
      return {
        ok: true,
        statusCode: response.status,
        message: 'Supabase Data API is reachable.',
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        statusCode: response.status,
        message: 'Supabase rejected the API key. Check that it belongs to this project and is active.',
      };
    }

    if (response.status === 404) {
      return {
        ok: false,
        statusCode: response.status,
        message: 'Supabase Data API was not found. Check the project URL and Data API settings.',
      };
    }

    return {
      ok: false,
      statusCode: response.status,
      message: `Supabase Data API returned HTTP ${response.status}.`,
    };
  } catch (error) {
    console.error(
      'Supabase health check request failed:',
      error instanceof Error ? error.name : 'Unknown error'
    );
    return {
      ok: false,
      statusCode: null,
      message: 'Could not reach Supabase. Check the project URL, DNS, and network access.',
    };
  }
}
