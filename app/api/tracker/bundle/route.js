import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const possiblePaths = [
    path.join(process.cwd(), '..', 'snippet_PROTECTED.js'),
    path.join(process.cwd(), '..', 'snippet.js'),
    path.join(process.cwd(), 'public', 'snippet_PROTECTED.js'),
    path.join(process.cwd(), 'snippet_PROTECTED.js'),
  ];

  const foundPath = possiblePaths.find(p => fs.existsSync(p));

  if (!foundPath) {
    return new NextResponse('console.error("Bundle não encontrado no servidor.");', {
      status: 404,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
    });
  }

  const scriptCode = fs.readFileSync(foundPath, 'utf8');

  return new NextResponse(scriptCode, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
