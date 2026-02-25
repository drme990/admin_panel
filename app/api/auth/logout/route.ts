import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { logActivity } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin-token')?.value;

    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        await logActivity({
          userId: payload.userId,
          userName: payload.name,
          userEmail: payload.email,
          action: 'logout',
          resource: 'auth',
          details: `User ${payload.name} logged out`,
        });
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Clear cookie
    response.cookies.delete('admin-token');

    return response;
  } catch (error) {
    console.error('Error logging out:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to logout',
      },
      { status: 500 },
    );
  }
}
