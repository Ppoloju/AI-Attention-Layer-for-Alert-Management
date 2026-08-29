import { NextRequest, NextResponse } from 'next/server';
import { getSignals } from '../../../../shared/lib/db';
import { getMockSignals } from '../mock-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return NextResponse.json(
        { error: 'Invalid limit parameter. Must be between 1 and 1000.' },
        { status: 400 }
      );
    }

    const signals = await getSignals(limit);

    return NextResponse.json({ signals });
  } catch (error) {
    console.warn('Database offline, returning mock signals:', error);
    const mockSignals = getMockSignals();
    return NextResponse.json({ signals: mockSignals });
  }
}
