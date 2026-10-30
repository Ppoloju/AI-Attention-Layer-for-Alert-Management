import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { updateSession } from '../../../frontend/utils/supabase/middleware';

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.NODE_ENV = 'production';
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('Supabase route protection', () => {
  it('fails closed for protected API routes when production auth is not configured', async () => {
    const response = await updateSession(
      new NextRequest('https://signalflow.example/api/stats')
    );

    expect(response.status).toBe(503);
  });

  it('redirects protected pages to login when production auth is not configured', async () => {
    const response = await updateSession(
      new NextRequest('https://signalflow.example/')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://signalflow.example/login');
  });

  it('leaves event ingestion to its separate API-key guard', async () => {
    const response = await updateSession(
      new NextRequest('https://signalflow.example/api/events', { method: 'POST' })
    );

    expect(response.status).toBe(200);
  });

  it('keeps the health endpoint public for infrastructure checks', async () => {
    const response = await updateSession(
      new NextRequest('https://signalflow.example/api/health')
    );

    expect(response.status).toBe(200);
  });
});
