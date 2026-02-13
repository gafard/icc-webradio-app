import { NextResponse } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    return NextResponse.json({
      ok: true,
      isAdmin: true,
      role: auth.role,
      mode: auth.mode,
    });
  } catch (error: any) {
    if (error instanceof AdminAuthError && (error.status === 401 || error.status === 403)) {
      return NextResponse.json({
        ok: true,
        isAdmin: false,
        role: null,
        mode: null,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        isAdmin: false,
        role: null,
        error: error?.message || 'Unable to resolve admin role.',
      },
      { status: 500 }
    );
  }
}
