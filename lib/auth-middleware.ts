import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, TokenPayload } from '@/lib/jwt';

export function requireAuth(
  handler: (
    request: NextRequest,
    context: { user: TokenPayload; params?: Promise<Record<string, string>> },
  ) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const token = request.cookies.get('admin-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 },
      );
    }

    return handler(request, { user: payload, params: context?.params });
  };
}
