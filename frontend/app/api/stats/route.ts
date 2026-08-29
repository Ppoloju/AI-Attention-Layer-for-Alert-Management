import { NextRequest, NextResponse } from 'next/server';
import { getDashboardStats } from '../../../../shared/lib/db';
import { getMockStats } from '../mock-store';

export async function GET(request: NextRequest) {
  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.warn('Database offline, returning mock stats:', error);
    const mockStats = getMockStats();
    return NextResponse.json(mockStats);
  }
}
