import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const possiblePaths = [
    path.join(process.cwd(), 'StonegyStats_PROTECTED.zip'),
    path.join(process.cwd(), 'public', 'StonegyStats_PROTECTED.zip'),
    path.join(process.cwd(), '..', 'StonegyStats_PROTECTED.zip'),
  ];

  const foundPath = possiblePaths.find(p => fs.existsSync(p));

  if (!foundPath) {
    return NextResponse.json({ success: false, message: 'Pacote ZIP não encontrado no servidor.' }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(foundPath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="StonegyStats_PROTECTED.zip"',
      'Content-Length': String(fileBuffer.length),
    },
  });
}
