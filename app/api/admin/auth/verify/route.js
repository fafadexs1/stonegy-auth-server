import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const admin = await verifyAdminRequest(req);
  if (!admin) {
    return NextResponse.json({ success: false, message: 'Sessão de administrador inválida ou expirada.' }, { status: 401 });
  }

  return NextResponse.json({ success: true, admin });
}
