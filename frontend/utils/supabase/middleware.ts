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
  const { pathname } = request.nextUrl;
  const isIngestionRequest = pathname === '/api/events' && request.method === 'POST';
  const isPublicRoute = pathname === '/login' || pathname === '/api/health' || isIngestionRequest;

  if (isPublicRoute) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (process.env.NODE_ENV !== 'production') {
      return supabaseResponse;
    }

    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Supabase authentication is not configured.' },
        { status: 503 }
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
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

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Supabase session validation failed:', error.name);
    return NextResponse.json(
      { error: 'Unable to validate the current session.' },
      { status: 503 }
    );
  }

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

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
