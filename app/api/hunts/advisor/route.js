import { NextResponse } from 'next/server';
import { buildHuntAdvisor } from '@/lib/huntAdvisor';

export const dynamic = 'force-dynamic';

export function GET(request) {
  const params = request.nextUrl.searchParams;
  return NextResponse.json(buildHuntAdvisor({
    level: params.get('level'),
    sort: params.get('sort'),
    filter: params.get('filter'),
    goal: params.get('goal'),
    currentGold: params.get('currentGold'),
    inventoryValue: params.get('inventoryValue'),
    netProfitHour: params.get('netProfitHour')
  }));
}
